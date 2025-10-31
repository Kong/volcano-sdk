import { agent, llmOpenAIResponses } from "../dist/volcano-sdk.js";

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

const llm = llmOpenAIResponses({
  apiKey: process.env.OPENAI_API_KEY!,
  model: "gpt-4o-mini",
  options: {
    jsonSchema: {
      name: "order_response",
      description: "Information about a menu order",
      schema: orderSchema,
      strict: true
    }
  }
});

const result1 = await llm.gen(
  'Provide info for an Espresso: name, price $5.25, category Coffee, and mark it as recommended.'
);

console.log("Example 1:", JSON.stringify(JSON.parse(result1), null, 2));

const result2 = await agent({ llm })
  .then({ 
    prompt: 'Analyze this menu item: Cappuccino at $6.75 in Coffee category. Is it recommended for beginners?' 
  })
  .then({
    prompt: 'Now do the same for Matcha Latte at $7.50 in Coffee category.'
  })
  .run();

console.log("\nExample 2:");
result2.forEach((step, i) => {
  if (step.llmOutput) {
    console.log(`Step ${i + 1}:`, JSON.parse(step.llmOutput));
  }
});

const result3 = await llm.gen(
  'Tell me about Cold Brew coffee. Make sure all required fields are present.'
);

const parsed3 = JSON.parse(result3);
console.log("\nExample 3:", parsed3);

