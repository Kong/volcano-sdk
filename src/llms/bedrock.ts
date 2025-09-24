import type { LLMHandle, LLMToolResult, ToolDefinition } from "./types.js";

type BedrockLikeClient = {
  send: (command: any) => Promise<any>;
};

export type BedrockConfig = {
  model?: string;
  client?: BedrockLikeClient;
  region?: string;
  // Explicit credentials (optional - falls back to AWS credential chain)
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  // Bearer token authentication
  bearerToken?: string;
  // AWS credential chain options
  profile?: string; // AWS profile name
  roleArn?: string; // Role ARN for assume role
};

export function llmBedrock(cfg: BedrockConfig): LLMHandle {
  if (!cfg.model) {
    throw new Error("llmBedrock: model parameter is required. Choose from Claude, Titan, Llama, or other available Bedrock models.");
  }
  const model = cfg.model;
  let client = cfg.client;

  // If no client provided, we'll create one with the specified configuration
  if (!client) {
    const region = cfg.region || "us-east-1";
    
    // Create a client wrapper that handles AWS SDK imports and configuration
    client = {
      send: async (command: any) => {
        try {
          // Dynamic import to avoid requiring AWS SDK as hard dependency
          const bedrockModule = await import('@aws-sdk/client-bedrock-runtime' as any);
          const { BedrockRuntimeClient } = bedrockModule;
          
          // Build client configuration based on provided options
          const clientConfig: any = { region };
          
          // Method 1: Explicit credentials (highest priority)
          if (cfg.accessKeyId && cfg.secretAccessKey) {
            clientConfig.credentials = {
              accessKeyId: cfg.accessKeyId,
              secretAccessKey: cfg.secretAccessKey,
              ...(cfg.sessionToken ? { sessionToken: cfg.sessionToken } : {})
            };
          }
          // Method 2: Bearer token authentication
          else if (cfg.bearerToken) {
            // For bearer token auth, we need to create a custom credential provider
            clientConfig.credentials = {
              accessKeyId: 'BEARER_TOKEN_ACCESS',
              secretAccessKey: 'BEARER_TOKEN_SECRET',
              sessionToken: cfg.bearerToken
            };
            // Add custom headers for bearer token if needed
            clientConfig.requestHandler = {
              updateHttpClientConfig: (httpClientConfig: any) => {
                httpClientConfig.headers = {
                  ...httpClientConfig.headers,
                  'Authorization': `Bearer ${cfg.bearerToken}`
                };
              }
            };
          }
          // Method 3: AWS profile
          else if (cfg.profile) {
            const { fromIni } = await import('@aws-sdk/credential-providers' as any);
            clientConfig.credentials = fromIni({ profile: cfg.profile });
          }
          // Method 4: Assume role
          else if (cfg.roleArn) {
            const { fromTemporaryCredentials } = await import('@aws-sdk/credential-providers' as any);
            clientConfig.credentials = fromTemporaryCredentials({
              params: { RoleArn: cfg.roleArn, RoleSessionName: 'volcano-sdk-session' }
            });
          }
          // Method 5: Default credential chain (environment vars, instance profiles, etc.)
          // No explicit configuration needed - AWS SDK handles this automatically
          
          const bedrockClient = new BedrockRuntimeClient(clientConfig);
          return await bedrockClient.send(command);
          
        } catch (importError: any) {
          if (importError.code === 'ERR_MODULE_NOT_FOUND' || importError.message?.includes('Cannot resolve module')) {
            throw new Error(
              'AWS SDK for Bedrock not found. Install with:\n' +
              '  npm install @aws-sdk/client-bedrock-runtime\n' +
              '  npm install @aws-sdk/credential-providers\n' +
              'Or provide a custom client via the client parameter.'
            );
          }
          throw importError;
        }
      }
    } as BedrockLikeClient;
  }

  // Note: if no client and no config, we'll still create the handle but it will fail at runtime
  // This allows for flexible configuration scenarios

  return {
    id: `Bedrock-${model.split("/").pop() || model}`,
    model,
    client,
    async gen(prompt: string): Promise<string> {
      const bedrockModule = await import('@aws-sdk/client-bedrock-runtime' as any);
      const { ConverseCommand } = bedrockModule;
      
      const command = new ConverseCommand({
        modelId: model,
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 256 },
      });
      
      const resp = await client!.send(command);
      const content = resp?.output?.message?.content || [];
      const text = content.find((c: any) => c?.text)?.text || "";
      return typeof text === "string" ? text : JSON.stringify(text);
    },
    async genWithTools(prompt: string, tools: ToolDefinition[]): Promise<LLMToolResult> {
      const bedrockModule = await import('@aws-sdk/client-bedrock-runtime' as any);
      const { ConverseCommand } = bedrockModule;
      
      const nameMap = new Map<string, { dottedName: string; def: ToolDefinition }>();
      const bedrockTools = tools.map((tool) => {
        const dottedName = tool.name;
        const sanitized = dottedName.replace(/[^a-zA-Z0-9_-]/g, "_");
        nameMap.set(sanitized, { dottedName, def: tool });
        return {
          toolSpec: {
            name: sanitized,
            description: tool.description,
            inputSchema: {
              json: tool.parameters,
            },
          },
        };
      });

      const command = new ConverseCommand({
        modelId: model,
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 256 },
        toolConfig: {
          tools: bedrockTools,
        },
      });

      const resp = await client!.send(command);
      const content = resp?.output?.message?.content || [];
      
      const toolCalls: any[] = [];
      let textContent = "";

      for (const block of content) {
        if (block?.toolUse) {
          const toolUse = block.toolUse;
          const sanitizedName = toolUse.name || "";
          const mapped = nameMap.get(sanitizedName);
          toolCalls.push({
            name: mapped?.dottedName ?? sanitizedName,
            arguments: toolUse.input || {},
            mcpHandle: mapped?.def.mcpHandle,
          });
        } else if (block?.text) {
          textContent += block.text;
        }
      }

      return {
        content: textContent || undefined,
        toolCalls,
      };
    },
    async *genStream(prompt: string): AsyncGenerator<string, void, unknown> {
      try {
        const bedrockModule = await import('@aws-sdk/client-bedrock-runtime' as any);
        const { ConverseStreamCommand } = bedrockModule;
        
        const command = new ConverseStreamCommand({
          modelId: model,
          messages: [{ role: "user", content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens: 256 },
        });
        
        const response = await client!.send(command);
        
        // Handle Bedrock streaming response
        if (response.stream) {
          for await (const chunk of response.stream) {
            if (chunk.contentBlockDelta?.delta?.text) {
              yield chunk.contentBlockDelta.delta.text;
            }
          }
          return;
        }
      } catch (error: any) {
        // If ConverseStreamCommand not available or fails, use regular generation
        if (error.code === 'ERR_MODULE_NOT_FOUND' || error.name === 'TypeError') {
          const full = await this.gen(prompt);
          if (full) yield full;
          return;
        }
        throw error;
      }
      
      // If no stream available
      const full = await this.gen(prompt);
      if (full) yield full;
    },
  };
}
