import type { LLMHandle, LLMToolResult, ToolDefinition } from "./types.js";

type VertexStudioClient = {
  generateContent: (params: any) => Promise<any>;
};

export type VertexStudioConfig = {
  model: string; // Required: "gemini-1.5-pro", "gemini-2.5-flash-lite", etc.
  apiKey: string; // Google AI Studio API key
  baseURL?: string; // Default: "https://aiplatform.googleapis.com/v1"
  client?: VertexStudioClient;
};

export function llmVertexStudio(cfg: VertexStudioConfig): LLMHandle {
  if (!cfg.model) {
    throw new Error("llmVertexStudio: model parameter is required. Choose from Gemini models available in AI Studio.");
  }
  if (!cfg.apiKey && !cfg.client) {
    throw new Error("llmVertexStudio: apiKey parameter is required, or provide a custom client.");
  }

  const model = cfg.model;
  const baseURL = (cfg.baseURL || "https://aiplatform.googleapis.com/v1").replace(/\/$/, "");
  let client = cfg.client;

  if (!client) {
    client = {
      generateContent: async (params: any) => {
        const endpoint = `${baseURL}/publishers/google/models/${model}:generateContent?key=${cfg.apiKey}`;
        
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          const text = await response.text();
          const err: any = new Error(`Vertex Studio HTTP ${response.status}`);
          err.status = response.status;
          err.body = text;
          throw err;
        }

        return await response.json();
      },
    } as VertexStudioClient;
  }

  return {
    id: `VertexStudio-${model}`,
    model,
    client,
    async gen(prompt: string): Promise<string> {
      const params = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 256,
        },
      };

      const resp = await client!.generateContent(params);
      const candidates = resp?.candidates || [];
      const content = candidates[0]?.content?.parts || [];
      const text = content.find((part: any) => part?.text)?.text || "";
      return typeof text === "string" ? text : JSON.stringify(text);
    },
    async genWithTools(prompt: string, tools: ToolDefinition[]): Promise<LLMToolResult> {
      const nameMap = new Map<string, { dottedName: string; def: ToolDefinition }>();
      const geminiTools = tools.map((tool) => {
        const dottedName = tool.name;
        const sanitized = dottedName.replace(/[^a-zA-Z0-9_-]/g, "_");
        nameMap.set(sanitized, { dottedName, def: tool });
        
        // Clean the parameters to remove any $schema or other unsupported fields
        const cleanParams = { ...tool.parameters };
        delete cleanParams.$schema;
        delete cleanParams.$id;
        delete cleanParams.$ref;
        
        return {
          functionDeclarations: [{
            name: sanitized,
            description: tool.description,
            parameters: cleanParams,
          }]
        };
      });

      const params = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        tools: geminiTools,
        generationConfig: {
          maxOutputTokens: 256,
        },
      };

      const resp = await client!.generateContent(params);
      const candidates = resp?.candidates || [];
      const content = candidates[0]?.content?.parts || [];
      
      const toolCalls: any[] = [];
      let textContent = "";

      for (const part of content) {
        if (part?.functionCall) {
          const functionCall = part.functionCall;
          const sanitizedName = functionCall.name || "";
          const mapped = nameMap.get(sanitizedName);
          toolCalls.push({
            name: mapped?.dottedName ?? sanitizedName,
            arguments: functionCall.args || {},
            mcpHandle: mapped?.def.mcpHandle,
          });
        } else if (part?.text) {
          textContent += part.text;
        }
      }

      return {
        content: textContent || undefined,
        toolCalls,
      };
    },
    async *genStream(prompt: string): AsyncGenerator<string, void, unknown> {
      // Use Google's streaming endpoint
      const endpoint = `${baseURL}/publishers/google/models/${model}:streamGenerateContent?key=${cfg.apiKey}`;
      
      const params = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 256,
        },
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`Vertex Studio streaming failed: ${response.status}`);
      }

      // Google streams as array of JSON objects with incremental parsing
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            // Try to extract complete JSON objects from buffer
            while (true) {
              // Find the start of a JSON object
              const startIdx = buffer.indexOf('{');
              if (startIdx === -1) break;
              
              // Find the matching closing brace
              let braceCount = 0;
              let inString = false;
              let escapeNext = false;
              let endIdx = -1;
              
              for (let i = startIdx; i < buffer.length; i++) {
                const char = buffer[i];
                
                if (!inString) {
                  if (char === '{') braceCount++;
                  else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                      endIdx = i;
                      break;
                    }
                  }
                  else if (char === '"') inString = true;
                } else {
                  if (escapeNext) {
                    escapeNext = false;
                  } else if (char === '\\') {
                    escapeNext = true;
                  } else if (char === '"') {
                    inString = false;
                  }
                }
              }
              
              if (endIdx === -1) break; // Incomplete JSON object
              
              // Extract complete JSON object
              const jsonStr = buffer.slice(startIdx, endIdx + 1);
              buffer = buffer.slice(endIdx + 1);
              
              try {
                const parsed = JSON.parse(jsonStr);
                const candidates = parsed?.candidates || [];
                const parts = candidates[0]?.content?.parts || [];
                const text = parts.find((p: any) => p?.text)?.text;
                if (typeof text === 'string' && text.length > 0) {
                  yield text;
                }
              } catch {
                continue;
              }
            }
          }
          
        } finally {
          reader.releaseLock();
        }
        return;
      }
      
      // If no body, something went wrong
      throw new Error('No response body received from Vertex Studio streaming endpoint');
    },
  };
}
