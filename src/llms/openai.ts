import OpenAI from "openai";
import type { LLMHandle, LLMToolResult, ToolDefinition } from "./types";

export function llmOpenAI(id: string, cfg: { apiKey: string; model?: string; baseURL?: string }): LLMHandle {
  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  const model = cfg.model ?? "gpt-4o-mini";
  return {
    id,
    client,
    model,
    gen: async (prompt: string) => {
      const r = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
      });
      return r.choices?.[0]?.message?.content ?? "";
    },
    genWithTools: async (prompt: string, tools: ToolDefinition[]): Promise<LLMToolResult> => {
      const nameMap = new Map<string, { dottedName: string; def: ToolDefinition }>();
      const openaiTools = tools.map((tool) => {
        const dottedName = tool.name;
        const sanitized = dottedName.replace(/[^a-zA-Z0-9_-]/g, "_");
        nameMap.set(sanitized, { dottedName, def: tool });
        return {
          type: "function" as const,
          function: {
            name: sanitized,
            description: tool.description,
            parameters: tool.parameters,
          },
        };
      });

      const r = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        tools: openaiTools,
        tool_choice: "auto",
      });

      const message: any = r.choices?.[0]?.message as any;
      const rawCalls: any[] = (message?.tool_calls ?? []) as any[];
      const toolCalls = rawCalls.map((call: any) => {
        const sanitizedName: string = call?.function?.name ?? call?.name ?? "";
        const mapped = nameMap.get(sanitizedName);
        const argsJson: string = call?.function?.arguments ?? call?.arguments ?? "{}";
        const parsedArgs = (() => { try { return JSON.parse(argsJson); } catch { return {}; } })();
        const mcpHandle = mapped?.def.mcpHandle;
        return {
          name: mapped?.dottedName ?? sanitizedName,
          arguments: parsedArgs,
          mcpHandle,
        };
      });

      return {
        content: message?.content || undefined,
        toolCalls,
      };
    },
  };
}
