// Loops Example
// Iterate over data or retry until success
import { agent, llmOpenAI } from "../dist/volcano-sdk.js";

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-4o-mini" 
});

// Example 1: forEach - process array of items
console.log("=== ForEach Loop ===");
const cities = ["Paris", "Tokyo", "New York"];

const forEachResult = await agent({ llm })
  .forEach(cities, (city, a) => 
    a.then({ prompt: `Give me one fun fact about ${city}` })
  )
  .run();

console.log("Fun facts:");
forEachResult.forEach((result, i) => {
  console.log(`  ${cities[i]}: ${result.llmOutput}`);
});

// Example 2: while loop - process until condition met
console.log("\n=== While Loop ===");
let counter = 0;

const whileResult = await agent({ llm })
  .while(
    (history) => {
      if (history.length === 0) return true;
      const last = history[history.length - 1];
      // Continue until we see "DONE"
      return !last.llmOutput?.includes("DONE");
    },
    (a) => {
      counter++;
      return a.then({ 
        prompt: counter >= 3 
          ? "Say: Processing complete. DONE" 
          : `Say: Processing step ${counter}...` 
      });
    },
    { maxIterations: 5 }
  )
  .run();

console.log("While loop results:");
whileResult.forEach((r, i) => console.log(`  Step ${i + 1}: ${r.llmOutput}`));

// Example 3: retryUntil - self-correcting agent
console.log("\n=== Retry Until Success ===");
let attemptNumber = 0;

// Simulate a flaky LLM that succeeds on 3rd try
const flakyLLM = {
  ...llm,
  gen: async (prompt: string) => {
    attemptNumber++;
    if (attemptNumber < 3) {
      return `Attempt ${attemptNumber}: The answer is maybe 42?`;
    }
    return "The answer is definitely 42.";
  }
};

const retryResult = await agent({ llm: flakyLLM as any })
  .retryUntil(
    (a) => a.then({ prompt: "What's the meaning of life?" }),
    (result) => result.llmOutput?.includes("definitely") || false,
    { maxAttempts: 5, backoff: 1.2 }
  )
  .run();

console.log("Retry attempts made:", retryResult.length);
console.log("Final answer:", retryResult[retryResult.length - 1].llmOutput);

// Example 4: Data processing pipeline with forEach
console.log("\n=== Data Processing Pipeline ===");
const temperatures = [{ city: "Boston", temp: 72 }, { city: "Miami", temp: 95 }, { city: "Seattle", temp: 58 }];

const pipelineResult = await agent({ llm })
  .forEach(temperatures, (data, a) => 
    a.then({ prompt: `${data.city} is ${data.temp}°F. Is this hot, mild, or cold? One word only.` })
  )
  .then({ prompt: "Summarize the weather across all cities in one sentence" })
  .run();

console.log("\nWeather classifications:");
pipelineResult.slice(0, -1).forEach((r, i) => {
  console.log(`  ${temperatures[i].city}: ${r.llmOutput}`);
});
console.log("\nSummary:", pipelineResult[pipelineResult.length - 1].llmOutput);
