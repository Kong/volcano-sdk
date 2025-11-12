// examples/mcp-registry-scrapegraph.ts
/**
 * Example: Using MCP Registry with ScrapeGraphAI
 * 
 * This example demonstrates how to register and use the ScrapeGraphAI MCP server
 * from Smithery.ai for web scraping with AI.
 * 
 * ScrapeGraphAI provides AI-powered web scraping capabilities via MCP.
 * Server: https://smithery.ai/server/@ScrapeGraphAI/scrapegraph-mcp
 */

import { 
  agent, 
  llmOpenAI, 
  mcpRegistry,
  type MCPServerConfig
} from '../dist/volcano-sdk.js';

console.log('\n🌋 MCP Registry + ScrapeGraphAI Example\n');
console.log('━'.repeat(50));

// Example 1: Register ScrapeGraphAI MCP server
console.log('\n=== Example 1: Register ScrapeGraphAI ===\n');

// Option A: Using npx with Smithery server
const scrapeGraphHandle = mcpRegistry.register({
  id: 'scrapegraph-ai',
  name: 'ScrapeGraphAI',
  description: 'AI-powered web scraping and data extraction',
  transport: 'stdio',
  stdio: {
    command: 'npx',
    args: ['-y', '@smithery/scrapegraph-mcp@latest'],
    env: {
      // Add your ScrapeGraphAI API key if required
      SCRAPEGRAPH_API_KEY: process.env.SCRAPEGRAPH_API_KEY || ''
    }
  },
  tags: ['scraping', 'web', 'ai', 'data-extraction'],
  enabled: true
});

console.log('✅ Registered ScrapeGraphAI MCP server');
console.log(`   ID: scrapegraph-ai`);
console.log(`   Transport: stdio (via npx)`);

// Example 2: Register multiple scraping and data services
console.log('\n=== Example 2: Multi-Service Setup ===\n');

const dataServices: MCPServerConfig[] = [
  {
    id: 'scrapegraph-ai',
    name: 'ScrapeGraphAI',
    description: 'AI-powered web scraping',
    transport: 'stdio',
    stdio: {
      command: 'npx',
      args: ['-y', '@smithery/scrapegraph-mcp@latest']
    },
    tags: ['scraping', 'ai']
  },
  {
    id: 'weather-api',
    name: 'Weather Service',
    description: 'Weather data provider',
    transport: 'http',
    url: 'http://localhost:3000/mcp',
    tags: ['weather', 'api']
  },
  {
    id: 'data-processor',
    name: 'Data Processing',
    description: 'Data transformation and analysis',
    transport: 'http',
    url: 'http://localhost:4000/mcp',
    tags: ['data', 'processing']
  }
];

// Register all services (skip if already registered)
for (const service of dataServices) {
  if (!mcpRegistry.has(service.id)) {
    try {
      mcpRegistry.register(service);
      console.log(`✅ Registered ${service.name}`);
    } catch (err) {
      console.log(`⚠️  Already registered: ${service.name}`);
    }
  }
}

// Example 3: View registered scraping services
console.log('\n=== Example 3: Filter Scraping Services ===\n');

const scrapingServices = mcpRegistry.list({ tags: ['scraping'] });
console.log(`Found ${scrapingServices.length} scraping service(s):`);
scrapingServices.forEach(service => {
  console.log(`  📊 ${service.name}`);
  console.log(`     ID: ${service.id}`);
  console.log(`     Transport: ${service.config.transport}`);
  console.log(`     Description: ${service.description || 'N/A'}`);
});

// Example 4: Use ScrapeGraphAI with an agent
console.log('\n=== Example 4: Agent with ScrapeGraphAI ===\n');

async function runScrapingAgent() {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    console.log('⚠️  OPENAI_API_KEY not set - skipping agent execution');
    console.log('   Set OPENAI_API_KEY to run this example');
    return;
  }

  const llm = llmOpenAI({
    apiKey: OPENAI_API_KEY,
    model: 'gpt-4o-mini'
  });

  // Get the ScrapeGraphAI handle
  const scrapeHandle = mcpRegistry.getHandle('scrapegraph-ai');
  
  if (!scrapeHandle) {
    console.log('❌ ScrapeGraphAI not found in registry');
    return;
  }

  console.log('🤖 Running agent with ScrapeGraphAI...\n');

  try {
    const results = await agent({ llm })
      .then({
        prompt: `Extract the main headline and first paragraph from the Hacker News homepage.
                 Use the scraping tools available to fetch and parse the content.`,
        mcps: [scrapeHandle],
        timeout: 30 // Scraping may take longer
      })
      .run();

    console.log('\n📋 Scraping Results:');
    console.log('━'.repeat(50));
    console.log(results[0].llmOutput);
    
    if (results[0].toolCalls && results[0].toolCalls.length > 0) {
      console.log('\n🔧 Tools Used:');
      results[0].toolCalls.forEach((tool, idx) => {
        console.log(`  ${idx + 1}. ${tool.name}`);
      });
    }
  } catch (error) {
    console.error('❌ Error running agent:', error);
  }
}

await runScrapingAgent();

// Example 5: Combine ScrapeGraphAI with other services
console.log('\n=== Example 5: Multi-Service Agent ===\n');

async function runMultiServiceAgent() {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    console.log('⚠️  Skipping - OPENAI_API_KEY not set');
    return;
  }

  const llm = llmOpenAI({
    apiKey: OPENAI_API_KEY,
    model: 'gpt-4o-mini'
  });

  // Get all enabled scraping and data services
  const allHandles = mcpRegistry.list({ 
    tags: ['scraping', 'data'],
    enabledOnly: true 
  }).map(s => s.handle);

  console.log(`🤖 Running agent with ${allHandles.length} services...\n`);

  try {
    const results = await agent({ llm })
      .then({
        prompt: `List all available tools from the scraping and data services.
                 Explain what each tool does in simple terms.`,
        mcps: allHandles,
        timeout: 30
      })
      .run();

    console.log('\n📋 Available Tools:');
    console.log('━'.repeat(50));
    console.log(results[0].llmOutput);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

await runMultiServiceAgent();

// Example 6: Dynamic service management
console.log('\n=== Example 6: Dynamic Management ===\n');

// Check if service is working
const scrapeService = mcpRegistry.get('scrapegraph-ai');
if (scrapeService) {
  console.log('✅ ScrapeGraphAI is registered and available');
  
  // Temporarily disable for maintenance
  console.log('🔴 Disabling for maintenance...');
  mcpRegistry.update('scrapegraph-ai', { enabled: false });
  
  console.log(`   Enabled services: ${mcpRegistry.list({ enabledOnly: true }).length}`);
  
  // Re-enable
  console.log('🟢 Re-enabling...');
  mcpRegistry.update('scrapegraph-ai', { enabled: true });
  
  console.log(`   Enabled services: ${mcpRegistry.list({ enabledOnly: true }).length}`);
}

// Example 7: Registry statistics
console.log('\n=== Example 7: Registry Stats ===\n');

const stats = mcpRegistry.stats();
console.log('📊 Current Registry State:');
console.log(`   Total servers: ${stats.total}`);
console.log(`   Enabled: ${stats.enabled}`);
console.log(`   Disabled: ${stats.disabled}`);
console.log(`   HTTP transport: ${stats.http}`);
console.log(`   Stdio transport: ${stats.stdio}`);

// List all by transport
console.log('\n📋 Servers by Transport:');
console.log('\n  HTTP Servers:');
const httpServers = mcpRegistry.list({ transport: 'http' });
httpServers.forEach(s => console.log(`    - ${s.name} (${s.id})`));

console.log('\n  Stdio Servers:');
const stdioServers = mcpRegistry.list({ transport: 'stdio' });
stdioServers.forEach(s => console.log(`    - ${s.name} (${s.id})`));

// Example 8: Configuration export (useful for saving state)
console.log('\n=== Example 8: Export Configuration ===\n');

const allServers = mcpRegistry.list();
const exportConfig = {
  servers: allServers.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    transport: s.config.transport,
    url: s.config.url,
    stdio: s.config.stdio,
    auth: s.config.auth,
    tags: s.config.tags,
    enabled: s.config.enabled
  }))
};

console.log('💾 Configuration export:');
console.log(JSON.stringify(exportConfig, null, 2));

// Example 9: Best practices for production
console.log('\n=== Example 9: Production Best Practices ===\n');

console.log('✨ Recommended patterns:');
console.log('   1. Register all MCP servers at startup');
console.log('   2. Use tags for easy filtering and discovery');
console.log('   3. Enable/disable servers based on environment');
console.log('   4. Always cleanup stdio servers on shutdown');
console.log('   5. Use descriptive IDs and names');
console.log('   6. Store configuration in external files');
console.log('   7. Monitor server health with registry.stats()');
console.log('   8. Use isolated registries for testing');

// Example 10: Graceful cleanup
console.log('\n=== Example 10: Graceful Shutdown ===\n');

// Setup cleanup handlers
const setupCleanup = () => {
  const cleanup = async () => {
    console.log('\n🧹 Cleaning up MCP servers...');
    await mcpRegistry.unregisterAll();
    console.log('✅ Cleanup complete');
    process.exit(0);
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  process.on('exit', () => {
    console.log('👋 Goodbye!');
  });
};

console.log('✅ Cleanup handlers registered');
console.log('   - SIGTERM: Graceful shutdown');
console.log('   - SIGINT: Ctrl+C handler');
console.log('   - exit: Cleanup on process exit');

// Only setup if running directly
if (process.env.SETUP_CLEANUP === 'true') {
  setupCleanup();
}

console.log('\n━'.repeat(50));
console.log('✨ Example complete!\n');

// Cleanup for this example
console.log('🧹 Performing cleanup...');
await mcpRegistry.unregisterAll();
console.log('✅ Done!\n');

