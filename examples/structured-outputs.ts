// Example: Using OpenAI Structured Outputs with JSON Schema validation
// Guarantees the model's output matches your schema exactly
import { agent, llmOpenAIResponses } from "../dist/volcano-sdk.js";

// Define your schema for structured outputs
const orderSchema = {
  type: "object" as const,
  properties: {
    item: { type: "string" as const, description: "Menu item name" },
    price: { type: "number" as const, description: "Price in dollars" },
    category: { type: "string" as const, description: "Item category" },
    recommended: { type: "boolean" as const, description: "Is this recommended?" }
  },
  required: ["item", "price", "category", "recommended"],
  additionalProperties: false
};

// Create LLM with structured outputs
const llm = llmOpenAIResponses({
  apiKey: process.env.OPENAI_API_KEY!,
  model: "gpt-4o-mini",  // Also works with: gpt-4o, o1-mini, o1-preview
  options: {
    jsonSchema: {
      name: "order_response",
      description: "Information about a menu order",
      schema: orderSchema,
      strict: true  // Enforce strict schema compliance (default)
    }
  }
});

console.log("🌋 Testing Structured Outputs...\n");

// Example 1: Simple structured output
const result1 = await llm.gen(
  'Provide info for an Espresso: name, price $5.25, category Coffee, and mark it as recommended.'
);

console.log("Example 1 - Simple Structured Output:");
const parsed1 = JSON.parse(result1);
console.log(JSON.stringify(parsed1, null, 2));
console.log("✅ Valid JSON matching schema!\n");

// Example 2: In an agent workflow
const result2 = await agent({ llm })
  .then({ 
    prompt: 'Analyze this menu item: Cappuccino at $6.75 in Coffee category. Is it recommended for beginners?' 
  })
  .then({
    prompt: 'Now do the same for Matcha Latte at $7.50 in Coffee category.'
  })
  .run();

console.log("Example 2 - Multi-step Workflow:");
result2.forEach((step, i) => {
  if (step.llmOutput) {
    console.log(`Step ${i + 1}:`, JSON.parse(step.llmOutput));
  }
});
console.log("✅ All outputs are structured JSON!\n");

// Example 3: Why structured outputs matter
console.log("Example 3 - Guaranteed Fields:");
const result3 = await llm.gen(
  'Tell me about Cold Brew coffee. Make sure all required fields are present.'
);

const parsed3 = JSON.parse(result3);
console.log("Guaranteed to have:", Object.keys(parsed3));
console.log("Values:", parsed3);
console.log("✅ No missing fields, no hallucinated fields, always valid!\n");

console.log("🎉 Done! Structured outputs ensure reliable parsing every time.");

