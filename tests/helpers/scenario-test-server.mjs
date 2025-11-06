import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const app = express();
app.use(express.json());

const transports = new Map();
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function createServer() {
  const server = new McpServer({ name: 'scenario-test', version: '1.0.0' });
  
  // Tool with ID parameter
  server.tool(
    'process_email',
    'Process an email by ID',
    { 
      emailId: z.string().describe('Email ID'),
      action: z.string().optional().describe('Action to perform')
    },
    async ({ emailId, action }) => {
      await delay(150);
      return { 
        content: [{ 
          type: 'text', 
          text: `Processed email ${emailId}: ${action || 'default'}`
        }] 
      };
    }
  );
  
  // Tool without ID parameter
  server.tool(
    'send_notification',
    'Send a notification',
    { 
      message: z.string().describe('Notification message')
    },
    async ({ message }) => {
      await delay(100);
      return { 
        content: [{ 
          type: 'text', 
          text: `Sent notification: ${message}`
        }] 
      };
    }
  );
  
  // Tool with userId parameter
  server.tool(
    'fetch_profile',
    'Fetch user profile',
    { 
      userId: z.string().describe('User ID')
    },
    async ({ userId }) => {
      await delay(120);
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ userId, name: `User ${userId}`, active: true })
        }] 
      };
    }
  );
  
  // Tool with itemId parameter
  server.tool(
    'archive_item',
    'Archive an item',
    { 
      itemId: z.string().describe('Item ID')
    },
    async ({ itemId }) => {
      await delay(100);
      return { 
        content: [{ 
          type: 'text', 
          text: `Archived item ${itemId}`
        }] 
      };
    }
  );
  
  return server;
}

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] || 'default';
  let transport = transports.get(sessionId);
  
  if (!transport) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      onsessioninitialized: (sid) => { transports.set(sid, transport); }
    });
    const server = createServer();
    await server.connect(transport);
  }
  
  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] || 'default';
  const transport = transports.get(sessionId);
  if (!transport) return res.status(400).send('Invalid session');
  await transport.handleRequest(req, res);
});

const port = process.env.PORT || 3897;
app.listen(port, () => console.log(`[scenario-test-server] Ready on :${port}`));

