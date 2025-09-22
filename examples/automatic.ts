import { agent, llmOpenAI, mcp, discoverTools } from "../dist/volcano-sdk.js";

// Run with: npx tsx examples/automatic.ts
// This example demonstrates the new automatic tool selection feature

(async () => {
  const llm = llmOpenAI("smart-agent", { apiKey: process.env.OPENAI_API_KEY! });
  
  // Set up multiple MCP services
  const weather = mcp("weather", "http://localhost:3000/mcp");
  const calendar = mcp("calendar", "http://localhost:4000/mcp");
  const email = mcp("email", "http://localhost:5000/mcp");
  const notifications = mcp("notifications", "http://localhost:6000/mcp");

  console.log("=== DISCOVERING AVAILABLE TOOLS ===");
  const availableTools = await discoverTools([weather, calendar, email, notifications]);
  console.log("Available tools:", availableTools.map(t => t.name));

  console.log("\n=== AUTOMATIC AGENT WORKFLOW ===");
  
  // The LLM will automatically choose which tools to use based on the request
  const results = await agent()
    .llm(llm)
    .then({
      prompt: "Check the weather for tomorrow in San Francisco and if it's going to rain, send me an email reminder to bring an umbrella",
      mcps: [weather, email]
    })
    .then({
      prompt: "Schedule a meeting for next Tuesday at 2pm with the team, and send notifications to all participants",
      mcps: [calendar, email, notifications]
    })
    .then({
      prompt: "What's my schedule looking like for the rest of the week?",
      mcps: [calendar]
    })
    .run((step) => {
      console.log("\n--- STEP RESULT ---");
      if (step.prompt) console.log("Prompt:", step.prompt);
      if (step.llmOutput) console.log("LLM Response:", step.llmOutput);
      if (step.toolCalls) {
        console.log("Tools Called:");
        step.toolCalls.forEach(call => {
          console.log(`  - ${call.name} at ${call.endpoint}`);
          console.log(`    Result:`, call.result);
        });
      }
    });

  console.log("\n=== WORKFLOW COMPLETE ===");
  console.log("Final result:", results.at(-1));
})();
