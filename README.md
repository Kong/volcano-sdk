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
Chain steps with `.then()` and `.run()`. Promise-like syntax for building multi-step workflows.

</td>
<td width="33%">

### ✨ Automatic Tool Selection
LLM automatically selects and calls appropriate MCP tools based on the prompt. No manual routing required.

</td>
<td width="33%">

### 🔧 100s of Models
OpenAI, Anthropic, Mistral, Llama, Bedrock, Vertex, Azure. Switch providers per-step or use globally.

</td>
</tr>

<tr>
<td width="33%">

### 🛡️ TypeScript-First
Full TypeScript support with type inference and IntelliSense for all APIs.

</td>
<td width="33%">

### 🔄 Advanced Patterns
Parallel execution, conditional branching, loops, and sub-agent composition for complex workflows.

</td>
<td width="33%">

### ⏱️ Retries & Timeouts
Three retry strategies: immediate, delayed, and exponential backoff. Per-step timeout configuration.

</td>
</tr>

<tr>
<td width="33%">

### 📡 Streaming Workflows
Stream step results as they complete, or stream individual tokens in real-time with metadata. Perfect for SSE, real-time chat UIs, and long-running tasks.

</td>
<td width="33%">

### 🎯 MCP Integration
Native Model Context Protocol support with connection pooling, tool discovery, and authentication.

</td>
<td width="33%">

### 🧩 Multi-Agent Crews
Define specialized agents that autonomously coordinate based on descriptions. LLM automatically selects the right agent for each task - like automatic tool selection, but for agents.

</td>
</tr>

<tr>
<td width="33%">

### 📊 OpenTelemetry Observability
Production-ready distributed tracing and metrics. Monitor performance, debug failures. Export to Jaeger, Prometheus, DataDog, NewRelic.

</td>
<td width="33%">

### 🔐 MCP OAuth Authentication
OAuth 2.1 and Bearer token authentication per MCP specification. Agent-level or handle-level configuration with automatic token refresh.

</td>
<td width="33%">

### ⚡ Performance Optimized
Intelligent connection pooling for MCP servers, tool discovery caching with TTL, and JSON schema validation for reliability.

</td>
</tr>
</table>

**[Explore all features →](https://volcano.dev/docs#key-features)**

## Quick Start

### Installation

```bash
npm install volcano-sdk
```

That's it! Includes MCP support and all common LLM providers (OpenAI, Anthropic, Mistral, Llama, Vertex).

**[View installation guide →](https://volcano.dev/docs#installation)**

### Hello World

```ts
import { agent, llmOpenAI, mcp } from "volcano-sdk";

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-4o-mini" 
});

const astro = mcp("http://localhost:3211/mcp");

const results = await agent({ llm })
  .then({ 
    prompt: "Find the astrological sign for birthdate 1993-07-11",
    mcps: [astro]  // Automatic tool selection
  })
  .then({ 
    prompt: "Write a one-line fortune for that sign" 
  })
  .run();

console.log(results[1].llmOutput);
// Output: "Fortune based on the astrological sign"
```

### Multi-Provider Workflow

```ts
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

### Autonomous Multi-Agent Crews

```ts
import { agent, llmOpenAI } from "volcano-sdk";

const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-4o-mini" });

// Define specialized agents
const researcher = agent({
  llm,
  name: "researcher",
  description: "Analyzes topics and provides factual, well-researched information"
});

const writer = agent({
  llm,
  name: "writer",
  description: "Creates engaging, creative content with excellent storytelling"
});

const editor = agent({
  llm,
  name: "editor",
  description: "Reviews content for clarity, grammar, and style"
});

// LLM autonomously coordinates agents to accomplish the task!
const result = await agent({ llm })
  .then({
    prompt: "Create a blog post about quantum computing for beginners",
    agents: [researcher, writer, editor]
  })
  .run();
```

**[View more examples →](https://volcano.dev/docs/examples)**

## Documentation

### 📖 Comprehensive Guides
- **[Getting Started](https://volcano.dev/docs)** - Installation, quick start, core concepts
- **[LLM Providers](https://volcano.dev/docs/providers)** - OpenAI, Anthropic, Mistral, Llama, Bedrock, Vertex, Azure
- **[MCP Tools](https://volcano.dev/docs/mcp-tools)** - Automatic selection, OAuth authentication, connection pooling
- **[Advanced Patterns](https://volcano.dev/docs/patterns)** - Parallel, branching, loops, multi-LLM workflows
- **[Features](https://volcano.dev/docs/features)** - Streaming, retries, timeouts, hooks, error handling
- **[Observability](https://volcano.dev/docs/observability)** - OpenTelemetry traces and metrics
- **[API Reference](https://volcano.dev/docs/api)** - Complete API documentation
- **[Examples](https://volcano.dev/docs/examples)** - Ready-to-run code examples

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Questions or Feature Requests?

- 📝 [Report bugs or issues](https://github.com/Kong/volcano-sdk/issues)
- 💡 [Request features or ask questions](https://github.com/Kong/volcano-sdk/discussions)
- ⭐ [Star the project](https://github.com/Kong/volcano-sdk) if you find it useful

## License

Apache 2.0 - see [LICENSE](LICENSE) file for details.
