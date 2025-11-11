#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

const server = new McpServer({ 
  name: 'filesystem', 
  version: '1.0.0' 
});

server.tool(
  'list_directory',
  'List files in a directory',
  { 
    path: z.string().describe('Directory path'),
    pattern: z.string().optional().describe('Filter pattern (e.g., "*.ts")')
  },
  async ({ path, pattern }) => {
    const dirPath = resolve(path);
    const files = await readdir(dirPath);
    
    const filtered = pattern 
      ? files.filter(f => f.includes(pattern.replace('*.', '.')))
      : files;
    
    return { 
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ path: dirPath, files: filtered }) 
      }] 
    };
  }
);

server.tool(
  'read_file',
  'Read contents of a file',
  { path: z.string().describe('File path') },
  async ({ path }) => {
    const content = await readFile(resolve(path), 'utf-8');
    return { 
      content: [{ 
        type: 'text', 
        text: content 
      }] 
    };
  }
);

server.tool(
  'write_file',
  'Write content to a file',
  { 
    path: z.string().describe('File path'),
    content: z.string().describe('File content')
  },
  async ({ path, content }) => {
    await writeFile(resolve(path), content, 'utf-8');
    return { 
      content: [{ 
        type: 'text', 
        text: `Wrote ${content.length} bytes to ${path}` 
      }] 
    };
  }
);

server.tool(
  'search_files',
  'Search for text in files',
  { 
    directory: z.string().describe('Directory to search'),
    query: z.string().describe('Text to search for')
  },
  async ({ directory, query }) => {
    const files = await readdir(resolve(directory));
    const matches: string[] = [];
    
    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;
      
      const content = await readFile(join(resolve(directory), file), 'utf-8');
      if (content.includes(query)) {
        matches.push(file);
      }
    }
    
    return { 
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ query, matches }) 
      }] 
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

// Stdio servers don't print to console (it interferes with the protocol)
// The server is now ready and listening on stdin/stdout

