import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const app = express();
app.use(express.json());

const transports = new Map();

// Simulate delay to make parallel vs sequential visible
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function createTestServer() {
  const server = new McpServer({ name: 'parallel-test', version: '1.0.0' });
  
  // Tool 1: Process item (simulates work)
  server.tool(
    'process_item',
    'Process an item by ID (takes 200ms)',
    { 
      itemId: z.string().describe('Item ID to process')
    },
    async ({ itemId }) => {
      await delay(200); // Simulate work
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ itemId, processed: true, timestamp: Date.now() })
        }] 
      };
    }
  );
  
  // Tool 2: Get item (fast read operation)
  server.tool(
    'get_item',
    'Get item details by ID',
    { 
      itemId: z.string().describe('Item ID')
    },
    async ({ itemId }) => {
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ itemId, name: `Item ${itemId}`, value: 100 })
        }] 
      };
    }
  );
  
  // Tool 3: Create item (state mutation)
  server.tool(
    'create_item',
    'Create a new item',
    { 
      name: z.string().describe('Item name')
    },
    async ({ name }) => {
      await delay(100);
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ id: Math.random().toString(36).substr(2, 9), name })
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
    const server = createTestServer();
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

const port = process.env.PORT || 3899;
app.listen(port, () => console.log(`[parallel-test-server] Ready on :${port}`));

