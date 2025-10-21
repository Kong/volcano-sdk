import { agent, llmOpenAI } from "../dist/volcano-sdk.js";

// Run with: npx tsx examples/multi-agent-crew.ts
// Multiple specialized agents working together

(async () => {
  const llm = llmOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY!, 
    model: "gpt-5-mini" 
  });

  // Define specialized agents with distinct roles
  const researcher = agent({ 
    llm,
    instructions: "You are a researcher. Analyze topics and identify key facts."
  });

  const writer = agent({ 
    llm,
    instructions: "You are a writer. Transform research into engaging content."
  });

  const editor = agent({ 
    llm,
    instructions: "You are an editor. Review and improve content for clarity."
  });

  console.log("=== MULTI-AGENT WORKFLOW ===");
  console.log("Task: Create a blog post about quantum computing\n");

  // Sequential collaboration: Research → Write → Edit
  const research = await researcher
    .then({ prompt: "Research quantum computing. List 3 key concepts." })
    .run();

  const draft = await writer
    .then({ prompt: `Write a 100-word intro based on: ${research[0].llmOutput}` })
    .run();

  const final = await editor
    .then({ prompt: `Improve this draft:\n${draft[0].llmOutput}` })
    .run();

  console.log("Research:", research[0].llmOutput?.substring(0, 80) + "...");
  console.log("\nDraft:", draft[0].llmOutput?.substring(0, 80) + "...");
  console.log("\nFinal:", final[0].llmOutput);
})();

