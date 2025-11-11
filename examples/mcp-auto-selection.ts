import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { agent, llmOpenAI, mcp, createVolcanoTelemetry } from "../dist/volcano-sdk.js";

function createWeatherServer() {
  const server = new McpServer({ name: 'weather-mcp', version: '1.0.0' });
  
  const weatherData: Record<string, { temp: number; condition: string; rain: boolean }> = {
    'san francisco': { temp: 65, condition: 'Partly cloudy', rain: false },
    'new york': { temp: 72, condition: 'Sunny', rain: false },
    'seattle': { temp: 58, condition: 'Rainy', rain: true },
    'miami': { temp: 85, condition: 'Hot and humid', rain: false },
    'chicago': { temp: 68, condition: 'Windy', rain: false }
  };

  server.tool(
    'get_weather',
    'Get current weather for a city',
    { 
      city: z.string().describe('City name, e.g., San Francisco'),
      unit: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature unit')
    },
    async ({ city, unit = 'fahrenheit' }) => {
      const cityKey = city.toLowerCase();
      const weather = weatherData[cityKey] || { temp: 70, condition: 'Unknown', rain: false };
      
      const temp = unit === 'celsius' 
        ? Math.round((weather.temp - 32) * 5 / 9)
        : weather.temp;
      
      const result = {
        city,
        temperature: `${temp}°${unit === 'celsius' ? 'C' : 'F'}`,
        condition: weather.condition,
        willRain: weather.rain,
        forecast: weather.rain ? 'Bring an umbrella!' : 'No rain expected'
      };
      
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'get_forecast',
    'Get 3-day weather forecast',
    { city: z.string().describe('City name') },
    async ({ city }) => {
      const forecast = [
        { day: 'Today', high: 72, low: 58, condition: 'Sunny' },
        { day: 'Tomorrow', high: 75, low: 60, condition: 'Partly cloudy' },
        { day: 'Day after', high: 70, low: 55, condition: 'Cloudy' }
      ];
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ city, forecast }) 
        }] 
      };
    }
  );
  
  return server;
}

function createTaskServer() {
  const server = new McpServer({ name: 'tasks-mcp', version: '1.0.0' });
  
  const tasks: Array<{ id: string; title: string; priority: string; done: boolean }> = [];

  server.tool(
    'create_task',
    'Create a new task',
    { 
      title: z.string().describe('Task title'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority')
    },
    async ({ title, priority = 'medium' }) => {
      const task = {
        id: randomUUID(),
        title,
        priority,
        done: false
      };
      tasks.push(task);
      
      return { content: [{ type: 'text', text: JSON.stringify(task) }] };
    }
  );

  server.tool(
    'list_tasks',
    'List all tasks',
    { 
      filter: z.enum(['all', 'pending', 'completed']).optional().describe('Filter tasks')
    },
    async ({ filter = 'all' }) => {
      let filtered = tasks;
      if (filter === 'pending') filtered = tasks.filter(t => !t.done);
      if (filter === 'completed') filtered = tasks.filter(t => t.done);
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ count: filtered.length, tasks: filtered }) 
        }] 
      };
    }
  );

  server.tool(
    'complete_task',
    'Mark a task as completed',
    { taskId: z.string().describe('Task ID') },
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

function startMCPServer(serverFactory: () => McpServer, port: number, name: string) {
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
        onsessioninitialized: (sid) => { transports.set(sid, transport); }
      });
      const server = serverFactory();
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

  const server = app.listen(port, () => {
    console.log(`✅ [${name}] MCP server running on http://localhost:${port}/mcp`);
  });

  return server;
}

async function main() {
  const weatherServer = startMCPServer(createWeatherServer, 8001, 'weather');
  const tasksServer = startMCPServer(createTaskServer, 8002, 'tasks');

  await new Promise(resolve => setTimeout(resolve, 1000));

  const cleanup = () => {
    console.log('\n\n🧹 Shutting down MCP servers...');
    weatherServer.close();
    tasksServer.close();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    const llm = llmOpenAI({ 
      apiKey: process.env.OPENAI_API_KEY!, 
      model: "gpt-4o-mini" 
    });

    const telemetry = createVolcanoTelemetry({
      serviceName: 'volcano-local-test',
      endpoint: 'http://localhost:4318'
    });

    const weatherMcp = mcp('http://localhost:8001/mcp');
    const tasksMcp = mcp('http://localhost:8002/mcp');

    const results = await agent({ 
      llm, 
      telemetry,
      instructions: "You are a helpful assistant. Use the available tools to complete tasks efficiently."
    })
      .then({
        prompt: "What's the weather like in Seattle? Should I bring an umbrella?",
        mcps: [weatherMcp],
        maxToolIterations: 2
      })
      .then({
        prompt: "Based on the weather forecast, create high-priority tasks for anything weather-related I should prepare for",
        mcps: [weatherMcp, tasksMcp],
        maxToolIterations: 3
      })
      .then({
        prompt: "Show me all my pending tasks",
        mcps: [tasksMcp],
        maxToolIterations: 1
      })
      .run();

    console.log(`\nComplete! ${results.length} steps, ${results.reduce((acc, r) => acc + (r.toolCalls?.length || 0), 0)} tools used`);

    
    cleanup();

  } catch (error) {
    console.error('\nError:', error);
    cleanup();
  }
}

if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY required');
  process.exit(1);
}

main();

