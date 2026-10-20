import { describe, expect, test } from "bun:test";
import { createEdgeEverClient } from "./index.ts";
import { parsePreparedTagSuggestions, suggestionsFromDirectText } from "./ai-direct-generate.ts";

describe("direct tag suggestions", () => {
  test("prepares on the instance then calls the model provider", async () => {
    const urls = [];
    const client = createEdgeEverClient({
      baseUrl: "https://notes.example",
      token: "user-token",
      directAiGeneration: true,
      fetch: async (url, init) => {
        urls.push({ url: String(url), method: init?.method ?? "GET" });
        if (String(url).endsWith("/tag-suggestions/prepare")) {
          return new Response(JSON.stringify({
            provider: "openai-compatible",
            baseUrl: "https://openrouter.ai/api/v1",
            apiKey: "or-key",
            modelId: "openai/gpt-4o-mini",
            system: "Suggest tags",
            prompt: "Note",
            maxOutputTokens: 300,
            temperature: 0,
            currentTags: ["Current"],
            canonicalTags: { react: "React" },
          }), { headers: { "content-type": "application/json" } });
        }
        throw new Error(`unexpected instance ${url}`);
      },
      providerFetch: async () => new Response(JSON.stringify({
        choices: [{ message: { content: "<edgeever-tags>\nReact\nnew-topic\n</edgeever-tags>" } }],
      }), { headers: { "content-type": "application/json" } }),
    });
    const result = await client.suggestAiTags({ title: "Note", contentMarkdown: "Body", currentTags: ["Current"] });
    expect(urls[0].url).toBe("https://notes.example/api/v1/ai/tag-suggestions/prepare");
    expect(urls.some((call) => call.url.endsWith("/tag-suggestions") && !call.url.endsWith("/prepare"))).toBe(false);
    expect(result.suggestions).toEqual([
      { name: "React", existing: true },
      { name: "new-topic", existing: false },
    ]);
  });

  test("browser tag suggestions report blocked direct access without instance generation", async () => {
 const paths=[];let calls=0;
 const client=createEdgeEverClient({fetch:async url=>{paths.push(String(url));return Response.json({provider:"openai-compatible",baseUrl:"https://model.example/v1",apiKey:"key",modelId:"model",system:"tags",prompt:"Body",maxOutputTokens:32,currentTags:[],canonicalTags:{}});},providerFetch:async()=>{calls++;throw new TypeError("Failed to fetch");}});
 await expect(client.suggestAiTags({title:"Note",contentMarkdown:"Body",currentTags:[]})).rejects.toThrow();
 expect(paths).toEqual(["/api/v1/ai/tag-suggestions/prepare"]);expect(calls).toBe(1);
});

  test("maps prepared tag output onto canonical names", () => {
    const prepared = parsePreparedTagSuggestions({
      provider: "openai-compatible",
      baseUrl: "https://api.example/v1",
      apiKey: "k",
      modelId: "m",
      system: "s",
      prompt: "p",
      maxOutputTokens: 300,
      currentTags: ["Current"],
      canonicalTags: { react: "React" },
    });
    expect(suggestionsFromDirectText("<edgeever-tags>\nreact\nCurrent\nfresh\n</edgeever-tags>", prepared))
      .toEqual([{ name: "React", existing: true }, { name: "fresh", existing: false }]);
  });
});

describe("direct plugin AI", () => {
  test("does not repeat native generation on the instance after a provider network failure", async () => {
    const paths = [];
    let providerRequests = 0;
    const client = createEdgeEverClient({
      baseUrl: "https://notes.example",
      directAiGeneration: true,
      fetch: async url => {
        paths.push(new URL(String(url)).pathname);
        return Response.json({ provider: "openai-compatible", baseUrl: "https://provider.example.com/v1", apiKey: "key", modelId: "model", system: "Translate", prompt: "hello", maxOutputTokens: 100 });
      },
      providerFetch: async () => { providerRequests++; throw new TypeError("NetworkError during provider request"); },
    });
    await expect(client.pluginAi.generate({ prompt: "hello", maxOutputTokens: 100 })).rejects.toThrow(/NetworkError/);
    expect(paths).toEqual(["/api/v1/plugins/ai/generate/prepare"]);
    expect(providerRequests).toBe(1);
  });

  test("prepares then calls the model provider", async () => {
    const urls = [];
    const client = createEdgeEverClient({
      baseUrl: "https://notes.example",
      directAiGeneration: true,
      fetch: async (url) => {
        urls.push(String(url));
        if (String(url).endsWith("/generate/prepare")) {
          return new Response(JSON.stringify({
            provider: "openai-compatible",
            baseUrl: "https://openrouter.ai/api/v1",
            apiKey: "or-key",
            modelId: "openai/gpt-4o-mini",
            system: "Translate",
            prompt: "hello",
            maxOutputTokens: 100,
          }), { headers: { "content-type": "application/json" } });
        }
        throw new Error(`unexpected ${url}`);
      },
      providerFetch: async () => new Response(JSON.stringify({
        choices: [{ message: { content: "bonjour" } }],
      }), { headers: { "content-type": "application/json" } }),
    });
    const result = await client.pluginAi.generate({ system: "Translate", prompt: "hello", maxOutputTokens: 100 });
    expect(urls[0]).toBe("https://notes.example/api/v1/plugins/ai/generate/prepare");
    expect(result.text).toBe("bonjour");
  });
});
