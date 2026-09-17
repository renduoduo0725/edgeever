import type {
  CompanionEvent,
  CompanionPreparedTurn,
  CompanionQuestion,
  CompanionTodo,
  CompanionToolCall,
  CompanionToolExecuteResult,
  CompanionTurn,
  CompanionTurnCompleteInput,
} from "@edgeever/shared";
import { sealCompanionProcess } from "@edgeever/shared";
import { isAiCorsFailure } from "./ai-direct-stream";
import { createClientAiModel } from "./ai-model";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? value as Record<string, unknown> : null;

const asString = (value: unknown) => typeof value === "string" ? value : null;

export const parsePreparedCompanion = (value: unknown): CompanionPreparedTurn | null => {
  const record = asRecord(value);
  const turn = asRecord(record?.turn);
  if (
    !record
    || !turn
    || (record.provider !== "openai-compatible" && record.provider !== "anthropic" && record.provider !== "google")
    || typeof record.baseUrl !== "string"
    || typeof record.apiKey !== "string"
    || typeof record.modelId !== "string"
    || typeof record.instructions !== "string"
    || typeof turn.id !== "string"
    || !Array.isArray(record.messages)
    || !Array.isArray(record.tools)
    || typeof record.maxSteps !== "number"
    || typeof record.maxOutputTokens !== "number"
  ) {
    return null;
  }
  const messages = record.messages.flatMap((item) => {
    const message = asRecord(item);
    if (!message || (message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") {
      return [];
    }
    return [{ role: message.role as "user" | "assistant", content: message.content }];
  });
  const tools = record.tools.flatMap((item) => {
    const tool = asRecord(item);
    const inputSchema = asRecord(tool?.inputSchema);
    if (!tool || typeof tool.name !== "string" || typeof tool.description !== "string" || !inputSchema) return [];
    return [{ name: tool.name, description: tool.description, inputSchema }];
  });
  return {
    turn: turn as unknown as CompanionTurn,
    provider: record.provider,
    baseUrl: record.baseUrl,
    apiKey: record.apiKey,
    modelId: record.modelId,
    instructions: record.instructions,
    messages,
    tools,
    maxSteps: record.maxSteps,
    maxOutputTokens: record.maxOutputTokens,
  };
};

export const companionDirectFailureCode = (error: unknown): string => {
  const record = asRecord(error);
  const status = typeof record?.statusCode === "number" ? record.statusCode
    : typeof record?.status === "number" ? record.status : undefined;
  const code = asString(record?.code);
  if (code === "companion_context_changed" || code === "ai_not_configured" || code === "ai_credentials_rejected") return code;
  if (status === 401 || status === 403) return "ai_credentials_rejected";
  if (status === 402) return "ai_provider_payment_required";
  if (status === 429) return "ai_provider_rate_limited";
  if (status === 400) return "ai_provider_request_rejected";
  return "companion_generation_failed";
};

const usageFrom = (value: unknown): { inputTokens?: number; outputTokens?: number } => {
  const record = asRecord(value);
  const inputTokens = typeof record?.inputTokens === "number" ? record.inputTokens
    : typeof record?.promptTokens === "number" ? record.promptTokens : undefined;
  const outputTokens = typeof record?.outputTokens === "number" ? record.outputTokens
    : typeof record?.completionTokens === "number" ? record.completionTokens : undefined;
  return { inputTokens, outputTokens };
};

export const streamDirectCompanion = async (
  prepared: CompanionPreparedTurn,
  options: {
    fetch: typeof fetch;
    signal?: AbortSignal;
    onEvent: (event: CompanionEvent) => void;
    executeTool: (body: {
      name: string;
      input: Record<string, unknown>;
      response: string;
      process: string;
    }) => Promise<CompanionToolExecuteResult>;
    checkpoint: (body: { response: string; process: string }) => Promise<void>;
    complete: (body: CompanionTurnCompleteInput) => Promise<{ turn: CompanionTurn }>;
  },
) => {
  const { ToolLoopAgent, isStepCount, jsonSchema, tool } = await import("ai");
  let response = prepared.turn.response ?? "";
  let process = prepared.turn.process ?? "";
  let persisted = response.length;
  let tools: CompanionToolCall[] = prepared.turn.tools ?? [];
  let todos: CompanionTodo[] = prepared.turn.todos ?? [];
  let questions: CompanionQuestion[] = prepared.turn.questions ?? [];
  const pause = { ask: false };

  options.onEvent({ type: "start", id: prepared.turn.id });
  if (process) options.onEvent({ type: "process", text: process });
  if (tools.length || todos.length) options.onEvent({ type: "tools", tools, todos, questions });

  const sealProcess = () => {
    if (!response.trim()) return;
    ({ process, response } = sealCompanionProcess(process, response));
    persisted = 0;
    options.onEvent({ type: "process", text: process });
  };

  const finish = async (status: CompanionTurnCompleteInput["status"], usage?: { inputTokens?: number; outputTokens?: number }, error?: unknown) => {
    try {
      const completed = await options.complete({
        response, process, status, inputTokens: usage?.inputTokens, outputTokens: usage?.outputTokens,
      });
      if (status === "failed" && error) options.onEvent({ type: "error", code: companionDirectFailureCode(error) });
      else options.onEvent({ type: "done", turn: completed.turn });
    } catch (completeError) {
      options.onEvent({ type: "error", code: companionDirectFailureCode(completeError) });
    }
  };

  try {
    const agentTools = Object.fromEntries(prepared.tools.map((definition) => [
      definition.name,
      tool({
        description: definition.description,
        inputSchema: jsonSchema(definition.inputSchema),
        execute: async (input: unknown) => {
          sealProcess();
          const pending: CompanionToolCall = {
            id: crypto.randomUUID(), name: definition.name, status: "running", effects: [],
          };
          tools = [...tools, pending];
          options.onEvent({ type: "tools", tools, todos, questions });
          const result = await options.executeTool({
            name: definition.name,
            input: (input && typeof input === "object" ? input : {}) as Record<string, unknown>,
            response,
            process,
          });
          tools = result.tools;
          todos = result.todos;
          questions = result.questions;
          if (result.pause) pause.ask = true;
          options.onEvent({ type: "tools", tools, todos, questions });
          return result.result;
        },
      }),
    ]));

    const agent = new ToolLoopAgent({
      model: createClientAiModel({
        provider: prepared.provider,
        baseUrl: prepared.baseUrl,
        apiKey: prepared.apiKey,
        modelId: prepared.modelId,
        fetch: options.fetch,
      }),
      instructions: prepared.instructions,
      tools: agentTools,
      stopWhen: [isStepCount(prepared.maxSteps), () => pause.ask],
      maxOutputTokens: prepared.maxOutputTokens,
      maxRetries: 0,
    });
    const result = await agent.stream({
      messages: prepared.messages,
      abortSignal: options.signal,
    });
    for await (const part of result.fullStream) {
      options.signal?.throwIfAborted();
      if (part.type === "error") throw part.error;
      if (part.type !== "text-delta") continue;
      const delta = typeof part.text === "string" ? part.text : "";
      if (!delta) continue;
      response += delta;
      if (response.length > 16000) throw new Error("Response limit exceeded.");
      options.onEvent({ type: "text-delta", text: delta });
      if (response.length - persisted >= 300) {
        await options.checkpoint({ response, process });
        persisted = response.length;
      }
    }
    if (!response.trim() && !tools.some(item => item.status === "done") && !todos.length && !questions.length) {
      throw new Error("No text returned.");
    }
    const usage = usageFrom(await result.totalUsage);
    await finish(pause.ask || questions.length ? "interrupted" : "completed", usage);
  } catch (error) {
    if (options.signal?.aborted) {
      await finish("interrupted");
      return;
    }
    if (isAiCorsFailure(error)) throw error;
    await finish("failed", undefined, error);
  }
};
