// Sub-Agent Composition Example
// Build reusable agent components and compose them
import { agent, llmOpenAI, llmAnthropic } from "../dist/volcano-sdk.js";

const openai = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-4o-mini" 
});

// Define reusable sub-agents
const textAnalyzer = agent({ llm: openai })
  .then({ prompt: "Extract the main topic" })
  .then({ prompt: "Determine the sentiment (positive/negative/neutral)" });

const contentEnhancer = agent({ llm: openai })
  .then({ prompt: "Make the text more engaging" })
  .then({ prompt: "Add a call-to-action" });

// Example 1: Simple sub-agent composition
console.log("=== Simple Composition ===");
const simpleResult = await agent({ llm: openai })
  .then({ prompt: "Input text: 'AI is changing the world'. Remember this." })
  .runAgent(textAnalyzer)
  .then({ prompt: "Based on the analysis, write a headline" })
  .run();

console.log("Analysis steps:", simpleResult.length);
console.log("Final headline:", simpleResult[simpleResult.length - 1].llmOutput);

// Example 2: Chaining multiple sub-agents
console.log("\n=== Chaining Sub-Agents ===");
const chainResult = await agent({ llm: openai })
  .then({ prompt: "Text: 'Our new product launches next week.'" })
  .runAgent(textAnalyzer)
  .runAgent(contentEnhancer)
  .then({ prompt: "Format as a tweet (280 chars max)" })
  .run();

console.log("Processing pipeline:");
chainResult.forEach((r, i) => {
  if (r.prompt) console.log(`  Step ${i + 1}: ${r.prompt?.substring(0, 50)}...`);
});
console.log("\nFinal tweet:", chainResult[chainResult.length - 1].llmOutput);

// Example 3: Sub-agents with different LLMs
if (process.env.ANTHROPIC_API_KEY) {
  const claude = llmAnthropic({ 
    apiKey: process.env.ANTHROPIC_API_KEY!, 
    model: "claude-3-haiku-20240307" 
  });

  const claudeAnalyzer = agent({ llm: claude })
    .then({ prompt: "Analyze writing style (formal/casual/technical)" })
    .then({ prompt: "Suggest improvements" });

  const gptWriter = agent({ llm: openai })
    .then({ prompt: "Rewrite with improvements applied" });

  console.log("\n=== Multi-LLM Sub-Agents ===");
  const multiResult = await agent({})
    .then({ llm: openai, prompt: "Text: 'The API is down and users are complaining.'" })
    .runAgent(claudeAnalyzer)
    .runAgent(gptWriter)
    .run();

  console.log("Multi-LLM processing complete");
  console.log("Final output:", multiResult[multiResult.length - 1].llmOutput);
}

// Example 4: Reusable validator sub-agent
const jsonValidator = agent({ llm: openai })
  .then({ prompt: "Check if the previous output is valid JSON. Reply VALID or INVALID only." });

console.log("\n=== Validator Sub-Agent ===");
const validationResult = await agent({ llm: openai })
  .then({ prompt: 'Generate JSON: {"name": "Alice", "age": 30}' })
  .runAgent(jsonValidator)
  .run();

console.log("Generated:", validationResult[0].llmOutput);
console.log("Validation:", validationResult[1].llmOutput);
