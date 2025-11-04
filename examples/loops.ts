import { agent, llmOpenAI } from "../dist/volcano-sdk.js";

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-4o-mini" 
});

console.log("ForEach Loop:");
const cities = ["Paris", "Tokyo", "New York"];

const forEachResult = await agent({ llm })
  .forEach(cities, (city, a) => 
    a.then({ prompt: `Give me one fun fact about ${city}` })
  )
  .run();

forEachResult.forEach((result, i) => {
  console.log(`  ${cities[i]}: ${result.llmOutput}`);
});

console.log("\nWhile Loop:");
let counter = 0;

const whileResult = await agent({ llm })
  .while(
    (history) => {
      if (history.length === 0) return true;
      const last = history[history.length - 1];
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

whileResult.forEach((r, i) => console.log(`  Step ${i + 1}: ${r.llmOutput}`));

console.log("\nRetry Until Success:");
let attemptNumber = 0;

const flakyLLM: typeof llm = {
  ...llm,
  gen: async () => {
    attemptNumber++;
    if (attemptNumber < 3) {
      return `Attempt ${attemptNumber}: The answer is maybe 42?`;
    }
    return "The answer is definitely 42.";
  }
};

const retryResult = await agent({ llm: flakyLLM })
  .retryUntil(
    (a) => a.then({ prompt: "What's the meaning of life?" }),
    (result) => result.llmOutput?.includes("definitely") || false,
    { maxAttempts: 5, backoff: 1.2 }
  )
  .run();

console.log("Attempts:", retryResult.length);
console.log("Answer:", retryResult[retryResult.length - 1].llmOutput);

console.log("\nData Processing Pipeline:");
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
