import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { AiProvider } from "@edgeever/shared";

export const openaiCompatibleHeaders = (baseUrl: string) => {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    if (host === "openrouter.ai" || host.endsWith(".openrouter.ai")) {
      return { "HTTP-Referer": "https://edgeever.org", "X-Title": "EdgeEver" };
    }
  } catch {
    // Invalid URLs are rejected by the provider factory.
  }
};

export const createClientAiModel = (config: {
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  fetch?: typeof fetch;
}) => {
  switch (config.provider) {
    case "anthropic":
      return createAnthropic({ baseURL: config.baseUrl, apiKey: config.apiKey, fetch: config.fetch })(config.modelId);
    case "google":
      return createGoogle({ baseURL: config.baseUrl, apiKey: config.apiKey, fetch: config.fetch })(config.modelId);
    default:
      return createOpenAICompatible({
        name: "edgeever-openai-compatible",
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
        includeUsage: true,
        headers: openaiCompatibleHeaders(config.baseUrl),
        fetch: config.fetch,
      })(config.modelId);
  }
};
