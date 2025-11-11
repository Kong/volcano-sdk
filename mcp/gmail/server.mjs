import express from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const app = express();
app.use(express.json());

const transports = new Map();

function createGmailServer(accessToken) {
  const server = new McpServer({ name: 'gmail-mcp', version: '1.0.0' });
  
  const gmailApi = async (endpoint, options = {}) => {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gmail API error: ${response.status} - ${error}`);
    }

    return await response.json();
  };

  server.tool(
    'list_unread_emails',
    'List unread emails from inbox. Returns up to 100 emails per call. Use pageToken to get more.',
    { 
      maxResults: z.number().optional().describe('Maximum number of emails to return (default: 50, max: 100)'),
      query: z.string().optional().describe('Additional Gmail search query (e.g., "from:example@gmail.com")'),
      pageToken: z.string().optional().describe('Page token from previous call to get next batch of emails')
    },
    async ({ maxResults = 50, query, pageToken }) => {
      const searchQuery = query ? `is:unread in:inbox ${query}` : 'is:unread in:inbox';
      
      let url = `/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=${Math.min(maxResults, 100)}`;
      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }
      
      const response = await gmailApi(url);

      const messages = response.messages || [];
      const emails = [];

      for (const message of messages) {
        const details = await gmailApi(
          `/users/me/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
        );

        const headers = details.payload?.headers || [];
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No subject)';
        const date = headers.find(h => h.name === 'Date')?.value || 'Unknown';

        emails.push({
          id: message.id,
          from,
          subject,
          date,
          snippet: details.snippet || ''
        });
      }

      const result = { 
        count: emails.length, 
        emails,
        resultSizeEstimate: response.resultSizeEstimate,
        nextPageToken: response.nextPageToken || null
      };

      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify(result, null, 2) 
        }] 
      };
    }
  );

  server.tool(
    'list_all_unread_emails',
    'List all unread emails from inbox (up to specified limit, good for bulk operations)',
    { 
      query: z.string().optional().describe('Additional Gmail search query'),
      maxTotal: z.number().optional().describe('Maximum emails to return (default: 30, max: 50 to avoid timeouts)')
    },
    async ({ query, maxTotal = 30 }) => {
      const limit = Math.min(maxTotal, 50);
      const searchQuery = query ? `is:unread in:inbox ${query}` : 'is:unread in:inbox';
      const allEmails = [];
      let pageToken = null;
      let totalFetched = 0;
      
      while (totalFetched < limit) {
        const batchSize = Math.min(50, limit - totalFetched);
        let url = `/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=${batchSize}`;
        if (pageToken) {
          url += `&pageToken=${pageToken}`;
        }
        
        const response = await gmailApi(url);
        const messages = response.messages || [];
        
        if (messages.length === 0) break;
        
        for (const message of messages) {
          const details = await gmailApi(
            `/users/me/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
          );

          const headers = details.payload?.headers || [];
          const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
          const subject = headers.find(h => h.name === 'Subject')?.value || '(No subject)';
          const date = headers.find(h => h.name === 'Date')?.value || 'Unknown';

          allEmails.push({
            id: message.id,
            from,
            subject,
            date,
            snippet: details.snippet || ''
          });
        }
        
        totalFetched += messages.length;
        pageToken = response.nextPageToken;
        
        if (!pageToken) break;
      }

      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ 
            count: allEmails.length, 
            emails: allEmails,
            note: allEmails.length >= limit ? `Showing first ${limit} emails. Use list_unread_emails with pageToken for more, or increase maxTotal (max 50).` : 'All unread emails retrieved'
          }, null, 2) 
        }] 
      };
    }
  );

  server.tool(
    'get_email_body',
    'Get full email body content',
    { 
      emailId: z.string().describe('Email ID from list_unread_emails')
    },
    async ({ emailId }) => {
      const message = await gmailApi(`/users/me/messages/${emailId}?format=full`);

      const headers = message.payload?.headers || [];
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const subject = headers.find(h => h.name === 'Subject')?.value || '(No subject)';
      const to = headers.find(h => h.name === 'To')?.value || 'Unknown';
      const date = headers.find(h => h.name === 'Date')?.value || 'Unknown';

      let body = '';
      
      if (message.payload?.body?.data) {
        body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
      } else if (message.payload?.parts) {
        const textPart = message.payload.parts.find(
          part => part.mimeType === 'text/plain' || part.mimeType === 'text/html'
        );
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      }

      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ 
            id: emailId,
            from,
            to,
            subject,
            date,
            body: body.substring(0, 10000)
          }, null, 2) 
        }] 
      };
    }
  );

  server.tool(
    'create_label',
    'Create a new Gmail label or get existing label ID',
    { 
      name: z.string().describe('Label name to create (e.g., "SPAM DETECTED")')
    },
    async ({ name }) => {
      try {
        // Try to create the label
        const response = await gmailApi('/users/me/labels', {
          method: 'POST',
          body: JSON.stringify({
            name: name,
            labelListVisibility: 'labelShow',
            messageListVisibility: 'show'
          })
        });

        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              id: response.id, 
              name: response.name,
              status: 'created'
            }, null, 2) 
          }] 
        };
      } catch (error) {
        // If label already exists, find it
        if (error.message.includes('409') || error.message.includes('already exists')) {
          const labels = await gmailApi('/users/me/labels');
          const existingLabel = labels.labels.find(l => l.name === name);
          
          if (existingLabel) {
            return { 
              content: [{ 
                type: 'text', 
                text: JSON.stringify({ 
                  id: existingLabel.id, 
                  name: existingLabel.name,
                  status: 'already_exists'
                }, null, 2) 
              }] 
            };
          }
        }
        throw error;
      }
    }
  );

  server.tool(
    'mark_as_spam',
    'Mark an email as spam and move to spam folder (keeps email as unread). Optionally add custom label.',
    { 
      emailId: z.string().describe('Email ID to mark as spam'),
      customLabel: z.string().optional().describe('Optional custom label name to add (e.g., "SPAM DETECTED")')
    },
    async ({ emailId, customLabel }) => {
      const addLabelIds = ['SPAM'];
      
      // If custom label is provided, create it if needed and add it
      if (customLabel) {
        try {
          // First try to get existing labels
          const labelsResponse = await gmailApi('/users/me/labels');
          let labelId = labelsResponse.labels.find(l => l.name === customLabel)?.id;
          
          // If label doesn't exist, create it
          if (!labelId) {
            const createResponse = await gmailApi('/users/me/labels', {
              method: 'POST',
              body: JSON.stringify({
                name: customLabel,
                labelListVisibility: 'labelShow',
                messageListVisibility: 'show'
              })
            });
            labelId = createResponse.id;
          }
          
          addLabelIds.push(labelId);
        } catch (error) {
          // Continue without custom label if there's an error
          console.error('Error adding custom label:', error.message);
        }
      }

      await gmailApi(`/users/me/messages/${emailId}/modify`, {
        method: 'POST',
        body: JSON.stringify({
          addLabelIds,
          removeLabelIds: ['INBOX']
        })
      });

      return { 
        content: [{ 
          type: 'text', 
          text: customLabel 
            ? `Email ${emailId} marked as spam with label "${customLabel}" (kept as unread)` 
            : `Email ${emailId} marked as spam (kept as unread)` 
        }] 
      };
    }
  );

  server.tool(
    'mark_as_read',
    'Mark an email as read',
    { 
      emailId: z.string().describe('Email ID to mark as read')
    },
    async ({ emailId }) => {
      await gmailApi(`/users/me/messages/${emailId}/modify`, {
        method: 'POST',
        body: JSON.stringify({
          removeLabelIds: ['UNREAD']
        })
      });

      return { 
        content: [{ 
          type: 'text', 
          text: `Email ${emailId} marked as read` 
        }] 
      };
    }
  );

  server.tool(
    'mark_as_important',
    'Mark an email as important/starred',
    { 
      emailId: z.string().describe('Email ID to mark as important')
    },
    async ({ emailId }) => {
      await gmailApi(`/users/me/messages/${emailId}/modify`, {
        method: 'POST',
        body: JSON.stringify({
          addLabelIds: ['IMPORTANT', 'STARRED']
        })
      });

      return { 
        content: [{ 
          type: 'text', 
          text: `Email ${emailId} marked as important` 
        }] 
      };
    }
  );

  return server;
}

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  let transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    const accessToken = req.headers['authorization']?.replace('Bearer ', '');
    
    if (!accessToken) {
      return res.status(401).json({ 
        error: 'unauthorized',
        message: 'Missing OAuth access token. Provide via Authorization: Bearer <token> header.' 
      });
    }

    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => { transports.set(sid, transport); }
    });
    
    const server = createGmailServer(accessToken);
    await server.connect(transport);
  }

  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) return res.status(400).send('Invalid session');
  await transport.handleRequest(req, res);
});

const port = process.env.PORT || 3800;
app.listen(port, () => console.log(`[gmail-mcp] listening on :${port}`));

