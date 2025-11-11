# Calculator MCP Server

Mathematical operations and unit conversion service.

## Quick Start

```bash
cd examples/mcp/calculator
tsx server.ts
```

Server runs on **http://localhost:8004/mcp**

## Tools

### `calculate(expression)`
Evaluate a mathematical expression.

**Parameters:**
- `expression` (string) - Math expression like "2 + 2", "(100 - 20) * 1.5", "50 / 2"

**Returns:**
```json
{
  "expression": "2 + 2",
  "result": 4
}
```

**Note:** For security, only basic math operators are supported: +, -, *, /, %, ()

### `convert_units(value, from, to)`
Convert between units.

**Parameters:**
- `value` (number) - Value to convert
- `from` (string) - Source unit
- `to` (string) - Target unit

**Supported conversions:**
- **Distance**: km, miles, m, ft
- **Weight**: kg, lb, g
- **Temperature**: C, F, K

**Returns:**
```json
{
  "value": 100,
  "from": "km",
  "to": "miles",
  "result": 62.14
}
```

## Example Usage

```typescript
import { agent, llmOpenAI, mcp } from "volcano-sdk";

const calc = mcp("http://localhost:8004/mcp");

await agent({ llm })
  .then({
    prompt: "If I drive 150km, how many miles is that? And calculate 15% tip on $45",
    mcps: [calc]
  })
  .run();
```

