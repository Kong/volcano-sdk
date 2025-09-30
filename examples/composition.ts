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

// Example 2: Build agent library
console.log("\n=== Agent Library ===");

// Content pipeline agents
const contentPipeline = {
  analyzer: agent({ llm })
    .then({ prompt: "Identify key points" })
    .then({ prompt: "Determine target audience" }),
  
  writer: agent({ llm })
    .then({ prompt: "Write engaging introduction" })
    .then({ prompt: "Add supporting details" }),
  
  editor: agent({ llm })
    .then({ prompt: "Check grammar and clarity" })
    .then({ prompt: "Optimize for SEO" })
};

const pipelineResult = await agent({ llm })
  .then({ prompt: "Topic: How AI agents work" })
  .runAgent(contentPipeline.analyzer)
  .runAgent(contentPipeline.writer)
  .runAgent(contentPipeline.editor)
  .then({ prompt: "Format as blog post markdown" })
  .run();

console.log("Content pipeline completed with", pipelineResult.length, "steps");

// Example 3: Conditional sub-agent selection
console.log("\n=== Dynamic Sub-Agent Selection ===");

const technicalWriter = agent({ llm })
  .then({ prompt: "Use technical terminology" })
  .then({ prompt: "Include code examples" });

const casualWriter = agent({ llm })
  .then({ prompt: "Use simple language" })
  .then({ prompt: "Add relatable examples" });

const dynamicResult = await agent({ llm })
  .then({ prompt: "Is the audience technical? Reply YES or NO" })
  .branch(
    (h) => h[0].llmOutput?.includes("YES") || false,
    {
      true: (a) => a
        .then({ prompt: "Topic: Machine learning basics" })
        .runAgent(technicalWriter),
      false: (a) => a
        .then({ prompt: "Topic: Machine learning basics" })
        .runAgent(casualWriter)
    }
  )
  .run();

console.log("Selected writer based on audience");
console.log("Output:", dynamicResult[dynamicResult.length - 1].llmOutput);

// Example 4: Sub-agent factory pattern
console.log("\n=== Sub-Agent Factory ===");

// Factory function for creating specialized agents
function createAnalyzer(topic: string) {
  return agent({ llm })
    .then({ prompt: `Analyze ${topic} trends` })
    .then({ prompt: `Identify ${topic} opportunities` })
    .then({ prompt: `Summarize ${topic} insights` });
}

const factoryResult = await agent({ llm })
  .runAgent(createAnalyzer("AI"))
  .runAgent(createAnalyzer("Cloud"))
  .then({ prompt: "Combine AI and Cloud insights into one paragraph" })
  .run();

console.log("Factory pattern completed with", factoryResult.length, "steps");
console.log("Combined insights:", factoryResult[factoryResult.length - 1].llmOutput);
