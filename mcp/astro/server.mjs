import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

const app = express();
app.use(express.json());
app.use(cors({ origin: '*', exposedHeaders: ['Mcp-Session-Id'] }));

const transports = new Map();

function getAstroServer() {
  const server = new McpServer({ name: 'astro-mcp', version: '1.0.0' });
  server.tool(
    'get_sign',
    'Return astrological sign for a birthdate (YYYY-MM-DD)',
    { birthdate: z.string().describe('Birthdate in YYYY-MM-DD') },
    async ({ birthdate }) => {
      const sign = zodiacForDate(birthdate);
      return { content: [{ type: 'text', text: sign }] };
    }
  );
  return server;
}

function zodiacForDate(dateStr) {
  const d = new Date(dateStr);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const ranges = [
    ['Capricorn', 12, 22, 1, 19],
    ['Aquarius', 1, 20, 2, 18],
    ['Pisces', 2, 19, 3, 20],
    ['Aries', 3, 21, 4, 19],
    ['Taurus', 4, 20, 5, 20],
    ['Gemini', 5, 21, 6, 20],
    ['Cancer', 6, 21, 7, 22],
    ['Leo', 7, 23, 8, 22],
    ['Virgo', 8, 23, 9, 22],
    ['Libra', 9, 23, 10, 22],
    ['Scorpio', 10, 23, 11, 21],
    ['Sagittarius', 11, 22, 12, 21]
  ];
  for (const [name, sm, sd, em, ed] of ranges) {
    const inRange =
      (m === sm && day >= sd) ||
      (m === em && day <= ed) ||
      (sm < em && m > sm && m < em) ||
      (sm > em && (m > sm || m < em));
    if (inRange) return name;
  }
  return 'Unknown';
}

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  let transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    if (!isInitializeRequest(req.body)) {
      return res.status(400).json({ error: 'Missing initialization for session' });
    }
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => transports.set(sid, transport)
    });
    const server = getAstroServer();
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

const port = process.env.PORT ? Number(process.env.PORT) : 3201;
app.listen(port, () => console.log(`[astro-mcp] listening on :${port}`));
