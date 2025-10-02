// Example: Using STDIO MCP Servers
import { agent, llmOpenAI, mcp } from "../dist/volcano-sdk.js";

(async () => {
  const llm = llmOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY!, 
    model: "gpt-4o-mini" 
  });
  
  // STDIO MCP server - runs as local process
  const stdioMcp = mcp({
    command: 'node',
    args: ['mcp/stdio-server/server.mjs']
  });
  
  console.log('🔧 Using STDIO MCP server (local process)...\n');
  
  // Automatic tool selection
  const results = await agent({ llm })
    .then({
      prompt: "Get the current time and reverse the string 'Volcano SDK'",
      mcps: [stdioMcp]
    })
    .run();
  
  console.log('Results:');
  console.log('- Tools called:', results[0].toolCalls?.map(t => t.name));
  console.log('- Output:', results[0].llmOutput);
  console.log('\nTool results:');
  results[0].toolCalls?.forEach(t => {
    console.log(`  ${t.name}:`, t.result);
  });
  
  console.log('\n✅ STDIO MCP server worked!');
})();
