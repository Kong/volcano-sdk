# Structured Outputs with OpenAI

Volcano SDK supports OpenAI's **Structured Outputs** feature, which guarantees that the model's response matches your JSON schema exactly.

## What are Structured Outputs?

Structured Outputs use JSON Schema validation to ensure the LLM always returns data in the exact format you specify. Unlike basic JSON mode (`response_format: { type: "json_object" }`), structured outputs:

- ✅ **Guarantee schema compliance** - Model output always matches your schema
- ✅ **No hallucinated fields** - Only fields you define are present
- ✅ **Type safety** - Numbers are numbers, strings are strings, etc.
- ✅ **Required fields enforced** - Model must include all required properties
- ✅ **Reliable parsing** - Never get unexpected JSON structures

## Basic Usage

```typescript
import { llmOpenAIResponses } from "volcano-sdk";

const llm = llmOpenAIResponses({
  apiKey: process.env.OPENAI_API_KEY!,
  model: "gpt-4o-mini",
  options: {
    jsonSchema: {
      name: "order_response",
      description: "Order information",
      schema: {
        type: "object",
        properties: {
          item: { type: "string" },
          price: { type: "number" },
          category: { type: "string" }
        },
        required: ["item", "price", "category"],
        additionalProperties: false
      }
    }
  }
});

const response = await llm.gen('Info for Espresso: $5.25, Coffee category');
const data = JSON.parse(response);
// Guaranteed to have: { item: "Espresso", price: 5.25, category: "Coffee" }
```

## In Agent Workflows

```typescript
const llm = llmOpenAIResponses({
  apiKey: process.env.OPENAI_API_KEY!,
  model: "gpt-4o-mini",
  options: {
    jsonSchema: {
      name: "analysis",
      schema: {
        type: "object",
        properties: {
          sentiment: { type: "string", enum: ["positive", "negative", "neutral"] },
          confidence: { type: "number" },
          keywords: { type: "array", items: { type: "string" } }
        },
        required: ["sentiment", "confidence", "keywords"],
        additionalProperties: false
      }
    }
  }
});

const results = await agent({ llm })
  .then({ prompt: 'Analyze: "The product is amazing!"' })
  .then({ prompt: 'Analyze: "This is terrible."' })
  .run();

// Each step returns guaranteed valid JSON
results.forEach(step => {
  const analysis = JSON.parse(step.llmOutput!);
  console.log(analysis.sentiment, analysis.confidence);
});
```

## With MCP Tools

```typescript
import { agent, llmOpenAIResponses, mcp } from "volcano-sdk";

const llm = llmOpenAIResponses({
  apiKey: process.env.OPENAI_API_KEY!,
  model: "gpt-4o-mini",
  options: {
    jsonSchema: {
      name: "order_summary",
      schema: {
        type: "object",
        properties: {
          item: { type: "string" },
          quantity: { type: "number" },
          total_price: { type: "number" }
        },
        required: ["item", "quantity", "total_price"],
        additionalProperties: false
      }
    }
  }
});

const menuMcp = mcp("https://api.example.com/menu/mcp");

const result = await agent({ llm })
  .then({
    prompt: "Find the price of Cappuccino and order 2 of them. Return structured order info.",
    mcps: [menuMcp]
  })
  .run();

// Always valid, parseable JSON!
const order = JSON.parse(result[0].llmOutput!);
```

## Schema Options

### Basic Schema
```typescript
{
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" }
  },
  required: ["name", "age"]
}
```

### With Enums
```typescript
{
  type: "object",
  properties: {
    status: { 
      type: "string", 
      enum: ["pending", "completed", "failed"] 
    }
  },
  required: ["status"]
}
```

### With Arrays
```typescript
{
  type: "object",
  properties: {
    tags: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["tags"]
}
```

### Nested Objects
```typescript
{
  type: "object",
  properties: {
    user: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" }
      },
      required: ["name", "email"]
    }
  },
  required: ["user"]
}
```

## Configuration Options

```typescript
llmOpenAIResponses({
  apiKey: string;           // Your OpenAI API key
  model: string;            // Model supporting structured outputs
  baseURL?: string;         // Optional: Custom endpoint (e.g., Kong Gateway)
  options: {
    jsonSchema: {
      name: string;         // Schema name (alphanumeric + underscores)
      description?: string; // Schema description (optional)
      schema: JSONSchema;   // Your JSON schema
      strict?: boolean;     // Enforce strict compliance (default: true)
    };
    // Standard OpenAI options
    temperature?: number;
    max_completion_tokens?: number;
    top_p?: number;
    // ... other OpenAI options
  }
})
```

## vs Regular llmOpenAI()

| Feature | `llmOpenAI()` | `llmOpenAIResponses()` |
|---------|---------------|------------------------|
| Output format | Free text or JSON | **Guaranteed valid JSON** |
| Schema validation | None | **Strict JSON Schema** |
| Use case | General purpose | Structured data extraction |
| Required fields | Not enforced | **Always present** |
| Extra fields | May appear | **Never appear** (with strict mode) |
| Best for | Conversational AI | Data extraction, APIs, structured tasks |

## When to Use

**Use `llmOpenAIResponses()` when:**
- You need reliable JSON parsing
- Building APIs that consume LLM output
- Extracting structured data (forms, orders, analytics)
- Using o1/o3 reasoning models
- Want zero-shot reliable outputs

**Use regular `llmOpenAI()` when:**
- Conversational responses
- Free-form text generation
- Don't need strict structure
- Simpler use case

## Best Practices

1. **Keep schemas simple** - Complex nested schemas can be slower
2. **Use strict mode** - Ensures exact compliance (it's the default)
3. **Mark all fields required** - Structured outputs work best with all fields required
4. **Avoid optional fields** - See OpenAI docs on structured outputs limitations
5. **Test your schema** - Validate it works before production

## Error Handling

```typescript
try {
  const result = await llm.gen('...');
  const data = JSON.parse(result);  // Guaranteed to succeed
} catch (error) {
  // Schema validation errors are caught by OpenAI before response
  console.error('LLM error:', error);
}
```

## Complete Example

See `examples/structured-outputs.ts` for a full working example!

## Learn More

- [OpenAI Structured Outputs Guide](https://platform.openai.com/docs/guides/structured-outputs)
- [JSON Schema Reference](https://json-schema.org/understanding-json-schema/)

