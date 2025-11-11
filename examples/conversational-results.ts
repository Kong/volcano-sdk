import { agent, llmOpenAI, mcp } from "../dist/volcano-sdk.js";

// Conversational Results - Ask Questions About What Your Agent Did
// Uses an LLM to analyze agent results and answer questions in natural language

(async () => {
  const llm = llmOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY!, 
    model: "gpt-5"
  });

  const summaryLlm = llmOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY!, 
    model: "gpt-4o-mini"  // Cheaper model for summaries
  });

  const astro = mcp("http://localhost:3211/mcp");
  const favorites = mcp("http://localhost:3212/mcp");

  console.log("Running agent workflow...\n");

  const results = await agent({ llm })
    .then({
      prompt: "Find the astrological sign for birthdate 1993-07-11",
      mcps: [astro]
    })
    .then({
      prompt: "Based on that sign, what are the favorite foods and drinks?",
      mcps: [favorites]
    })
    .then({
      prompt: "Create a personalized recommendation based on the findings"
    })
    .run();

  console.log("━".repeat(60));
  console.log("Agent execution complete! Now let's analyze the results...\n");
  console.log("━".repeat(60));

  console.log("\n📊 Ask: What did the agent accomplish?");
  const summary = await results.summary(summaryLlm);
  console.log(summary);

  console.log("\n\n🔧 Ask: What tools were used?");
  const tools = await results.toolsUsed(summaryLlm);
  console.log(tools);

  console.log("\n\n❓ Custom: Were there any API errors?");
  const errors = await results.ask(summaryLlm, "Were there any API errors or failures?");
  console.log(errors);

  console.log("\n\n💡 Custom: What should I do next?");
  const next = await results.ask(summaryLlm, "Based on these results, what should the user do next or what additional actions could be helpful?");
  console.log(next);

  console.log("\n\n📈 Custom: How efficient was the workflow?");
  const efficiency = await results.ask(summaryLlm, "Analyze the execution time and efficiency. Were there any bottlenecks?");
  console.log(efficiency);

  console.log("\n\n📝 Custom: Give me a one-sentence summary");
  const oneLine = await results.ask(summaryLlm, "Summarize everything in one sentence");
  console.log(oneLine);

  console.log("\n" + "━".repeat(60));
  console.log("✨ You can ask ANY question about the results!");
  console.log("━".repeat(60));
})();

