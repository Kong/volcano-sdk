# 🌋 Volcano SDK

Build AI agents that seamlessly combine LLM reasoning with real-world actions via MCP tools — in just a few lines of TypeScript.

## Why Volcano SDK

- ⚡️ **Tiny, modern API**: Chain steps with `.then()` and `.run()`
- ✨ **Automatic tool selection**: Let the LLM choose which MCP tools to call
- 🔧 **MCP (Streamable HTTP)**: Works out of the box with MCP servers
- 🧩 **Pluggable LLM providers**: Providers live in `src/llms/` (OpenAI included)
- 🛡 **TypeScript-first**: Strong types with minimal ceremony

## Install

```bash
npm install volcano-sdk
npm install @modelcontextprotocol/sdk openai
```

## 60‑Second Quickstart

```ts
import { agent, llmOpenAI, mcp } from "volcano-sdk";

// 1) Create an LLM handle (set OPENAI_API_KEY in your env)
const llm = llmOpenAI("default", { apiKey: process.env.OPENAI_API_KEY! });

// 2) Point to your MCP services (Streamable HTTP)
const astro = mcp("astro", "http://localhost:3211/mcp");
const favorites = mcp("favorites", "http://localhost:3212/mcp");

// 3) One‑liner: The LLM discovers & calls the right tools automatically
const results = await agent()
  .then({
    prompt: "For birthdate 1993-07-11, determine the sign and then my favorite food and drink.",
    llm,
    mcps: [astro, favorites]
  })
  .run();

console.log(results[0]);
```

Tip: You can run your own MCP services or use the mock servers in this repo (see tests under `mcp/`).

## Examples You’ll Want to Try

### A. Automatic tool selection (one step)

```ts
import { agent, llmOpenAI, mcp } from "volcano-sdk";

const llm = llmOpenAI("default", { apiKey: process.env.OPENAI_API_KEY! });
const weather = mcp("weather", "http://localhost:3000/mcp");
const notifications = mcp("notifications", "http://localhost:4000/mcp");

await agent()
  .then({
    prompt: "Check SF weather for tomorrow and send me a friendly notification.",
    llm,
    mcps: [weather, notifications]
  })
  .run(console.log);
```

### B. Two steps, still automatic

```ts
import { agent, llmOpenAI, mcp } from "volcano-sdk";

const llm = llmOpenAI("default", { apiKey: process.env.OPENAI_API_KEY! });
const astro = mcp("astro", "http://localhost:3211/mcp");
const favorites = mcp("favorites", "http://localhost:3212/mcp");

await agent()
  .then({
    prompt: "Find the astrological sign for 1993-07-11.",
    llm,
    mcps: [astro]
  })
  .then({
    prompt: "Based on the sign Cancer, what are my favorite food and drink?",
    llm,
    mcps: [favorites]
  })
  .run(console.log);
```

### C. Explicit control (when you need it)

```ts
import { agent, llmOpenAI, mcp } from "volcano-sdk";

const llm = llmOpenAI("default", { apiKey: process.env.OPENAI_API_KEY! });
const cafe = mcp("cafe", "http://localhost:3000/mcp");

await agent()
  .then({ prompt: "Recommend a coffee for Ava Rossi from Naples", llm })
  .then({ mcp: cafe, tool: "order_item", args: { item_id: "espresso" } })
  .run(console.log);
```

## API (tiny and familiar)

- `llmOpenAI(id, { apiKey, model?, baseURL? }) => LLMHandle`
- `mcp(id, url) => MCPHandle`
- `agent() => { then(step), run(log?) }`
  - Steps:
    - `{ prompt, llm }` (LLM only)
    - `{ mcp, tool, args? }` (MCP tool only)
    - `{ prompt, llm, mcps: MCPHandle[] }` (automatic tool selection)

Each step returns:

```ts
type StepResult = {
  prompt?: string;
  llmOutput?: string;
  mcp?: { endpoint: string; tool: string; result: any };
  toolCalls?: Array<{ name: string; endpoint: string; result: any }>;
};
```

## Providers

- OpenAI is provided out of the box (`llmOpenAI`).
- Providers live under `src/llms/` and are re‑exported from the SDK entry.
- Add your own provider by returning an `LLMHandle` that supports `gen()` and `genWithTools()`.

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