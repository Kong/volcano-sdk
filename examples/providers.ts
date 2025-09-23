import { agent, mcp, llmOpenAI, llmAnthropic, llmMistral, llmLlama } from "../dist/volcano-sdk.js";

// Simple example showing how to use different LLM providers with MCP tools
// Run with: npx tsx examples/providers.ts
// (make sure OPENAI_API_KEY, ANTHROPIC_API_KEY, MISTRAL_API_KEY are set)
// (and that you have local Ollama running for Llama: `ollama serve`)

async function demonstrateProviders() {
  console.log("Volcano SDK - Multi-Provider Example");
  console.log("Using different LLMs in different steps of the same workflow");
  console.log("=========================================================");
  
  // Setup MCP services (assumes servers are running)
  const astro = mcp("http://localhost:3211/mcp");
  const favorites = mcp("http://localhost:3212/mcp");

  // Configure different LLM providers
  const openai = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-4o-mini" });
  const claude = llmAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, model: "claude-3-haiku-20240307" });
  const mistral = llmMistral({ apiKey: process.env.MISTRAL_API_KEY!, model: "mistral-large-latest" });
  const llama = llmLlama({ baseURL: "http://127.0.0.1:11434", model: "llama3.2:3b" });

  try {
    console.log("\nRunning multi-provider workflow...");
    
    const results = await agent()
      // Step 1: Use OpenAI for structured tool calling
      .then({ 
        llm: openai,
        prompt: "What's the astrological sign for birthdate 1993-07-11? Use available tools.",
        mcps: [astro] 
      })
      // Step 2: Use Anthropic for analytical reasoning
      .then({ 
        llm: claude,
        prompt: "Based on that sign, what are the favorite food and drink? Use available tools.",
        mcps: [favorites] 
      })
      // Step 3: Use Mistral for creative summary
      .then({
        llm: mistral,
        prompt: "Create a fun, personalized one-sentence recommendation based on the astrological sign and food preferences discovered above."
      })
      // Step 4: Use Llama for a friendly closing
      .then({
        llm: llama,
        prompt: "Add a warm, encouraging closing message to the recommendation above (keep it brief)."
      })
      .run();

    // Show results
    console.log("\nWorkflow Results:");
    console.log(`OpenAI (Step 1): Found ${results[0].toolCalls?.[0]?.name || 'No tool used'}`);
    console.log(`Claude (Step 2): Found ${results[1].toolCalls?.[0]?.name || 'No tool used'}`);
    console.log(`Mistral (Step 3): ${results[2].llmOutput}`);
    console.log(`Llama (Step 4): ${results[3].llmOutput}`);
    
    console.log("\nSuccessfully used 4 different LLM providers in one workflow!");
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

// Run the demo
demonstrateProviders().catch(console.error);