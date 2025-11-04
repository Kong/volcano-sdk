import { agent, llmOpenAI } from "../dist/volcano-sdk.js";

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-4o-mini" 
});

console.log("1. ForEach - Process List");
const tasks = ["Write email", "Review document", "Schedule meeting"];

const forEachResult = await agent({ llm })
  .forEach(tasks, (task, a) => 
    a.then({ prompt: `For task "${task}", say: Task completed` })
  )
  .then({ prompt: "Say: All tasks finished!" })
  .run();

console.log("Task results:");
forEachResult.slice(0, -1).forEach((r, i) => console.log(`  ${i + 1}. ${r.llmOutput}`));
console.log("Summary:", forEachResult[forEachResult.length - 1].llmOutput);

console.log("\n2. While - Process Until Done");
let stepCount = 0;

const whileResult = await agent({ llm })
  .while(
    (history) => {
      if (history.length === 0) return true;
      const last = history[history.length - 1];
      stepCount++;
      return stepCount < 3 && !last.llmOutput?.includes("DONE");
    },
    (a) => a.then({ 
      prompt: stepCount === 2 
        ? "Say: Final step. DONE" 
        : `Say: Processing step ${stepCount + 1}` 
    }),
    { maxIterations: 10 }
  )
  .run();

console.log("While loop executed", whileResult.length, "times");
whileResult.forEach((r, i) => console.log(`  ${i + 1}: ${r.llmOutput}`));

console.log("\n3. RetryUntil - Self-Correction");
let attemptCount = 0;

const unreliableLLM: typeof llm = {
  ...llm,
  gen: async () => {
    attemptCount++;
    if (attemptCount < 3) {
      return `Attempt ${attemptCount}: Hmm, maybe 41?`;
    }
    return "The answer is 42";
  }
};

const retryResult = await agent({ llm: unreliableLLM })
  .retryUntil(
    (a) => a.then({ prompt: "What is 6 × 7?" }),
    (result) => result.llmOutput?.includes("42") || false,
    { maxAttempts: 5, backoff: 1.2 }
  )
  .run();

console.log("Attempts:", retryResult.length);
retryResult.forEach((r, i) => console.log(`  Attempt ${i + 1}: ${r.llmOutput}`));

console.log("\n4. Batch Processing");
const numbers = [5, 12, 7, 23, 9];

const batchResult = await agent({ llm })
  .forEach(numbers, (num, a) => 
    a.then({ prompt: `Is ${num} even or odd? One word answer.` })
  )
  .then({ prompt: "Count how many even and odd numbers total" })
  .run();

console.log("Number classifications:");
batchResult.slice(0, -1).forEach((r, i) => {
  console.log(`  ${numbers[i]}: ${r.llmOutput}`);
});
console.log("\nTotals:", batchResult[batchResult.length - 1].llmOutput);
