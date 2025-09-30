// Parallel Execution Example
// Run multiple LLM tasks simultaneously to save time
import { agent, llmOpenAI } from "../dist/volcano-sdk.js";

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-4o-mini" 
});

// Example 1: Array mode - simple parallel tasks
console.log("=== Parallel Array Mode ===");
const arrayResults = await agent({ llm })
  .parallel([
    { prompt: "What's 15 + 27?" },
    { prompt: "What's 8 × 12?" },
    { prompt: "What's 100 - 45?" }
  ])
  .run();

console.log("Results:", arrayResults[0].parallelResults?.map(r => r.llmOutput));

// Example 2: Named mode - access results by key
console.log("\n=== Parallel Named Mode ===");
const namedResults = await agent({ llm })
  .parallel({
    addition: { prompt: "What's 25 + 75?" },
    multiplication: { prompt: "What's 6 × 8?" },
    division: { prompt: "What's 144 ÷ 12?" }
  })
  .then((history) => {
    const math = history[0].parallel!;
    return { 
      prompt: `Summarize: Addition gave ${math.addition.llmOutput}, ` +
              `Multiplication gave ${math.multiplication.llmOutput}, ` +
              `Division gave ${math.division.llmOutput}` 
    };
  })
  .run();

console.log("Summary:", namedResults[1].llmOutput);

// Example 3: Multi-provider parallel execution
import { llmAnthropic, llmMistral } from "../dist/volcano-sdk.js";

if (process.env.ANTHROPIC_API_KEY && process.env.MISTRAL_API_KEY) {
  const claude = llmAnthropic({ 
    apiKey: process.env.ANTHROPIC_API_KEY!, 
    model: "claude-3-haiku-20240307" 
  });
  const mistral = llmMistral({ 
    apiKey: process.env.MISTRAL_API_KEY!, 
    model: "mistral-small-latest" 
  });

  console.log("\n=== Multi-Provider Parallel ===");
  const multiResults = await agent()
    .parallel({
      gpt: { prompt: "Say hello in English", llm },
      claude: { prompt: "Say hello in French", llm: claude },
      mistral: { prompt: "Say hello in Spanish", llm: mistral }
    })
    .run();

  console.log("Multi-provider greetings:", multiResults[0].parallel);
}
