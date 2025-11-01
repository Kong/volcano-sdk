import { agent, llmOpenAI } from "../dist/volcano-sdk.js";

(async () => {
  const llm = llmOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY!, 
    model: "gpt-5-mini" 
  });

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
  
  const agentCalls = (results[0] as any).agentCalls;
  if (agentCalls) {
    console.log("\nAgents used:");
    agentCalls.forEach((call: any) => {
      console.log(`  - ${call.name}: "${call.task.substring(0, 60)}..."`);
    });
  }
})();

