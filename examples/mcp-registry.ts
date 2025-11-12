// examples/mcp-registry.ts
/**
 * Example: Using the MCP Registry for Modular MCP Server Management
 * 
 * This example demonstrates how to use the MCP Registry to:
 * - Register custom MCP servers in a modular way
 * - Manage multiple MCP servers with metadata
 * - Use tags for categorization
 * - Load configurations from objects
 * - Handle lifecycle (enable/disable/cleanup)
 * 
 * The MCP Registry provides a centralized, type-safe way to manage
 * all your MCP server connections in one place.
 */

import { 
  agent, 
  llmOpenAI, 
  mcpRegistry,
  loadMCPConfig,
  createMCPRegistry,
  type MCPServerConfig
} from '../dist/volcano-sdk.js';

// Example 1: Register individual MCP servers
console.log('\n=== Example 1: Individual Registration ===\n');

// Register an HTTP MCP server
const weatherHandle = mcpRegistry.register({
  id: 'weather-api',
  name: 'Weather Service',
  description: 'Provides weather forecasts and current conditions',
  transport: 'http',
  url: 'http://localhost:3000/mcp',
  tags: ['weather', 'forecast', 'api'],
  enabled: true
});

console.log('✅ Registered Weather API');

// Register a stdio MCP server
const fileHandle = mcpRegistry.register({
  id: 'file-tools',
  name: 'File Operations',
  description: 'Local file system operations',
  transport: 'stdio',
  stdio: {
    command: 'node',
    args: ['./mcp/favorites/server.mjs']
  },
  tags: ['files', 'local', 'tools']
});

console.log('✅ Registered File Tools');

// Example 2: Register with authentication
console.log('\n=== Example 2: MCP with Authentication ===\n');

mcpRegistry.register({
  id: 'github-api',
  name: 'GitHub API',
  description: 'GitHub operations via MCP',
  transport: 'http',
  url: 'https://api.github.com/mcp',
  auth: {
    type: 'bearer',
    token: process.env.GITHUB_TOKEN || 'your-token-here'
  },
  tags: ['github', 'api', 'vcs']
});

console.log('✅ Registered GitHub API with auth');

// Example 3: Register multiple servers at once
console.log('\n=== Example 3: Bulk Registration ===\n');

const configs: MCPServerConfig[] = [
  {
    id: 'calendar',
    name: 'Calendar Service',
    transport: 'http',
    url: 'http://localhost:4000/mcp',
    tags: ['calendar', 'scheduling']
  },
  {
    id: 'email',
    name: 'Email Service',
    transport: 'http',
    url: 'http://localhost:5000/mcp',
    tags: ['email', 'communication']
  }
];

const handles = mcpRegistry.registerMany(configs);
console.log(`✅ Registered ${handles.size} servers in bulk`);

// Example 4: List and filter registered servers
console.log('\n=== Example 4: List and Filter ===\n');

// Get all servers
const allServers = mcpRegistry.list();
console.log(`📋 Total registered servers: ${allServers.length}`);
allServers.forEach(server => {
  console.log(`  - ${server.name} (${server.id}): ${server.config.transport}`);
});

// Filter by tag
const weatherServers = mcpRegistry.list({ tags: ['weather'] });
console.log(`\n🏷️  Weather-tagged servers: ${weatherServers.length}`);

// Filter by transport
const httpServers = mcpRegistry.list({ transport: 'http' });
console.log(`🌐 HTTP servers: ${httpServers.length}`);

// Get only enabled servers
const enabledServers = mcpRegistry.list({ enabledOnly: true });
console.log(`✅ Enabled servers: ${enabledServers.length}`);

// Example 5: Get registry statistics
console.log('\n=== Example 5: Statistics ===\n');

const stats = mcpRegistry.stats();
console.log('📊 Registry Stats:');
console.log(`  Total: ${stats.total}`);
console.log(`  Enabled: ${stats.enabled}`);
console.log(`  Disabled: ${stats.disabled}`);
console.log(`  HTTP: ${stats.http}`);
console.log(`  Stdio: ${stats.stdio}`);

// Example 6: Use registered MCPs with agent
console.log('\n=== Example 6: Using with Agent ===\n');

async function runAgentWithRegistry() {
  // Option A: Use all registered MCPs
  const allHandles = mcpRegistry.getHandles();
  
  // Option B: Use specific MCPs by ID
  const specificHandles = [
    mcpRegistry.getHandle('weather-api'),
    mcpRegistry.getHandle('calendar')
  ].filter(h => h !== undefined);
  
  console.log(`🤖 Running agent with ${allHandles.length} MCP servers...`);
  
  // Uncomment to actually run (requires OpenAI key)
  /*
  const llm = llmOpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini'
  });
  
  const results = await agent({ llm })
    .then({
      prompt: 'What tools do I have available?',
      mcps: allHandles
    })
    .run();
  
  console.log('\nAgent Response:', results[0].llmOutput);
  */
}

await runAgentWithRegistry();

// Example 7: Load from configuration file
console.log('\n=== Example 7: Load from Config ===\n');

const config = {
  servers: [
    {
      id: 'slack',
      name: 'Slack Integration',
      transport: 'http' as const,
      url: 'http://localhost:6000/mcp',
      tags: ['slack', 'communication']
    },
    {
      id: 'database',
      name: 'Database Tools',
      transport: 'stdio' as const,
      stdio: {
        command: 'npx',
        args: ['-y', '@example/db-mcp']
      },
      tags: ['database', 'sql']
    },
    {
      id: 'scrapegraph-ai',
      name: 'ScrapeGraphAI',
      description: 'AI-powered web scraping from Smithery.ai',
      transport: 'stdio' as const,
      stdio: {
        command: 'npx',
        args: ['-y', '@smithery/scrapegraph-mcp@latest']
      },
      tags: ['scraping', 'web', 'ai'],
      enabled: true
    }
  ]
};

const loadedHandles = loadMCPConfig(config);
console.log(`✅ Loaded ${loadedHandles.size} servers from config`);

// Example 8: Update server configuration
console.log('\n=== Example 8: Update Configuration ===\n');

// Disable a server temporarily
mcpRegistry.update('calendar', { enabled: false });
console.log('🔴 Disabled calendar server');

// Re-enable it
mcpRegistry.update('calendar', { enabled: true });
console.log('🟢 Re-enabled calendar server');

// Update description
mcpRegistry.update('weather-api', { 
  description: 'Enhanced weather service with forecasts' 
});
console.log('📝 Updated weather-api description');

// Example 9: Create isolated registry for testing
console.log('\n=== Example 9: Isolated Registry ===\n');

const testRegistry = createMCPRegistry();
testRegistry.register({
  id: 'test-mcp',
  name: 'Test MCP',
  transport: 'http',
  url: 'http://localhost:9999/mcp'
});

console.log(`🧪 Test registry has ${testRegistry.stats().total} servers`);
console.log(`🌍 Global registry still has ${mcpRegistry.stats().total} servers`);

// Example 10: Cleanup
console.log('\n=== Example 10: Cleanup ===\n');

// Unregister a specific server
await mcpRegistry.unregister('test-mcp');
console.log('🗑️  Unregistered test-mcp');

// Cleanup specific server
await mcpRegistry.unregister('file-tools');
console.log('🗑️  Cleaned up file-tools');

// Get info about a server
const weatherInfo = mcpRegistry.get('weather-api');
if (weatherInfo) {
  console.log(`\n📦 Weather API Info:`);
  console.log(`  Name: ${weatherInfo.name}`);
  console.log(`  Description: ${weatherInfo.description}`);
  console.log(`  Transport: ${weatherInfo.config.transport}`);
  console.log(`  Tags: ${weatherInfo.config.tags?.join(', ')}`);
  console.log(`  Enabled: ${weatherInfo.config.enabled !== false}`);
}

// Final cleanup (important for stdio processes)
console.log('\n🧹 Performing final cleanup...');
await testRegistry.unregisterAll();
// Uncomment for production cleanup:
// await mcpRegistry.unregisterAll();

console.log('\n✨ Example complete!\n');

