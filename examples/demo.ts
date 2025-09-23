import { agent, llmOpenAI, mcp, discoverTools } from "../dist/volcano-sdk.js";

// Run with: npx tsx examples/automatic.ts
// This example demonstrates the new automatic tool selection feature

(async () => {
  const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  
  // Set up multiple MCP services
  const forfive = mcp("http://localhost:3000/mcp");
  
  // The LLM will automatically choose which tools to use based on the request
  const results = await agent({ llm, instructions: "You are an ordering assistant, only use names and information given to you." })
    .then({
      prompt: "I am an italian person that lives in San Francisco, Marco Palladino, what am I most likely to order from For Five?",
      mcps: [forfive]
    })
    .then({
      prompt: "Based on the answer, create a simple mock text message to send the orders to the restaurant in the format of [QUANTITY]x [ITEM] for [NAME]"
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
