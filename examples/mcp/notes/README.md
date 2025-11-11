# Notes MCP Server

Knowledge management and note-taking service.

## Quick Start

```bash
cd examples/mcp/notes
tsx server.ts
```

Server runs on **http://localhost:8003/mcp**

## Tools

### `create_note(title, content, tags?)`
Create a new note.

**Parameters:**
- `title` (string) - Note title
- `content` (string) - Note content
- `tags` (optional array) - Tags for organization

**Returns:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Meeting Notes",
  "content": "Discussed Q4 roadmap...",
  "tags": ["work", "planning"]
}
```

### `search_notes(query)`
Search notes by keyword.

**Parameters:**
- `query` (string) - Search term

**Returns:**
```json
[
  { "id": "...", "title": "Meeting Notes", "content": "...", "tags": ["work"] }
]
```

### `get_note(noteId)`
Get a specific note by ID.

**Parameters:**
- `noteId` (string) - Note ID

**Returns:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Meeting Notes",
  "content": "Discussed Q4 roadmap...",
  "tags": ["work", "planning"]
}
```

### `list_all_notes()`
List all notes.

**Returns:**
```json
[
  { "id": "...", "title": "Note 1", "content": "...", "tags": [] },
  { "id": "...", "title": "Note 2", "content": "...", "tags": ["important"] }
]
```

## Example Usage

```typescript
import { agent, llmOpenAI, mcp } from "volcano-sdk";

const notes = mcp("http://localhost:8003/mcp");

await agent({ llm })
  .then({
    prompt: "Create a note summarizing our meeting about the product launch",
    mcps: [notes]
  })
  .run();
```

