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

  console.log("Run-Level Token Streaming:\n");

  await agent({ llm })
    .then({ prompt: "Name 3 programming languages" })
    .then({ prompt: "Pick one and explain why it's popular" })
    .run({
      onToken: (token) => {
        process.stdout.write(token);
      },
      onStep: (_step, index) => {
        console.log(`\n✓ Step ${index + 1} done`);
      }
    });
})();

