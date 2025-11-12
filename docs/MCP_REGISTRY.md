# MCP Registry

The **MCP Registry** is a modular system for managing custom MCP servers in an organized and scalable way.

## 🎯 Features

- **Modular registration** of HTTP and stdio MCP servers
- **Complete lifecycle management** (registration, updates, cleanup)
- **Advanced filtering** by tags, transport, and status
- **Authentication support** for OAuth and Bearer tokens
- **Real-time statistics** and monitoring
- **Isolation** with multiple registries for testing
- **Configuration loading** from JSON/objects

## 📦 Installation

MCP Registry is included in Volcano SDK:

```typescript
import { mcpRegistry, MCPServerConfig } from 'volcano-sdk';
```

## 🚀 Quick Start

### Register an HTTP server

```typescript
import { mcpRegistry } from 'volcano-sdk';

// Register an MCP server via HTTP
mcpRegistry.register({
  id: 'weather-api',
  name: 'Weather Service',
  description: 'Provides weather forecasts',
  transport: 'http',
  url: 'http://localhost:3000/mcp',
  tags: ['weather', 'api']
});
```

### Register a stdio server

```typescript
// Register an MCP server via stdio (local process)
mcpRegistry.register({
  id: 'file-tools',
  name: 'File Operations',
  transport: 'stdio',
  stdio: {
    command: 'node',
    args: ['./tools/file-server.js']
  },
  tags: ['files', 'local']
});
```

### Use with an agent

```typescript
import { agent, llmOpenAI, mcpRegistry } from 'volcano-sdk';

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini' 
});

// Get all registered handles
const allHandles = mcpRegistry.getHandles();

// Use with the agent
const results = await agent({ llm })
  .then({
    prompt: 'What tools do I have available?',
    mcps: allHandles
  })
  .run();
```

## 📚 Practical Examples

### Example 1: ScrapeGraphAI from Smithery

Register and use the [ScrapeGraphAI](https://smithery.ai/server/@ScrapeGraphAI/scrapegraph-mcp) MCP server:

```typescript
// Register ScrapeGraphAI
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

// Use with an agent
const scrapeHandle = mcpRegistry.getHandle('scrapegraph-ai');

const results = await agent({ llm })
  .then({
    prompt: 'Extract the main headline from https://example.com',
    mcps: [scrapeHandle!]
  })
  .run();
```

### Example 2: OAuth Authentication

```typescript
mcpRegistry.register({
  id: 'github-api',
  name: 'GitHub API',
  transport: 'http',
  url: 'https://api.github.com/mcp',
  auth: {
    type: 'oauth',
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_SECRET!,
    tokenEndpoint: 'https://github.com/login/oauth/access_token'
  },
  tags: ['github', 'vcs']
});
```

### Example 3: Bulk Registration

```typescript
import { loadMCPConfig } from 'volcano-sdk';

const config = {
  servers: [
    {
      id: 'weather',
      name: 'Weather',
      transport: 'http',
      url: 'http://localhost:3000/mcp',
      tags: ['weather']
    },
    {
      id: 'calendar',
      name: 'Calendar',
      transport: 'http',
      url: 'http://localhost:4000/mcp',
      tags: ['calendar']
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

### Example 4: Filtering by Tags

```typescript
// Get only scraping servers
const scrapingServices = mcpRegistry.list({ 
  tags: ['scraping'],
  enabledOnly: true 
});

const scrapingHandles = scrapingServices.map(s => s.handle);

// Use only scraping services
await agent({ llm })
  .then({
    prompt: 'Scrape data from a website',
    mcps: scrapingHandles
  })
  .run();
```

### Example 5: Dynamic Management

```typescript
// Temporarily disable a server
mcpRegistry.update('weather-api', { enabled: false });

// Check enabled servers
const enabled = mcpRegistry.list({ enabledOnly: true });
console.log(`Enabled servers: ${enabled.length}`);

// Re-enable
mcpRegistry.update('weather-api', { enabled: true });
```

## 🔍 API Reference

### MCPRegistry

#### `register(config: MCPServerConfig): MCPHandle`

Register a new MCP server.

```typescript
const handle = mcpRegistry.register({
  id: 'my-server',
  name: 'My Server',
  transport: 'http',
  url: 'http://localhost:3000/mcp'
});
```

#### `registerMany(configs: MCPServerConfig[]): Map<string, MCPHandle>`

Register multiple servers in batch.

```typescript
const handles = mcpRegistry.registerMany([
  { id: 'server1', name: 'Server 1', transport: 'http', url: '...' },
  { id: 'server2', name: 'Server 2', transport: 'http', url: '...' }
]);
```

#### `get(id: string): RegisteredMCP | undefined`

Get a registered server with its metadata.

```typescript
const server = mcpRegistry.get('weather-api');
console.log(server?.name, server?.description);
```

#### `getHandle(id: string): MCPHandle | undefined`

Get only the MCP handle of a server.

```typescript
const handle = mcpRegistry.getHandle('weather-api');
```

#### `getHandles(): MCPHandle[]`

Get all handles of enabled servers.

```typescript
const allHandles = mcpRegistry.getHandles();
```

#### `list(options?): RegisteredMCP[]`

List servers with optional filtering.

```typescript
// All servers
const all = mcpRegistry.list();

// Only enabled
const enabled = mcpRegistry.list({ enabledOnly: true });

// By tag
const weather = mcpRegistry.list({ tags: ['weather'] });

// By transport
const http = mcpRegistry.list({ transport: 'http' });

// Combined
const filtered = mcpRegistry.list({
  enabledOnly: true,
  transport: 'http',
  tags: ['api']
});
```

#### `update(id: string, updates: Partial<...>): boolean`

Update a server's configuration.

```typescript
mcpRegistry.update('server-id', {
  enabled: false,
  description: 'New description',
  tags: ['new', 'tags']
});
```

#### `unregister(id: string): Promise<boolean>`

Remove and cleanup a server.

```typescript
await mcpRegistry.unregister('weather-api');
```

#### `unregisterAll(): Promise<void>`

Remove all servers with cleanup.

```typescript
// Cleanup on application shutdown
await mcpRegistry.unregisterAll();
```

#### `stats(): { ... }`

Get registry statistics.

```typescript
const stats = mcpRegistry.stats();
console.log({
  total: stats.total,
  enabled: stats.enabled,
  disabled: stats.disabled,
  http: stats.http,
  stdio: stats.stdio
});
```

### MCPServerConfig

Configuration for an MCP server:

```typescript
type MCPServerConfig = {
  id: string;                    // Unique ID
  name: string;                  // Readable name
  description?: string;          // Optional description
  transport: 'http' | 'stdio';   // Transport type
  url?: string;                  // URL (for HTTP)
  stdio?: MCPStdioConfig;        // Config (for stdio)
  auth?: MCPAuthConfig;          // Authentication
  tags?: string[];               // Tags for categorization
  enabled?: boolean;             // Enabled (default: true)
};
```

## 🏗️ Advanced Patterns

### Pattern 1: Configuration from JSON File

```typescript
import fs from 'fs/promises';
import { loadMCPConfig } from 'volcano-sdk';

// mcp-config.json
// {
//   "servers": [
//     {
//       "id": "weather",
//       "name": "Weather Service",
//       "transport": "http",
//       "url": "http://localhost:3000/mcp"
//     }
//   ]
// }

const configFile = await fs.readFile('./mcp-config.json', 'utf-8');
const config = JSON.parse(configFile);
const handles = loadMCPConfig(config);
```

### Pattern 2: Multiple Registries for Testing

```typescript
import { createMCPRegistry } from 'volcano-sdk';

// Production registry
const prodRegistry = createMCPRegistry();
prodRegistry.register({ /* production config */ });

// Isolated test registry
const testRegistry = createMCPRegistry();
testRegistry.register({ /* test config */ });
```

### Pattern 3: Graceful Shutdown

```typescript
import { mcpRegistry } from 'volcano-sdk';

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await mcpRegistry.unregisterAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received Ctrl+C...');
  await mcpRegistry.unregisterAll();
  process.exit(0);
});
```

### Pattern 4: Health Monitoring

```typescript
setInterval(() => {
  const stats = mcpRegistry.stats();
  console.log('Registry Health:', {
    total: stats.total,
    enabled: stats.enabled,
    health: `${Math.round(stats.enabled / stats.total * 100)}%`
  });
}, 60000); // Every minute
```

### Pattern 5: Environment-Conditional Servers

```typescript
const servers: MCPServerConfig[] = [
  // Always active
  {
    id: 'core-api',
    name: 'Core API',
    transport: 'http',
    url: process.env.API_URL!
  },
  // Development only
  ...(process.env.NODE_ENV === 'development' ? [{
    id: 'debug-tools',
    name: 'Debug Tools',
    transport: 'stdio',
    stdio: { command: 'node', args: ['./debug.js'] }
  }] : []),
  // Production only
  ...(process.env.NODE_ENV === 'production' ? [{
    id: 'monitoring',
    name: 'Monitoring',
    transport: 'http',
    url: process.env.MONITORING_URL!
  }] : [])
];

mcpRegistry.registerMany(servers);
```

## 🎓 Best Practices

1. **Unique IDs**: Use descriptive and unique IDs (e.g., `github-api`, not `api1`)
2. **Descriptive Tags**: Add tags for categorization and filtering
3. **Clear Descriptions**: Provide useful descriptions for each server
4. **Proper Cleanup**: Always cleanup stdio servers on shutdown
5. **Error Handling**: Handle errors during registration
6. **Environment-based**: Enable/disable servers based on environment
7. **Monitoring**: Use `stats()` to monitor registry state
8. **Testing**: Use isolated registries for tests

## 🔗 Useful Links

- [Volcano SDK Documentation](https://volcano.dev)
- [MCP Protocol](https://modelcontextprotocol.io)
- [Smithery.ai - MCP Servers](https://smithery.ai)
- [ScrapeGraphAI MCP](https://smithery.ai/server/@ScrapeGraphAI/scrapegraph-mcp)

## 📝 Complete Examples

See complete examples in:
- `examples/mcp-registry.ts` - Complete feature overview
- `examples/mcp-registry-scrapegraph.ts` - Using ScrapeGraphAI
- `tests/mcp.registry.test.ts` - Complete test suite
