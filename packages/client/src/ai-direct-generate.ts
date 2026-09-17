import type { AiPreparedTagSuggestions, AiPreparedTextGeneration, CompanionDiscoveryItem, CompanionPreparedDiscovery } from "@edgeever/shared";
import { finalizeAiTagSuggestions, parseAiTagSuggestionNames } from "@edgeever/shared";
import { createClientAiModel } from "./ai-model";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? value as Record<string, unknown> : null;

const isProvider = (value: unknown): value is AiPreparedTextGeneration["provider"] =>
  value === "openai-compatible" || value === "anthropic" || value === "google";

export const parsePreparedAiText = (value: unknown): AiPreparedTextGeneration | null => {
  const record = asRecord(value);
  if (
    !record
    || !isProvider(record.provider)
    || typeof record.baseUrl !== "string"
    || typeof record.apiKey !== "string"
    || typeof record.modelId !== "string"
    || typeof record.system !== "string"
    || typeof record.prompt !== "string"
    || typeof record.maxOutputTokens !== "number"
  ) {
    return null;
  }
  return {
    provider: record.provider,
    baseUrl: record.baseUrl,
    apiKey: record.apiKey,
    modelId: record.modelId,
    system: record.system,
    prompt: record.prompt,
    maxOutputTokens: record.maxOutputTokens,
    ...(typeof record.temperature === "number" ? { temperature: record.temperature } : {}),
  };
};

export const parsePreparedTagSuggestions = (value: unknown): AiPreparedTagSuggestions | null => {
  const prepared = parsePreparedAiText(value);
  const record = asRecord(value);
  const canonical = asRecord(record?.canonicalTags);
  if (!prepared || !record || !Array.isArray(record.currentTags) || !canonical) return null;
  if (!record.currentTags.every((tag) => typeof tag === "string")) return null;
  const canonicalTags = Object.fromEntries(
    Object.entries(canonical).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  return { ...prepared, currentTags: record.currentTags, canonicalTags };
};

export const parsePreparedDiscovery = (value: unknown): CompanionPreparedDiscovery | null => {
  const record = asRecord(value);
  if (!record) return null;
  if (record.quiet === true) {
    return { quiet: true, items: Array.isArray(record.items) ? record.items as CompanionDiscoveryItem[] : [] };
  }
  if (
    record.quiet !== false
    || typeof record.turnId !== "string"
    || !isProvider(record.provider)
    || typeof record.baseUrl !== "string"
    || typeof record.apiKey !== "string"
    || typeof record.modelId !== "string"
    || typeof record.instructions !== "string"
    || typeof record.prompt !== "string"
    || typeof record.maxOutputTokens !== "number"
  ) {
    return null;
  }
  return {
    quiet: false,
    turnId: record.turnId,
    provider: record.provider,
    baseUrl: record.baseUrl,
    apiKey: record.apiKey,
    modelId: record.modelId,
    instructions: record.instructions,
    prompt: record.prompt,
    maxOutputTokens: record.maxOutputTokens,
  };
};

export const generateDirectAiText = async (
  prepared: AiPreparedTextGeneration,
  options: { fetch: typeof fetch; signal?: AbortSignal },
) => {
  const { generateText } = await import("ai");
  const result = await generateText({
    model: createClientAiModel({
      provider: prepared.provider,
      baseUrl: prepared.baseUrl,
      apiKey: prepared.apiKey,
      modelId: prepared.modelId,
      fetch: options.fetch,
    }),
    system: prepared.system,
    prompt: prepared.prompt,
    maxOutputTokens: prepared.maxOutputTokens,
    ...(prepared.temperature == null ? {} : { temperature: prepared.temperature }),
    abortSignal: options.signal,
  });
  return result.text;
};

export const generateDirectDiscoveryOutput = async (
  prepared: Extract<CompanionPreparedDiscovery, { quiet: false }>,
  options: { fetch: typeof fetch; signal?: AbortSignal },
) => {
  const { ToolLoopAgent, Output } = await import("ai");
  const { CompanionDiscoveryOutputSchema } = await import("@edgeever/shared");
  const agent = new ToolLoopAgent({
    model: createClientAiModel({
      provider: prepared.provider,
      baseUrl: prepared.baseUrl,
      apiKey: prepared.apiKey,
      modelId: prepared.modelId,
      fetch: options.fetch,
    }),
    maxRetries: 0,
    maxOutputTokens: prepared.maxOutputTokens,
    output: Output.object({ schema: CompanionDiscoveryOutputSchema }),
    instructions: prepared.instructions,
  });
  const result = await agent.generate({ prompt: prepared.prompt, abortSignal: options.signal });
  return result.output;
};

export const suggestionsFromDirectText = (
  text: string,
  prepared: AiPreparedTagSuggestions,
) => finalizeAiTagSuggestions(parseAiTagSuggestionNames(text), prepared.currentTags, prepared.canonicalTags);
