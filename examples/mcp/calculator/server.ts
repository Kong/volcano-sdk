import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

function createCalculatorServer() {
  const server = new McpServer({ name: 'calculator', version: '1.0.0' });

  server.tool(
    'calculate',
    'Evaluate a mathematical expression',
    { expression: z.string().describe('Math expression like "2 + 2" or "sqrt(16)"') },
    async ({ expression }) => {
      try {
        // Safe math evaluation (limited subset)
        const sanitized = expression
          .replace(/[^0-9+\-*/().%\s]/g, '')
          .trim();
        
        // Using Function constructor for safe eval of math only
        const result = new Function(`return ${sanitized}`)();
        
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ expression, result }) 
          }] 
        };
      } catch {
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Invalid expression' }) 
          }] 
        };
      }
    }
  );

  server.tool(
    'convert_units',
    'Convert between units',
    { 
      value: z.number(),
      from: z.string().describe('Source unit (e.g., "km", "lb", "C")'),
      to: z.string().describe('Target unit (e.g., "miles", "kg", "F")')
    },
    async ({ value, from, to }) => {
      const conversions: Record<string, Record<string, number>> = {
        // Distance
        'km': { 'miles': 0.621371, 'm': 1000, 'ft': 3280.84 },
        'miles': { 'km': 1.60934, 'm': 1609.34, 'ft': 5280 },
        'm': { 'km': 0.001, 'miles': 0.000621371, 'ft': 3.28084 },
        'ft': { 'm': 0.3048, 'km': 0.0003048, 'miles': 0.000189394 },
        
        // Weight
        'kg': { 'lb': 2.20462, 'g': 1000 },
        'lb': { 'kg': 0.453592, 'g': 453.592 },
        'g': { 'kg': 0.001, 'lb': 0.00220462 },
        
        // Temperature (special handling)
        'C': { 'F': (v: number) => v * 9/5 + 32, 'K': (v: number) => v + 273.15 },
        'F': { 'C': (v: number) => (v - 32) * 5/9, 'K': (v: number) => (v - 32) * 5/9 + 273.15 },
        'K': { 'C': (v: number) => v - 273.15, 'F': (v: number) => (v - 273.15) * 9/5 + 32 }
      };

      const conversion = conversions[from]?.[to];
      if (!conversion) {
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Conversion not supported' }) 
          }] 
        };
      }

      const result = typeof conversion === 'function' 
        ? conversion(value) 
        : value * conversion;

      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ value, from, to, result: Math.round(result * 100) / 100 }) 
        }] 
      };
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
    await createCalculatorServer().connect(transport);
  }

  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) return res.status(400).send('Invalid session');
  await transport.handleRequest(req, res);
});

const PORT = 8004;
app.listen(PORT, () => {
  console.log(`🔢 Calculator MCP server running on http://localhost:${PORT}/mcp`);
});

