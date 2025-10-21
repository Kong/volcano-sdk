import { agent, llmOpenAI } from "../dist/volcano-sdk.js";

// Run with: npx tsx examples/token-streaming.ts
// Real-time token streaming for chat UIs and SSE endpoints

(async () => {
  const llm = llmOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY!, 
    model: "gpt-5-mini" 
  });

  console.log("=== PER-STEP TOKEN STREAMING ===\n");
  
  let tokenCount = 0;
  await agent({ llm })
    .then({ 
      prompt: "Explain quantum computing in 2 sentences.",
      onToken: (token: string) => {
        process.stdout.write(token);
        tokenCount++;
      }
    })
    .run();

  console.log(`\n\nReceived ${tokenCount} tokens\n`);

  console.log("=== STREAM-LEVEL TOKEN STREAMING ===\n");

  for await (const step of agent({ llm })
    .then({ prompt: "Name 3 programming languages" })
    .then({ prompt: "Pick one and explain why it's popular" })
    .stream({
      onToken: (token, meta) => {
        // Receive tokens with metadata
        process.stdout.write(token);
        if (meta.stepIndex === 1) {
          // Can apply different formatting per step
        }
      },
      onStep: (step, index) => {
        console.log(`\n✓ Step ${index + 1} done (${step.durationMs}ms)`);
      }
    })) {
    // Steps complete here
  }
})();

