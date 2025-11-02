import { agent, llmOpenAI, mcp, discoverTools } from "../dist/volcano-sdk.js";

(async () => {
  const llm = llmOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY!, 
    model: "gpt-4o-mini" 
  });
  
  const weather = mcp("http://localhost:3000/mcp");
  const calendar = mcp("http://localhost:4000/mcp");
  const email = mcp("http://localhost:5000/mcp");
  const notifications = mcp("http://localhost:6000/mcp");

  const availableTools = await discoverTools([weather, calendar, email, notifications]);
  console.log("Available tools:", availableTools.map(t => t.name));
  
  const results = await agent({ llm, instructions: "You are a helpful assistant that chooses the right tools." })
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
      if (step.prompt) console.log("\nPrompt:", step.prompt);
      if (step.llmOutput) console.log("Response:", step.llmOutput);
      if (step.toolCalls) {
        console.log("Tools called:");
        step.toolCalls.forEach(call => {
          console.log(`  - ${call.name}: ${JSON.stringify(call.result)}`);
        });
      }
    });

  console.log("\nFinal result:", results.at(-1));
})();
