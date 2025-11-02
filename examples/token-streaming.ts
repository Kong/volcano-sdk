import { agent, llmOpenAI } from "../dist/volcano-sdk.js";

(async () => {
  const llm = llmOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY!, 
    model: "gpt-5-mini" 
  });

  console.log("Per-Step Token Streaming:\n");
  
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

  console.log("Stream-Level Token Streaming:\n");

  for await (const step of agent({ llm })
    .then({ prompt: "Name 3 programming languages" })
    .then({ prompt: "Pick one and explain why it's popular" })
    .stream({
      onToken: (token, meta) => {
        process.stdout.write(token);
      },
      onStep: (step, index) => {
        console.log(`\n✓ Step ${index + 1} done (${step.durationMs}ms)`);
      }
    })) {}
})();

