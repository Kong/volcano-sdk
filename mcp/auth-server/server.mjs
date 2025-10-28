// MCP Server with OAuth Authentication
import express from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Support form-encoded OAuth token requests (RFC 6749)

const transports = new Map();

// OAuth token storage (in production, this would be a proper OAuth server)
const VALID_TOKENS = new Set([
  'test-oauth-token-12345',
  'Bearer test-oauth-token-12345'
]);

// Middleware to check OAuth authentication
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'unauthorized',
      message: 'Missing Authorization header. OAuth token required.' 
    });
  }
  
  // Check if token is valid
  if (!VALID_TOKENS.has(authHeader)) {
    return res.status(401).json({ 
      error: 'unauthorized',
      message: 'Invalid OAuth token' 
    });
  }
  
  next();
}

function getAuthServer() {
  const server = new McpServer({ name: 'auth-mcp', version: '1.0.0' });
  
  server.tool(
    'get_weather',
    'Get current weather for a city',
    { city: z.string().describe('City name') },
    async ({ city }) => {
      // Mock weather data
      const weather = {
        'San Francisco': { temp: 65, condition: 'Foggy' },
        'New York': { temp: 72, condition: 'Sunny' },
        'London': { temp: 58, condition: 'Rainy' },
      }[city] || { temp: 70, condition: 'Clear' };
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify(weather) 
        }] 
      };
    }
  );
  
  return server;
}

// Apply auth middleware to all MCP endpoints
app.post('/mcp', requireAuth, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  let transport = sessionId ? transports.get(sessionId) : undefined;
  
  if (!transport) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => transports.set(sid, transport)
    });
    const server = getAuthServer();
    await server.connect(transport);
  }
  
  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', requireAuth, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) return res.status(400).send('Invalid session');
  await transport.handleRequest(req, res);
});

// OAuth token endpoint (simplified for testing)
app.post('/oauth/token', (req, res) => {
  const { grant_type, client_id, client_secret } = req.body;
  
  // Simplified OAuth flow
  if (grant_type === 'client_credentials' && 
      client_id === 'test-client' && 
      client_secret === 'test-secret') {
    return res.json({
      access_token: 'test-oauth-token-12345',
      token_type: 'Bearer',
      expires_in: 3600
    });
  }
  
  res.status(401).json({ error: 'invalid_client' });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3301;
app.listen(port, () => console.log(`[auth-mcp] listening on :${port}`));
