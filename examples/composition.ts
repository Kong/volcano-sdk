// Sub-Agent Composition Example
// Build modular, reusable agent components
import { agent, llmOpenAI } from "../dist/volcano-sdk.js";

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-4o-mini" 
});

// Define specialized sub-agents
const summarizer = agent({ llm })
  .then({ prompt: "Summarize the previous text in one sentence" });

const translator = agent({ llm })
  .then({ prompt: "Translate to Spanish" });

const formalizer = agent({ llm })
  .then({ prompt: "Make the text more formal and professional" });

// Example 1: Linear composition
console.log("=== Linear Composition ===");
const linearResult = await agent({ llm })
  .then({ prompt: "Text: 'Hey! Our new AI tool is super cool and really fast!'" })
  .runAgent(summarizer)
  .runAgent(formalizer)
  .run();

console.log("Original → Summarized → Formalized:");
linearResult.forEach((r, i) => {
  if (r.llmOutput) console.log(`  Step ${i + 1}: ${r.llmOutput}`);
});
