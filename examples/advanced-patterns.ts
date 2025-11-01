import { agent, llmOpenAI } from "../dist/volcano-sdk.js";

async function main() {
  const llm = llmOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY!, 
    model: "gpt-4o-mini" 
  });

  console.log("1. Parallel Execution");
  const parallelResults = await agent({ llm })
    .parallel({
      sentiment: { prompt: "What's the sentiment of: 'I love this product!'?" },
      topic: { prompt: "What's the main topic of: 'I love this product!'?" },
      language: { prompt: "Detect language of: 'I love this product!'" }
    })
    .run();
  
  console.log("Results:", parallelResults[0].parallel);

  console.log("\n2. Conditional Branching");
  const branchResults = await agent({ llm })
    .then({ prompt: "Is 10 > 5? Reply YES or NO" })
    .branch(
      (h) => h[0].llmOutput?.includes("YES") || false,
      {
        true: (a) => a.then({ prompt: "Say: Correct! 10 is greater than 5" }),
        false: (a) => a.then({ prompt: "Say: Wrong" })
      }
    )
    .run();
  
  console.log("Result:", branchResults[branchResults.length - 1].llmOutput);

  console.log("\n3. Switch Statement");
  const switchResults = await agent({ llm })
    .then({ prompt: "Pick a number: 1, 2, or 3" })
    .switch(
      (h) => h[0].llmOutput?.trim() || '',
      {
        '1': (a) => a.then({ prompt: "You picked one" }),
        '2': (a) => a.then({ prompt: "You picked two" }),
        '3': (a) => a.then({ prompt: "You picked three" }),
        default: (a) => a.then({ prompt: "Unknown choice" })
      }
    )
    .run();
  
  console.log("Result:", switchResults[switchResults.length - 1].llmOutput);

  console.log("\n4. ForEach Loop");
  const colors = ["red", "blue", "green"];
  const forEachResults = await agent({ llm })
    .forEach(colors, (color, a) => 
      a.then({ prompt: `Describe the color ${color} in one word` })
    )
    .run();
  
  forEachResults.forEach((r, i) => console.log(`  ${colors[i]}: ${r.llmOutput}`));

  console.log("\n5. While Loop");
  let counter = 0;
  const whileResults = await agent({ llm })
    .while(
      (history) => {
        counter++;
        return counter < 3; // Stop after 2 iterations
      },
      (a) => a.then({ prompt: `Iteration ${counter}: Say hello` }),
      { maxIterations: 5 }
    )
    .run();
  
  console.log("Ran", whileResults.length, "times");

  console.log("\n6. Retry Until Success");
  let attemptNum = 0;
  const mockLLM = {
    ...llm,
    gen: async (prompt: string) => {
      attemptNum++;
      return attemptNum < 2 ? "TRY AGAIN" : "SUCCESS";
    }
  };
  
  const retryResults = await agent({ llm: mockLLM as any })
    .retryUntil(
      (a) => a.then({ prompt: "Generate result" }),
      (result) => result.llmOutput?.includes("SUCCESS") || false,
      { maxAttempts: 5 }
    )
    .run();
  
  console.log("Succeeded after", retryResults.length, "attempts");

  console.log("\n7. Sub-Agent Composition");
  const analyzer = agent({ llm })
    .then({ prompt: "Extract key points from: 'AI is transforming industries'" });
  
  const writer = agent({ llm })
    .then({ prompt: "Write a tweet about it" });
  
  const composedResults = await agent({ llm })
    .runAgent(analyzer)
    .runAgent(writer)
    .run();
  
  console.log("Result:", composedResults[composedResults.length - 1].llmOutput);

  console.log("\n8. Combined Patterns");
  const combinedResults = await agent({ llm })
    .parallel({
      check1: { prompt: "Is 'hello world' friendly? YES/NO" },
      check2: { prompt: "Is 'hello world' formal? YES/NO" }
    })
    .branch(
      (h) => h[0].parallel?.check1.llmOutput?.includes("YES") || false,
      {
        true: (a) => a.forEach(
          ["Alice", "Bob"],
          (name, ag) => ag.then({ prompt: `Greet ${name} warmly` })
        ),
        false: (a) => a.then({ prompt: "Use formal greeting" })
      }
    )
    .run();
  
  console.log("Completed:", combinedResults.length, "steps");
}

main().catch(console.error);
