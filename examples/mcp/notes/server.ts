import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

const notes: Array<{ id: string; title: string; content: string; tags: string[] }> = [];

function createNotesServer() {
  const server = new McpServer({ name: 'notes', version: '1.0.0' });

  server.tool(
    'create_note',
    'Create a new note',
    { 
      title: z.string(),
      content: z.string(),
      tags: z.array(z.string()).optional()
    },
    async ({ title, content, tags = [] }) => {
      const note = { id: randomUUID(), title, content, tags };
      notes.push(note);
      return { content: [{ type: 'text', text: JSON.stringify(note) }] };
    }
  );

  server.tool(
    'search_notes',
    'Search notes by keyword',
    { query: z.string() },
    async ({ query }) => {
      const matches = notes.filter(n => 
        n.title.toLowerCase().includes(query.toLowerCase()) ||
        n.content.toLowerCase().includes(query.toLowerCase()) ||
        n.tags.some(t => t.toLowerCase().includes(query.toLowerCase()))
      );
      return { content: [{ type: 'text', text: JSON.stringify(matches) }] };
    }
  );

  server.tool(
    'get_note',
    'Get a note by ID',
    { noteId: z.string() },
    async ({ noteId }) => {
      const note = notes.find(n => n.id === noteId);
      if (note) {
        return { content: [{ type: 'text', text: JSON.stringify(note) }] };
      }
      return { content: [{ type: 'text', text: 'Note not found' }] };
    }
  );

  server.tool(
    'list_all_notes',
    'List all notes',
    {},
    async () => {
      return { content: [{ type: 'text', text: JSON.stringify(notes) }] };
    }
  );

  return server;
}

const app = express();
app.use(express.json());
app.use(cors({ origin: '*', exposedHeaders: ['Mcp-Session-Id'] }));

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
    await createNotesServer().connect(transport);
  }

  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) return res.status(400).send('Invalid session');
  await transport.handleRequest(req, res);
});

const PORT = 8003;
app.listen(PORT, () => {
  console.log(`📝 Notes MCP server running on http://localhost:${PORT}/mcp`);
});

