import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

const tasks: Array<{ id: string; title: string; priority: string; done: boolean }> = [];

function createTaskServer() {
  const server = new McpServer({ name: 'tasks', version: '1.0.0' });

  server.tool(
    'create_task',
    'Create a new task',
    { 
      title: z.string(),
      priority: z.enum(['low', 'medium', 'high']).optional()
    },
    async ({ title, priority = 'medium' }) => {
      const task = { id: randomUUID(), title, priority, done: false };
      tasks.push(task);
      return { content: [{ type: 'text', text: JSON.stringify(task) }] };
    }
  );

  server.tool(
    'list_tasks',
    'List all tasks',
    { filter: z.enum(['all', 'pending', 'completed']).optional() },
    async ({ filter = 'all' }) => {
      let filtered = tasks;
      if (filter === 'pending') filtered = tasks.filter(t => !t.done);
      if (filter === 'completed') filtered = tasks.filter(t => t.done);
      return { content: [{ type: 'text', text: JSON.stringify(filtered) }] };
    }
  );

  server.tool(
    'complete_task',
    'Mark a task as completed',
    { taskId: z.string() },
    async ({ taskId }) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.done = true;
        return { content: [{ type: 'text', text: JSON.stringify(task) }] };
      }
      return { content: [{ type: 'text', text: 'Task not found' }] };
    }
  );

  return server;
}

const app = express();
app.use(express.json());
// Note: This is a local development example server
// In production, configure CORS to only allow specific origins
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' ? allowedOrigins : '*',
  exposedHeaders: ['Mcp-Session-Id'] 
}));

const transports = new Map();

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  let transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    if (!isInitializeRequest(req.body)) {
      return res.status(400).json({ error: 'Missing initialization' });
    }
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => transports.set(sid, transport)
    });
    await createTaskServer().connect(transport);
  }

  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) return res.status(400).send('Invalid session');
  await transport.handleRequest(req, res);
});

const PORT = 8002;
app.listen(PORT, () => {
  console.log(`✅ Tasks MCP server running on http://localhost:${PORT}/mcp`);
});

