import { agent, llmOpenAI } from "../dist/volcano-sdk.js";

(async () => {
  const llm = llmOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY!, 
    model: "gpt-5-mini" 
  });

  let stepCount = 0;
  const totalSteps = 4;
  const startTime = Date.now();

  try {
    for await (const {} of agent({ 
      llm,
      instructions: "You are a helpful assistant. Be concise but friendly."
    })
      .then({ 
        prompt: "Generate 3 random positive words",
        pre: () => console.log("📝 Step 1: Generating positive words..."),
        post: () => console.log("✅ Step 1: Words generated!")
      })
      .then({ 
        prompt: "Create a short motivational quote using those words",
        pre: () => console.log("📝 Step 2: Creating motivational quote..."),
        post: () => console.log("✅ Step 2: Quote created!")
      })
      .then({ 
        prompt: "Explain why motivation is important in 1 sentence",
        pre: () => console.log("📝 Step 3: Explaining motivation..."),
        post: () => console.log("✅ Step 3: Explanation complete!")
      })
      .then({ 
        prompt: "Rate the overall positivity of this conversation from 1-10",
        pre: () => console.log("📝 Step 4: Rating conversation..."),
        post: () => console.log("✅ Step 4: Rating complete!")
      })
      .stream((step, stepIndex) => {
        stepCount++;
        const progress = Math.round((stepCount / totalSteps) * 100);
        
        console.log(`\nStep ${stepIndex + 1} (${progress}%) - ${step.durationMs}ms`);
        console.log(`Response: ${step.llmOutput}`);
      })) {}

    const totalTime = Date.now() - startTime;
    console.log(`\nComplete! ${totalTime}ms total, ${Math.round(totalTime / totalSteps)}ms avg, ${stepCount}/${totalSteps} steps`);

  } catch (error) {
    console.error(`Error: ${error.message}`);
  }

})();
