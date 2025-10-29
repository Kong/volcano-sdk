import { agent, llmOpenAI } from "../dist/volcano-sdk.js";

// Run with: npx tsx examples/multi-agent-crew.ts
// Autonomous multi-agent crews that self-coordinate

(async () => {
  const llm = llmOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY!, 
    model: "gpt-5-mini" 
  });

  // Define specialized agents with names and descriptions
  const researcher = agent({
    llm,
    name: "researcher",
    description: "Analyzes topics and provides factual, well-researched information. Use when you need data, facts, or analysis."
  });

  const writer = agent({
    llm,
    name: "writer",
    description: "Creates engaging, creative content with excellent storytelling. Use when you need articles, stories, or compelling copy."
  });

  const editor = agent({
    llm,
    name: "editor",
    description: "Reviews content for clarity, grammar, and style. Use to polish and improve existing content."
  });

  // The LLM automatically coordinates agents based on their descriptions
  const results = await agent({ 
    llm, 
    timeout: 180
  })
    .then({
      prompt: "Create a 2-paragraph blog post about quantum computing. First research the topic, then write engaging content, then edit for clarity.",
      agents: [researcher, writer, editor],
      maxAgentIterations: 10
    })
    .run();

  console.log(results[0].llmOutput);
  
  // Show which agents were used
  const agentCalls = (results[0] as any).agentCalls;
  if (agentCalls) {
    console.log("\n=== AGENTS UTILIZED ===");
    agentCalls.forEach((call: any, i: number) => {
      console.log(`${i + 1}. ${call.name}: "${call.task.substring(0, 60)}..."`);
    });
  }
})();

