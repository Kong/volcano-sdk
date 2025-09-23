import { agent, llmOpenAI, mcp } from "../dist/volcano-sdk.js";

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
      prompt: "Based on the answer, create a simple mock text message to send the most important order (one only) to the restaurant in the format of [QUANTITY]x [ITEM] for [NAME]"
    })
    .run((step) => console.log(step));

  console.log("Final result:", results.at(-1));
})();
