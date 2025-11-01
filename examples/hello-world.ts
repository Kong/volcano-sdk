import { agent, llmOpenAI } from "../dist/volcano-sdk.js";

(async () => {
  
  const llm = llmOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY!, 
    model: "gpt-4o-mini" 
  });
  
  const results = await agent({ llm })
    .then({ 
      prompt: "Generate 3 random positive words" 
    })
    .then({ 
      prompt: "Create 10 motivational quotes using those words" 
    })
    .run();
  
  console.log(results.at(-1)?.llmOutput);
})();

