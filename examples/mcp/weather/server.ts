import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

const weatherData: Record<string, { temp: number; condition: string; rain: boolean }> = {
  'seattle': { temp: 58, condition: 'Rainy', rain: true },
  'san francisco': { temp: 65, condition: 'Partly cloudy', rain: false },
  'new york': { temp: 72, condition: 'Sunny', rain: false },
  'miami': { temp: 85, condition: 'Hot and humid', rain: false },
  'chicago': { temp: 68, condition: 'Windy', rain: false }
};

function createWeatherServer() {
  const server = new McpServer({ name: 'weather', version: '1.0.0' });

  server.tool(
    'get_weather',
    'Get current weather for a city',
    { 
      city: z.string().describe('City name'),
      unit: z.enum(['celsius', 'fahrenheit']).optional()
    },
    async ({ city, unit = 'fahrenheit' }) => {
      const weather = weatherData[city.toLowerCase()] || { temp: 70, condition: 'Unknown', rain: false };
      const temp = unit === 'celsius' ? Math.round((weather.temp - 32) * 5 / 9) : weather.temp;
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            city,
            temperature: `${temp}°${unit[0].toUpperCase()}`,
            condition: weather.condition,
            rain: weather.rain
          })
        }] 
      };
    }
  );

  server.tool(
    'get_forecast',
    'Get 3-day forecast',
    { city: z.string() },
    async ({ city }) => {
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            city,
            forecast: [
              { day: 'Today', high: 72, low: 58, condition: 'Sunny' },
              { day: 'Tomorrow', high: 75, low: 60, condition: 'Partly cloudy' },
              { day: 'Day after', high: 70, low: 55, condition: 'Cloudy' }
            ]
          })
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
    await createWeatherServer().connect(transport);
  }

  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) return res.status(400).send('Invalid session');
  await transport.handleRequest(req, res);
});

const PORT = 8001;
app.listen(PORT, () => {
  console.log(`🌤️  Weather MCP server running on http://localhost:${PORT}/mcp`);
});

