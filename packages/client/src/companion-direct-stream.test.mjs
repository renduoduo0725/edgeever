import { describe, expect, test } from "bun:test";
import { createEdgeEverClient } from "./index.ts";
import { parsePreparedCompanion } from "./companion-direct-stream.ts";

const preparedTurn = {
  turn: {
    id: "11111111-1111-1111-1111-111111111111",
    threadId: "22222222-2222-2222-2222-222222222222",
    message: "hi",
    response: "",
    process: "",
    status: "running",
    sources: [],
    tools: [],
    todos: [],
    questions: [],
    mentions: [],
    model: "direct-model",
    inputTokens: null,
    outputTokens: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  provider: "openai-compatible",
  baseUrl: "https://openrouter.ai/api/v1",
  apiKey: "or-key",
  modelId: "openai/gpt-4o-mini",
  instructions: "You are EdgeEver.",
  messages: [{ role: "user", content: "hi" }],
  tools: [],
  maxSteps: 8,
  maxOutputTokens: 2048,
};

describe("companion prepare payload", () => {
  test("rejects a payload that would send the API key as a target probe", () => {
    expect(parsePreparedCompanion({ ...preparedTurn, apiKey: undefined })).toBeNull();
    expect(parsePreparedCompanion(preparedTurn)?.modelId).toBe("openai/gpt-4o-mini");
  });
});

describe("direct companion client", () => {
  test("prepares on the instance then streams from the model provider", async () => {
    const urls = [];
    const client = createEdgeEverClient({
      baseUrl: "https://notes.example",
      token: "user-token",
      directAiGeneration: true,
      fetch: async (url, init) => {
        urls.push({ url: String(url), method: init?.method ?? "GET" });
        if (String(url).endsWith("/prepare")) {
          return new Response(JSON.stringify(preparedTurn), { headers: { "content-type": "application/json" } });
        }
        if (String(url).endsWith("/checkpoint") || String(url).endsWith("/complete")) {
          return new Response(JSON.stringify({
            ok: true,
            turn: { ...preparedTurn.turn, status: "completed", response: "Hello" },
          }), { headers: { "content-type": "application/json" } });
        }
        throw new Error(`unexpected instance ${url}`);
      },
      providerFetch: async (url) => {
        urls.push({ url: String(url), method: "POST" });
        return new Response([
          `data: {"choices":[{"delta":{"content":"Hello"}}]}`,
          `data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":1}}`,
          "data: [DONE]",
          "",
        ].join("\n\n"), { headers: { "content-type": "text/event-stream" } });
      },
    });
    const events = [];
    await client.streamCompanion(
      { id: preparedTurn.turn.id, threadId: preparedTurn.turn.threadId, message: "hi" },
      { onEvent: (event) => events.push(event) },
    );
    expect(urls[0]).toEqual({ url: "https://notes.example/api/v1/companion/turns/prepare", method: "POST" });
    expect(urls.some((call) => call.url.includes("openrouter.ai"))).toBe(true);
    expect(urls.some((call) => call.url.endsWith("/complete"))).toBe(true);
    expect(urls.some((call) => call.url.endsWith("/api/v1/companion/turns") && call.method === "POST" && !call.url.endsWith("/prepare"))).toBe(false);
    expect(events.some((event) => event.type === "start")).toBe(true);
  });

  test("probes CORS and stays on the instance proxy without downloading the API key", async () => {
    const urls = [];
    const client = createEdgeEverClient({
      baseUrl: "https://notes.example",
      tryDirectAiGeneration: true,
      fetch: async (url, init) => {
        urls.push({ url: String(url), method: init?.method ?? "GET" });
        if (String(url).endsWith("/direct-target")) {
          return new Response(JSON.stringify({
            provider: "openai-compatible",
            baseUrl: "https://integrate.api.nvidia.com/v1",
            modelId: "meta/llama",
          }), { headers: { "content-type": "application/json" } });
        }
        if (String(url).includes("integrate.api.nvidia.com")) {
          expect(init?.method).toBe("POST");
          expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer edgeever-cors-probe");
          throw new TypeError("Failed to fetch");
        }
        return new Response("data: {\"type\":\"text-delta\",\"text\":\"proxied\"}\n\n", {
          headers: { "content-type": "text/event-stream" },
        });
      },
    });
    const events = [];
    await client.streamCompanion(
      { id: preparedTurn.turn.id, threadId: preparedTurn.turn.threadId, message: "hi" },
      { onEvent: (event) => events.push(event) },
    );
    expect(urls.map((call) => call.url)).toEqual([
      "https://notes.example/api/v1/ai/direct-target",
      "https://integrate.api.nvidia.com/v1/chat/completions",
      "https://notes.example/api/v1/companion/turns",
    ]);
    expect(urls.some((call) => call.url.endsWith("/prepare"))).toBe(false);
    expect(events).toEqual([{ type: "text-delta", text: "proxied" }]);
  });
});
