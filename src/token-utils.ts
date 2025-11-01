import type { TokenUsage } from "./llms/types.js";

// Handles OpenAI, Anthropic, Bedrock, Azure, and Vertex Studio formats
export function normalizeTokenUsage(usage: any): TokenUsage | null {
  if (!usage) return null;

  // Handle Vertex Studio format (usageMetadata)
  if (usage.promptTokenCount !== undefined || usage.candidatesTokenCount !== undefined) {
    return {
      inputTokens: usage.promptTokenCount || 0,
      outputTokens: usage.candidatesTokenCount || 0,
      totalTokens: usage.totalTokenCount || (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0)
    };
  }

  // Handle all other formats (OpenAI, Anthropic, Bedrock, Azure)
  const inputTokens = usage.inputTokens || usage.input_tokens || usage.prompt_tokens || 0;
  const outputTokens = usage.outputTokens || usage.output_tokens || usage.completion_tokens || 0;
  const totalTokens = usage.totalTokens || usage.total_tokens || inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens
  };
}

export function recordTokenMetrics(
  telemetry: any,
  usage: TokenUsage | null,
  attributes: { provider: string; model: string; agent_name?: string }
): void {
  if (!usage || !telemetry) return;

  const attrs = {
    provider: attributes.provider,
    model: attributes.model,
    agent_name: attributes.agent_name || 'anonymous'
  };

  if (usage.inputTokens) {
    telemetry.recordMetric('llm.tokens.input', usage.inputTokens, attrs);
  }
  if (usage.outputTokens) {
    telemetry.recordMetric('llm.tokens.output', usage.outputTokens, attrs);
  }
  if (usage.totalTokens) {
    telemetry.recordMetric('llm.tokens.total', usage.totalTokens, attrs);
    telemetry.recordMetric('agent.tokens', usage.totalTokens, { 
      agent_name: attrs.agent_name 
    });
  }
}

export function getLLMProviderId(llm: any): string {
  return (llm as any).id || llm.model || 'unknown';
}

