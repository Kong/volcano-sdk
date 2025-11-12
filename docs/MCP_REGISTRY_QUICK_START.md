# MCP Registry - Quick Start

A modular system for managing custom MCP servers in Volcano SDK.

## Installation

```bash
npm install volcano-sdk
```

## Basic Usage

```typescript
import { agent, llmOpenAI, mcpRegistry } from 'volcano-sdk';

// 1. Register your MCP servers
mcpRegistry.register({
  id: 'weather-api',
  name: 'Weather Service',
  transport: 'http',
  url: 'http://localhost:3000/mcp',
  tags: ['weather', 'api']
});

// 2. Use them with an agent
const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini' 
});

const handles = mcpRegistry.getHandles();

const results = await agent({ llm })
  .then({
    prompt: 'What is the weather in San Francisco?',
    mcps: handles
  })
  .run();

console.log(results[0].llmOutput);
```

## Register ScrapeGraphAI (from Smithery)

```typescript
// Register the ScrapeGraphAI MCP server from Smithery.ai
mcpRegistry.register({
  id: 'scrapegraph-ai',
  name: 'ScrapeGraphAI',
  description: 'AI-powered web scraping',
  transport: 'stdio',
  stdio: {
    command: 'npx',
    args: ['-y', '@smithery/scrapegraph-mcp@latest']
  },
  tags: ['scraping', 'web', 'ai']
});

// Use it to scrape websites
const scrapeHandle = mcpRegistry.getHandle('scrapegraph-ai');

const results = await agent({ llm })
  .then({
    prompt: 'Extract the main headline from https://news.ycombinator.com',
    mcps: [scrapeHandle!],
    timeout: 30
  })
  .run();
```

## Load from Configuration

```typescript
import { loadMCPConfig } from 'volcano-sdk';

const config = {
  servers: [
    {
      id: 'weather',
      name: 'Weather API',
      transport: 'http',
      url: 'http://localhost:3000/mcp',
      tags: ['weather']
    },
    {
      id: 'scrapegraph-ai',
      name: 'ScrapeGraphAI',
      transport: 'stdio',
      stdio: {
        command: 'npx',
        args: ['-y', '@smithery/scrapegraph-mcp@latest']
      },
      tags: ['scraping', 'ai']
    }
  ]
};

const handles = loadMCPConfig(config);
console.log(`Registered ${handles.size} servers`);
```

## Filter and Manage

```typescript
// Filter by tags
const scrapingServers = mcpRegistry.list({ tags: ['scraping'] });

// Get only enabled servers
const enabled = mcpRegistry.list({ enabledOnly: true });

// Temporarily disable a server
mcpRegistry.update('weather', { enabled: false });

// Get statistics
const stats = mcpRegistry.stats();
console.log(`Total: ${stats.total}, Enabled: ${stats.enabled}`);
```

## Cleanup

```typescript
// Cleanup on shutdown (important for stdio servers)
process.on('SIGTERM', async () => {
  await mcpRegistry.unregisterAll();
  process.exit(0);
});
```

## Key Features

- ✅ **Modular Registration** - Register HTTP and stdio MCP servers
- 🏷️ **Tagging & Filtering** - Organize servers with tags
- 🔐 **Authentication** - OAuth and Bearer token support
- 📊 **Statistics** - Monitor registered servers
- 🧹 **Lifecycle Management** - Enable, disable, and cleanup
- 🧪 **Testing** - Isolated registries for tests

## Full Documentation

- [Complete MCP Registry Documentation](./MCP_REGISTRY.md)
- [API Reference](./MCP_REGISTRY.md#api-reference)
- [Advanced Patterns](./MCP_REGISTRY.md#advanced-patterns)

## Examples

- [`examples/mcp-registry.ts`](../examples/mcp-registry.ts) - Complete feature tour
- [`examples/mcp-registry-scrapegraph.ts`](../examples/mcp-registry-scrapegraph.ts) - ScrapeGraphAI integration
- [`tests/mcp.registry.test.ts`](../tests/mcp.registry.test.ts) - Test suite

## Links

- [Smithery.ai MCP Servers](https://smithery.ai)
- [ScrapeGraphAI MCP Server](https://smithery.ai/server/@ScrapeGraphAI/scrapegraph-mcp)
- [Model Context Protocol](https://modelcontextprotocol.io)

