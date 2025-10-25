import { agent, llmOpenAI, llmVertexStudio, mcp } from "../dist/volcano-sdk.js";

// Run with: npx tsx examples/streaming.ts
// This example demonstrates agent-level streaming for real-time step results

(async () => {
  console.log("Volcano SDK - Streaming Workflow Example");
  console.log("==========================================");
  console.log("Watch steps complete in real-time!\n");

  // Configure LLM provider
  const llm = llmOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY!, 
    model: "gpt-5-mini" 
  });

  // Alternative: Use Vertex Studio
  // const llm = llmVertexStudio({ 
  //   apiKey: process.env.GCP_VERTEX_API_KEY!, 
  //   model: "gemini-2.5-flash-lite" 
  // });

  // Setup MCP service (optional - will work without it too)
  const astro = mcp("http://localhost:3211/mcp");

  let stepCount = 0;
  const totalSteps = 4;
  const startTime = Date.now();

  try {
    console.log("🚀 Starting streaming workflow...\n");

    // Stream a multi-step workflow in real-time
    for await (const stepResult of agent({ 
      llm,
      showProgress: true,
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
        // This callback fires immediately when each step completes
        stepCount++;
        const progress = Math.round((stepCount / totalSteps) * 100);
        const elapsed = Date.now() - startTime;
        
        console.log(`\n🔄 STEP ${stepIndex + 1} COMPLETED (${progress}%)`);
        console.log(`   ⏱️  Duration: ${step.durationMs}ms`);
        console.log(`   📊 Total elapsed: ${elapsed}ms`);
        if (step.llmMs) console.log(`   🧠 LLM time: ${step.llmMs}ms`);
        console.log(`   📝 Prompt: ${step.prompt}`);
        console.log(`   💭 Response: ${step.llmOutput}`);
        console.log("   " + "─".repeat(50));
      })) {

      // This also executes for each step (alternative to the callback above)
      const elapsed = Date.now() - startTime;
      console.log(`\n🔔 Step notification: "${stepResult.llmOutput?.substring(0, 50)}..." (${elapsed}ms total)`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n🎉 Streaming workflow complete!`);
    console.log(`📊 Total time: ${totalTime}ms`);
    console.log(`📈 Average per step: ${Math.round(totalTime / totalSteps)}ms`);
    console.log(`⚡ Steps streamed: ${stepCount}/${totalSteps}`);

  } catch (error) {
    console.error(`❌ Streaming error: ${error.message}`);
  }

})();
