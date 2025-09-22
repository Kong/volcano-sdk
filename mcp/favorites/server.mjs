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

function getFavoritesServer() {
  const server = new McpServer({ name: 'favorites-mcp', version: '1.0.0' });
  server.tool(
    'get_preferences',
    'Return favorite food and drink given an astrological sign',
    { sign: z.string().describe('Astrological sign, e.g., Aries') },
    async ({ sign }) => {
      const prefs = preferencesFor(sign);
      return { content: [{ type: 'text', text: JSON.stringify(prefs) }] };
    }
  );
  return server;
}

function preferencesFor(sign) {
  const map = {
    Aries: { food: 'Spicy ramen', drink: 'Espresso' },
    Taurus: { food: 'Steak frites', drink: 'Red wine' },
    Gemini: { food: 'Tapas', drink: 'Mojito' },
    Cancer: { food: 'Clam chowder', drink: 'Chai latte' },
    Leo: { food: 'Truffle pasta', drink: 'Old Fashioned' },
    Virgo: { food: 'Quinoa salad', drink: 'Green tea' },
    Libra: { food: 'Sushi', drink: 'Sake' },
    Scorpio: { food: 'BBQ brisket', drink: 'Negroni' },
    Sagittarius: { food: 'Curry', drink: 'IPA' },
    Capricorn: { food: 'Roast lamb', drink: 'Cabernet' },
    Aquarius: { food: 'Vegan bowl', drink: 'Kombucha' },
    Pisces: { food: 'Seafood risotto', drink: 'Pinot Grigio' }
  };
  return map[sign] || { food: 'Pizza', drink: 'Water' };
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
    const server = getFavoritesServer();
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

const port = process.env.PORT ? Number(process.env.PORT) : 3202;
app.listen(port, () => console.log(`[favorites-mcp] listening on :${port}`));
