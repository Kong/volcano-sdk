// examples/mcp-registry-simple.ts
/**
 * Simple MCP Registry Example
 * 
 * A minimal example showing the core functionality of MCP Registry.
 * Perfect for getting started quickly!
 */

import { 
  mcpRegistry,
  loadMCPConfig,
  type MCPServerConfig
} from '../dist/volcano-sdk.js';

console.log('\n🌋 MCP Registry - Simple Example\n');

// ============================================================================
// 1. Register Individual Servers
// ============================================================================

console.log('📝 Step 1: Register individual MCP servers\n');

// Register an HTTP server
mcpRegistry.register({
  id: 'weather-api',
  name: 'Weather Service',
  description: 'Provides weather forecasts and current conditions',
  transport: 'http',
  url: 'http://localhost:3000/mcp',
  tags: ['weather', 'api']
});

console.log('✅ Registered: weather-api (HTTP)');

// Register ScrapeGraphAI from Smithery.ai
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

console.log('✅ Registered: scrapegraph-ai (stdio)\n');

// ============================================================================
// 2. List and Filter
// ============================================================================

console.log('📋 Step 2: List and filter servers\n');

// Get all servers
const allServers = mcpRegistry.list();
console.log(`Total servers: ${allServers.length}`);

// Filter by tag
const scrapingServers = mcpRegistry.list({ tags: ['scraping'] });
console.log(`Scraping servers: ${scrapingServers.length}`);

// Filter by transport
const httpServers = mcpRegistry.list({ transport: 'http' });
console.log(`HTTP servers: ${httpServers.length}\n`);

// ============================================================================
// 3. Get Handles for Use with Agent
// ============================================================================

console.log('🔧 Step 3: Get handles for agent usage\n');

// Get all handles
const allHandles = mcpRegistry.getHandles();
console.log(`Available handles: ${allHandles.length}`);

// Get specific handle
const scrapeHandle = mcpRegistry.getHandle('scrapegraph-ai');
console.log(`Got handle for: ${scrapeHandle?.id}\n`);

// ============================================================================
// 4. Registry Statistics
// ============================================================================

console.log('📊 Step 4: Registry statistics\n');

const stats = mcpRegistry.stats();
console.log('Registry Stats:');
console.log(`  Total: ${stats.total}`);
console.log(`  Enabled: ${stats.enabled}`);
console.log(`  HTTP: ${stats.http}`);
console.log(`  Stdio: ${stats.stdio}\n`);

// ============================================================================
// 5. Bulk Registration from Config
// ============================================================================

console.log('⚡ Step 5: Bulk registration\n');

const config = {
  servers: [
    {
      id: 'calendar',
      name: 'Calendar Service',
      transport: 'http' as const,
      url: 'http://localhost:4000/mcp',
      tags: ['calendar', 'scheduling']
    }
  ]
};

const bulkHandles = loadMCPConfig(config);
console.log(`Bulk registered: ${bulkHandles.size} servers\n`);

// ============================================================================
// 6. Dynamic Management
// ============================================================================

console.log('🔄 Step 6: Dynamic management\n');

// Temporarily disable a server
mcpRegistry.update('weather-api', { enabled: false });
console.log('🔴 Disabled weather-api');

// Check enabled count
const enabledCount = mcpRegistry.list({ enabledOnly: true }).length;
console.log(`Enabled servers: ${enabledCount}`);

// Re-enable
mcpRegistry.update('weather-api', { enabled: true });
console.log('🟢 Re-enabled weather-api\n');

// ============================================================================
// 7. Server Information
// ============================================================================

console.log('ℹ️  Step 7: Get server information\n');

const serverInfo = mcpRegistry.get('scrapegraph-ai');
if (serverInfo) {
  console.log('ScrapeGraphAI Info:');
  console.log(`  Name: ${serverInfo.name}`);
  console.log(`  Description: ${serverInfo.description}`);
  console.log(`  Transport: ${serverInfo.config.transport}`);
  console.log(`  Tags: ${serverInfo.config.tags?.join(', ')}\n`);
}

// ============================================================================
// 8. Use with Agent (commented - requires API key)
// ============================================================================

console.log('🤖 Step 8: Usage with agent\n');
console.log('// Example agent usage:');
console.log('// const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-4o-mini" });');
console.log('// const handles = mcpRegistry.getHandles();');
console.log('// const results = await agent({ llm })');
console.log('//   .then({ prompt: "What can you do?", mcps: handles })');
console.log('//   .run();\n');

// ============================================================================
// 9. Cleanup
// ============================================================================

console.log('🧹 Step 9: Cleanup\n');

// In production, cleanup on shutdown:
// process.on('SIGTERM', async () => {
//   await mcpRegistry.unregisterAll();
//   process.exit(0);
// });

console.log('✅ For production: Setup cleanup handlers for SIGTERM/SIGINT\n');

// ============================================================================
// Summary
// ============================================================================

console.log('═'.repeat(60));
console.log('\n✨ MCP Registry Features Demonstrated:\n');
console.log('  ✅ Individual server registration (HTTP & stdio)');
console.log('  ✅ ScrapeGraphAI integration from Smithery.ai');
console.log('  ✅ Filtering by tags and transport');
console.log('  ✅ Handle retrieval for agent usage');
console.log('  ✅ Statistics and monitoring');
console.log('  ✅ Bulk registration from config');
console.log('  ✅ Dynamic enable/disable management');
console.log('  ✅ Server metadata and information');
console.log('\n💡 Next Steps:');
console.log('  - Check examples/mcp-registry.ts for complete examples');
console.log('  - See examples/mcp-registry-scrapegraph.ts for ScrapeGraphAI usage');
console.log('  - Read docs/MCP_REGISTRY.md for full documentation\n');

// Cleanup for this demo
await mcpRegistry.unregisterAll();
console.log('✅ Demo complete!\n');

