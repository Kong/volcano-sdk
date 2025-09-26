import type { LLMHandle, LLMToolResult, ToolDefinition } from "./types.js";

type AzureAIClient = {
  createResponse: (params: any) => Promise<any>;
};

export type AzureConfig = {
  model: string; // Required - no default (e.g., "gpt-5-mini")
  endpoint: string; // Required - Azure resource endpoint
  apiVersion?: string; // Default: "2025-04-01-preview"
  
  // Authentication methods (in priority order)
  apiKey?: string; // API key authentication
  accessToken?: string; // Entra ID access token
  
  // Custom client
  client?: AzureAIClient;
};

export function llmAzure(cfg: AzureConfig): LLMHandle {
  if (!cfg.model) {
    throw new Error("llmAzure: model parameter is required. Specify the Azure deployment model name.");
  }
  if (!cfg.endpoint) {
    throw new Error("llmAzure: endpoint parameter is required. Specify your Azure OpenAI resource endpoint.");
  }

  const model = cfg.model;
  const endpoint = cfg.endpoint.replace(/\/$/, "");
  const apiVersion = cfg.apiVersion || "2025-04-01-preview";
  let client = cfg.client;

  if (!client) {
    client = {
      createResponse: async (params: any) => {
        const url = `${endpoint}?api-version=${apiVersion}`;
        
        // Determine authentication method
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        
        // Priority 1: API Key
        if (cfg.apiKey) {
          headers["api-key"] = cfg.apiKey;
        }
        // Priority 2: Entra ID Access Token
        else if (cfg.accessToken) {
          headers["Authorization"] = `Bearer ${cfg.accessToken}`;
        }
        // Priority 3: Try to get token from Azure SDK (dynamic import)
        else {
          try {
            const { DefaultAzureCredential } = await import('@azure/identity' as any);
            const credential = new DefaultAzureCredential();
            const tokenResponse = await credential.getToken('https://cognitiveservices.azure.com/.default');
            headers["Authorization"] = `Bearer ${tokenResponse.token}`;
          } catch (error: any) {
            if (error.code === 'ERR_MODULE_NOT_FOUND') {
              throw new Error(
                'Azure Identity SDK not found and no explicit credentials provided.\n' +
                'Install with: npm install @azure/identity\n' +
                'Or provide apiKey or accessToken parameters.'
              );
            }
            throw new Error(`Azure authentication failed: ${error.message}`);
          }
        }

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          const text = await response.text();
          const err: any = new Error(`Azure AI HTTP ${response.status}`);
          err.status = response.status;
          err.body = text;
          throw err;
        }

        // Handle streaming responses
        if (params.stream) {
          return response; // Return response object for streaming
        }

        return await response.json();
      },
    } as AzureAIClient;
  }

  return {
    id: `Azure-${model}`,
    model,
    client,
    async gen(prompt: string): Promise<string> {
      const params = {
        model,
        input: [
          {
            role: "user",
            content: prompt
          }
        ]
      };

      const resp = await client!.createResponse(params);
      const output = resp?.output || [];
      const messageOutput = output.find((item: any) => item?.type === 'message');
      const content = messageOutput?.content || [];
      const text = content.find((item: any) => item?.type === 'output_text')?.text || "";
      return typeof text === "string" ? text : JSON.stringify(text);
    },
    async genWithTools(prompt: string, tools: ToolDefinition[]): Promise<LLMToolResult> {
      const nameMap = new Map<string, { dottedName: string; def: ToolDefinition }>();
      const azureTools = tools.map((tool) => {
        const dottedName = tool.name;
        const sanitized = dottedName.replace(/[^a-zA-Z0-9_-]/g, "_");
        nameMap.set(sanitized, { dottedName, def: tool });
        return {
          type: "function" as const,
          name: sanitized,
          description: tool.description,
          parameters: tool.parameters,
        };
      });

      const params = {
        model,
        input: [
          {
            role: "user",
            content: prompt
          }
        ],
        tools: azureTools,
        tool_choice: "auto",
      };

      const resp = await client!.createResponse(params);
      const output = resp?.output || [];
      
      const toolCalls: any[] = [];
      let textContent = "";

      // Azure puts different types directly in the output array
      for (const item of output) {
        if (item?.type === 'function_call') {
          // Azure function call format
          const sanitizedName = item?.name || "";
          const mapped = nameMap.get(sanitizedName);
          const args = item?.arguments;
          const parsedArgs = typeof args === 'string' ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : (args || {});
          
          toolCalls.push({
            name: mapped?.dottedName ?? sanitizedName,
            arguments: parsedArgs,
            mcpHandle: mapped?.def.mcpHandle,
          });
        } else if (item?.type === 'message') {
          // Extract text from message content
          const content = item?.content || [];
          for (const contentItem of content) {
            if (contentItem?.type === 'output_text') {
              textContent += contentItem?.text || "";
            }
          }
        }
      }
      
      // Ensure we always have some content even if it's empty string
      const finalContent = textContent || undefined;

      return {
        content: finalContent,
        toolCalls,
      };
    },
    async *genStream(prompt: string): AsyncGenerator<string, void, unknown> {
      const url = `${endpoint}?api-version=${apiVersion}`;
      
      const params = {
        model,
        input: [
          {
            role: "user",
            content: prompt
          }
        ],
        stream: true
      };

      // Determine authentication headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (cfg.apiKey) {
        headers["api-key"] = cfg.apiKey;
      } else if (cfg.accessToken) {
        headers["Authorization"] = `Bearer ${cfg.accessToken}`;
      } else {
        // Try Azure SDK
        try {
          const { DefaultAzureCredential } = await import('@azure/identity' as any);
          const credential = new DefaultAzureCredential();
          const tokenResponse = await credential.getToken('https://cognitiveservices.azure.com/.default');
          headers["Authorization"] = `Bearer ${tokenResponse.token}`;
        } catch (error: any) {
          throw new Error(`Azure authentication failed for streaming: ${error.message}`);
        }
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`Azure AI streaming failed: ${response.status}`);
      }

      // Handle Azure streaming response (likely Server-Sent Events)
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.trim() === '' || line.startsWith(':')) continue;
              if (line === 'data: [DONE]') return;
              if (line.startsWith('data: ')) {
                try {
                  const jsonData = line.slice(6);
                  const parsed = JSON.parse(jsonData);
                  
                  // Extract text from Azure response format
                  const output = parsed?.output || [];
                  const messageOutput = output.find((item: any) => item?.type === 'message');
                  const content = messageOutput?.content || [];
                  const textItem = content.find((item: any) => item?.type === 'output_text');
                  const text = textItem?.text;
                  
                  if (typeof text === 'string' && text.length > 0) {
                    yield text;
                  }
                } catch {
                  continue;
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
        return;
      }
      
      throw new Error('No response body received from Azure AI streaming endpoint');
    },
  };
}
