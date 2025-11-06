import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const app = express();
app.use(express.json());

const transports = new Map();
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function createServer() {
  const server = new McpServer({ name: 'parallel-provider-test', version: '1.0.0' });
  
  server.tool(
    'mark_item',
    'Mark an item (simulates batch operation)',
    { 
      itemId: z.string().describe('Item ID to mark'),
      status: z.string().optional().describe('Status to set')
    },
    async ({ itemId, status }) => {
      await delay(100); // Simulate work
      return { 
        content: [{ 
          type: 'text', 
          text: `Marked item ${itemId} as ${status || 'processed'}`
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

const port = process.env.PORT || 3898;
app.listen(port, () => console.log(`[provider-test-server] Ready on :${port}`));

