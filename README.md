[![CI](https://github.com/Kong/volcano-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/Kong/volcano-sdk/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/volcano-sdk.svg)](https://www.npmjs.com/package/volcano-sdk)

# 🌋 Volcano SDK

**The TypeScript SDK for Multi-Provider AI Agents**

Build agents that chain LLM reasoning with MCP tools. Mix OpenAI, Claude, Mistral in one workflow. Parallel execution, branching, loops. Native retries, streaming, and typed errors.

📚 **[Read the full documentation at volcano.dev →](https://volcano.dev/)**

## ✨ Features

<table>
<tr>
<td width="33%">

### ⚡️ Chainable API
Chain steps with `.then()` and `.run()`. Promise-like syntax for multi-step workflows.

</td>
<td width="33%">

### ✨ Automatic Tool Selection
LLM automatically selects and calls MCP tools based on prompt. No manual routing.

</td>
<td width="33%">

### 🔧 100s of Models
OpenAI, Anthropic, Mistral, Llama, Bedrock, Vertex, Azure. Switch per-step.

</td>
</tr>

<tr>
<td width="33%">

### 🛡️ TypeScript-First
Full TypeScript with type inference and IntelliSense.

</td>
<td width="33%">

### 🔄 Advanced Patterns
Parallel execution, branching, loops, sub-agents.

</td>
<td width="33%">

### ⏱️ Retries & Timeouts
Three retry strategies: immediate, delayed, exponential backoff.

</td>
</tr>

<tr>
<td width="33%">

### 📡 Streaming Workflows
Stream results as they complete. Real-time updates.

</td>
<td width="33%">

### 🎯 MCP Integration
Native MCP with connection pooling and tool discovery.

</td>
<td width="33%">

### 🧩 Sub-Agent Composition
Reusable components you can compose together.

</td>
</tr>

<tr>
<td width="33%">

### 📊 OTEL Observability
Traces and metrics. Jaeger, Prometheus, DataDog support.

</td>
<td width="33%">

### 🔐 OAuth Authentication
OAuth 2.1 per MCP spec. Auto token caching and refresh.

</td>
<td width="33%">

### ⚡ Performance Optimized
Connection pooling, caching, schema validation.

</td>
</tr>
</table>

**[Explore all features →](https://volcano.dev/docs/)**

## Quick Start

### Installation

```bash
npm install volcano-sdk
```

That's it! Includes MCP support and all common LLM providers (OpenAI, Anthropic, Mistral, Llama, Vertex).

**[View installation guide →](https://volcano.dev/docs/index.html#installation)**

### Hello World

```ts
import { agent, llmOpenAI } from "volcano-sdk";

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-5-mini" 
});

const results = await agent({ llm })
  .then({ prompt: "Say hello to Marco in one short sentence." })
  .run();

console.log(results[0].llmOutput);
```

### Multi-Provider Workflow

```ts
import { agent, llmOpenAI, mcp } from "volcano-sdk";

import { agent, llmOpenAI, llmAnthropic, llmMistral } from "volcano-sdk";

const gpt = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const claude = llmAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const mistral = llmMistral({ apiKey: process.env.MISTRAL_API_KEY! });

// Use different LLMs for different steps
await agent()
  .then({ llm: gpt, prompt: "Extract data from report" })
  .then({ llm: claude, prompt: "Analyze for patterns" })
  .then({ llm: mistral, prompt: "Write creative summary" })
  .run();
```

**[View more examples →](https://volcano.dev/docs/examples.html)**

## Documentation

### 📖 Comprehensive Guides
- **[Getting Started](https://volcano.dev/docs/)** - Installation, quick start, core concepts
- **[LLM Providers](https://volcano.dev/docs/providers.html)** - OpenAI, Anthropic, Mistral, Llama, Bedrock, Vertex, Azure
- **[MCP Tools](https://volcano.dev/docs/mcp-tools.html)** - Automatic selection, OAuth authentication, connection pooling
- **[Advanced Patterns](https://volcano.dev/docs/patterns.html)** - Parallel, branching, loops, multi-LLM workflows
- **[Features](https://volcano.dev/docs/features.html)** - Streaming, retries, timeouts, hooks, error handling
- **[Observability](https://volcano.dev/docs/observability.html)** - OpenTelemetry traces and metrics
- **[API Reference](https://volcano.dev/docs/api.html)** - Complete API documentation
- **[Examples](https://volcano.dev/docs/examples.html)** - Ready-to-run code examples

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Questions or Feature Requests?

- 📝 [Report bugs or issues](https://github.com/Kong/volcano-sdk/issues)
- 💡 [Request features or ask questions](https://github.com/Kong/volcano-sdk/discussions)
- ⭐ [Star the project](https://github.com/Kong/volcano-sdk) if you find it useful

## License

Apache 2.0 - see [LICENSE](LICENSE) file for details.

---

**[Get started with Volcano SDK →](https://volcano.dev/)**

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-5-mini" 
});

const astro = mcp("http://localhost:3211/mcp");
const favorites = mcp("http://localhost:3212/mcp");

const results = await agent({ llm })
  .then({
    prompt: "For birthdate 1993-07-11, determine the sign and then my favorite food and drink.",
    mcps: [astro, favorites]
  })
  .run();
```

Multi-provider workflow:


**Dependencies:**
```bash
npm install @azure/identity  # for Entra ID and credential chain
```

**Environment variables:**
- `AZURE_AI_API_KEY` (required for API key auth)
- `AZURE_AI_ENDPOINT` (required)
- Optional: `AZURE_AI_MODEL`, `AZURE_AI_API_VERSION`
- For Entra ID: `AZURE_ACCESS_TOKEN`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`

## Requirements

- Node.js 18.17+
- `OPENAI_API_KEY` (for LLM usage)
- MCP services (for tool execution)

## Run locally

```bash
npm install
npm run build
# try the examples (set OPENAI_API_KEY)
npx tsx examples/automatic.ts
```

---

Questions or ideas? Open an issue — we’d love to hear how you’re using Volcano SDK.
