#!/usr/bin/env node
// Simple STDIO MCP Server for testing
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ 
  name: 'stdio-test-server', 
  version: '1.0.0' 
});

// Add a simple tool
server.tool(
  'get_time',
  'Get current time',
  {
    timezone: z.string().optional().describe('Timezone (e.g., America/New_York)')
  },
  async ({ timezone }) => {
    const now = new Date();
    const timeStr = timezone 
      ? now.toLocaleString('en-US', { timeZone: timezone })
      : now.toISOString();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ time: timeStr, timezone: timezone || 'UTC' })
      }]
    };
  }
);

server.tool(
  'reverse_string',
  'Reverse a string',
  {
    text: z.string().describe('Text to reverse')
  },
  async ({ text }) => {
    const reversed = text.split('').reverse().join('');
    return {
      content: [{
        type: 'text',
        text: reversed
      }]
    };
  }
);

// Connect via STDIO
const transport = new StdioServerTransport();
await server.connect(transport);

// Keep process alive
process.stdin.resume();
