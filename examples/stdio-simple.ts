import { agent, llmOpenAI, mcpStdio } from "../dist/volcano-sdk.js";

/**
 * Simple Stdio MCP Server Example
 * 
 * This example demonstrates how to use Volcano SDK with a local MCP server
 * running via stdio (standard input/output) transport.
 * 
 * Stdio transport is ideal for:
 * - Local development and testing
 * - Running MCP servers as child processes
 * - Servers that don't need HTTP endpoints
 * - Maximum performance (no HTTP overhead)
 * - Passing environment variables to servers
 * 
 * Prerequisites:
 * - OPENAI_API_KEY environment variable
 * - A local MCP server (this example uses a hypothetical server)
 * 
 * Example MCP servers you can use:
 * - Aha MCP: https://github.com/aha-develop/aha-mcp
 * - Your own custom MCP server
 * - Any MCP server that supports stdio transport
 */

if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-4o-mini" 
});

console.log("🚀 Stdio MCP Server Example\n");

async function main() {
  // Example 1: Basic stdio MCP server
  console.log("Example 1: Basic stdio connection");
  console.log("=" .repeat(50));
  
  const basicMcp = mcpStdio({
    command: "node",                      // Command to run
    args: ["dist/index.js"],              // Arguments
    cwd: "/path/to/your/mcp-server"       // Working directory
  });

  try {
    // List available tools
    const { tools } = await basicMcp.listTools();
    console.log(`✅ Connected! Found ${tools.length} tools:`);
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description || 'No description'}`);
    });
  } catch (error) {
    console.error(`❌ Failed to connect: ${error}`);
  } finally {
    // Always cleanup stdio servers when done
    await basicMcp.cleanup?.();
  }

  console.log("\n");

  // Example 2: Stdio MCP server with environment variables
  console.log("Example 2: With environment variables");
  console.log("=".repeat(50));
  
  const envMcp = mcpStdio({
    command: "npx",
    args: ["-y", "@your-org/your-mcp-server"],
    env: {
      API_KEY: process.env.YOUR_API_KEY || "demo-key",
      API_DOMAIN: "api.example.com",
      DEBUG: "true"
    }
  });

  try {
    const { tools } = await envMcp.listTools();
    console.log(`✅ Connected! Server has access to environment variables`);
    console.log(`   Found ${tools.length} tools`);
  } catch (error) {
    console.error(`❌ Failed: ${error}`);
  } finally {
    await envMcp.cleanup?.();
  }

  console.log("\n");

  // Example 3: Using stdio MCP in agent workflow
  console.log("Example 3: Agent workflow with stdio MCP");
  console.log("=".repeat(50));
  
  const workflowMcp = mcpStdio({
    command: "node",
    args: ["dist/index.js"],
    cwd: "/path/to/your/mcp-server",
    env: {
      WORKSPACE: process.cwd(),
      LOG_LEVEL: "info"
    }
  });

  try {
    const results = await agent({ llm })
      .then({
        prompt: "List all available tools from the server",
        mcps: [workflowMcp],
        maxToolIterations: 2
      })
      .run();

    console.log("✅ Workflow completed!");
    console.log(`   Steps executed: ${results.length}`);
    results.forEach((step, i) => {
      console.log(`   Step ${i + 1}: ${step.toolCalls?.length || 0} tool calls`);
    });
  } catch (error) {
    console.error(`❌ Workflow failed: ${error}`);
  } finally {
    await workflowMcp.cleanup?.();
  }

  console.log("\n");

  // Example 4: Combining stdio and HTTP MCP servers
  console.log("Example 4: Combining stdio and HTTP MCPs");
  console.log("=".repeat(50));
  
  // Import HTTP MCP function
  const { mcp } = await import("../dist/volcano-sdk.js");
  
  const localMcp = mcpStdio({
    command: "node",
    args: ["dist/index.js"],
    cwd: "/path/to/local-server"
  });
  
  const remoteMcp = mcp("https://api.example.com/mcp", {
    auth: {
      type: 'bearer',
      token: process.env.REMOTE_API_KEY || 'demo-token'
    }
  });

  try {
    const results = await agent({ llm })
      .then({
        prompt: "Get local data using the stdio server",
        mcps: [localMcp],
        maxToolIterations: 2
      })
      .then({
        prompt: "Send the results to the remote server",
        mcps: [remoteMcp],
        maxToolIterations: 2
      })
      .run();

    console.log("✅ Mixed transport workflow completed!");
    console.log(`   Total steps: ${results.length}`);
  } catch (error) {
    console.error(`❌ Failed: ${error}`);
  } finally {
    // Cleanup stdio server (HTTP connections are auto-pooled)
    await localMcp.cleanup?.();
  }

  console.log("\n✨ All examples completed!");
}

// Run examples
main().catch(console.error);

