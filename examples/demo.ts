import { agent, llmOpenAI, mcp, discoverTools } from "../dist/volcano-sdk.js";

// Run with: npx tsx examples/automatic.ts
// This example demonstrates the new automatic tool selection feature

(async () => {
  const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  
  // Set up multiple MCP services
  const forfive = mcp("http://localhost:3000/mcp");
  const astro = mcp("http://localhost:9000/mcp");
  
  // The LLM will automatically choose which tools to use based on the request
  const results = await agent({ llm, instructions: "You are a helpful assistant that chooses the right tools." })
    .then({
      prompt: "I was born in Sept 12 1988, what is my astrological sign?",
      mcps: [astro],
      pre: () => { console.log("Finding astrological sign.."); },
      post: () => { console.log("Finished step 1: Got astrological sign!"); }
    })
    .then({
      prompt: "Based on my astrological sign what drink do you recommend from For Five? Just one.",
      mcps: [forfive],
      pre: () => { console.log("Getting drink recommendation..."); },
      post: () => { console.log("Finished step 2: Got drink recommendation!"); }
    })
    .run((step, stepIndex) => {
      console.log(`Step ${stepIndex + 1} completed successfully`);
    });

  console.log("\nFinal result:", results.at(-1));
})();
