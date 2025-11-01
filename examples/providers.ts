import { agent, mcp, llmOpenAI, llmAnthropic, llmMistral, llmLlama, llmBedrock } from "../dist/volcano-sdk.js";

async function demonstrateProviders() {
  const astro = mcp("http://localhost:3211/mcp");
  const favorites = mcp("http://localhost:3212/mcp");
  const openai = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5-mini" });
  const claude = llmAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, model: "claude-3-haiku-20240307" });
  const mistral = llmMistral({ apiKey: process.env.MISTRAL_API_KEY!, model: "mistral-large-latest" });
  const llama = llmLlama({ baseURL: "http://127.0.0.1:11434", model: "llama3.1:8b" });
  const bedrock = llmBedrock({ 
    model: "anthropic.claude-sonnet-4-20250514-v1:0",
    region: "us-east-1"
  });

  try {
    const results = await agent({})
      .then({ 
        llm: openai,
        prompt: "What's the astrological sign for birthdate 1993-07-11? Use available tools.",
        mcps: [astro] 
      })
      .then({ 
        llm: claude,
        prompt: "Based on that sign, what are the favorite food and drink? Use available tools.",
        mcps: [favorites] 
      })
      .then({
        llm: mistral,
        prompt: "Create a fun, personalized one-sentence recommendation based on the astrological sign and food preferences discovered above."
      })
      .then({
        llm: bedrock,
        prompt: "Provide a professional summary of the food recommendations from a nutritional perspective."
      })
      .then({
        llm: llama,
        prompt: "Add a warm, encouraging closing message to the analysis above (keep it brief)."
      })
      .run();

    console.log("\nWorkflow Results:");
    console.log(`OpenAI (Step 1): Found ${results[0].toolCalls?.[0]?.name || 'No tool used'}`);
    console.log(`Claude (Step 2): Found ${results[1].toolCalls?.[0]?.name || 'No tool used'}`);
    console.log(`Mistral (Step 3): ${results[2].llmOutput}`);
    console.log(`Bedrock (Step 4): ${results[3].llmOutput}`);
    console.log(`Llama (Step 5): ${results[4].llmOutput}`);
    
    console.log("\nSuccessfully used 5 different LLM providers in one workflow!");
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

// Run the demo
demonstrateProviders().catch(console.error);