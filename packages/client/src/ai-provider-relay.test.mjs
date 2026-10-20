import { expect, test } from "bun:test";
import { createEdgeEverClient } from "./index.ts";

const target = "https://models.example/v1/chat/completions";
const init = { method: "POST", headers: { authorization: "Bearer model-key", "content-type": "application/json" }, body: JSON.stringify({ model: "test", messages: [] }) };
const response = () => new Response('data: [DONE]\n\n', { headers: { "content-type": "text/event-stream" } });

for (const mode of ["direct", "cors", "http", "cancel", "stream"]) test(`browser AI transport: ${mode}`, async () => {
  const calls = []; let directCalls = 0;
  const abort = new AbortController();
  const client = createEdgeEverClient({
    baseUrl: "https://notes.example", token: "instance-session", allowAiServerFallback: true,
    providerFetch: async (_url, requestInit) => {
      directCalls++;
      expect(requestInit.credentials).toBe("omit");
      expect(requestInit.redirect).toBe("error");
      if (mode === "cancel") { abort.abort(); throw new TypeError("Failed to fetch"); }
      if (mode === "cors") throw new TypeError("Failed to fetch");
      if (mode === "http") return Response.json({ error: "Unauthorized" }, { status: 401 });
      if (mode === "stream") return new Response(new ReadableStream({ start(c) { c.error(new TypeError("stream failed")); } }));
      return response();
    },
    fetch: async (url, requestInit) => {
      calls.push(String(url));
      const headers = new Headers(requestInit.headers);
      expect(headers.get("authorization")).toBe("Bearer instance-session");
      expect(headers.get("x-edgeever-ai-target")).toBe(target);
      expect(headers.get("x-edgeever-ai-method")).toBe("POST");
      expect(JSON.parse(headers.get("x-edgeever-ai-headers")).authorization).toBe("Bearer model-key");
      expect(new TextDecoder().decode(requestInit.body)).toBe(init.body);
      return response();
    },
  });
  const promise = client.fetchAiProvider(target, { ...init, signal: abort.signal });
  if (mode === "cancel") await expect(promise).rejects.toThrow();
  else {
    const result = await promise;
    if (mode === "stream") await expect(result.text()).rejects.toThrow("stream failed");
    else if (mode === "http") expect(result.status).toBe(401);
    else expect(await result.text()).toContain("[DONE]");
  }
  expect(directCalls).toBe(1);
  expect(calls).toEqual(mode === "cors" ? ["https://notes.example/api/v1/ai/provider-relay"] : []);
});

test("native clients never enable the browser fallback by default", async () => {
  const client = createEdgeEverClient({ fetch: async () => { throw new Error("Must not relay"); }, providerFetch: async () => { throw new TypeError("Failed to fetch"); } });
  await expect(client.fetchAiProvider(target, init)).rejects.toThrow("Failed to fetch");
});

test("fallback preserves multipart audio and the browser boundary", async () => {
  const form = new FormData(); form.append("file", new Blob(["audio-test"]), "test.wav"); form.append("model", "whisper-1");
  const client = createEdgeEverClient({ allowAiServerFallback: true, providerFetch: async () => { throw new TypeError("Failed to fetch"); }, fetch: async (_url, requestInit) => {
    const headers = new Headers(requestInit.headers);
    const original = JSON.parse(headers.get("x-edgeever-ai-headers"));
    const parsed = await new Response(requestInit.body, { headers: { "content-type": original["content-type"] } }).formData();
    expect(parsed.get("model")).toBe("whisper-1"); expect(await parsed.get("file").text()).toBe("audio-test");
    return Response.json({ text: "transcribed" });
  } });
  const result = await client.fetchAiProvider("https://models.example/v1/audio/transcriptions", { method: "POST", body: form });
  expect(await result.json()).toEqual({ text: "transcribed" });
});
