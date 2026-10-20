import { expect, test } from "bun:test";
import { createAiDirectRuntime, validateAiProviderUrl } from "./ai-direct.mjs";
import { createServer } from "node:http";
import { once } from "node:events";

test("desktop AI permits user-configured private hosts, HTTP, IPv6 and custom ports", () => {
  for (const value of [
    "http://192.168.1.20:11434/v1", "http://localhost:11434/v1",
    "https://127.0.0.1/v1", "http://[::1]:11434/v1",
    "https://model.lan/v1", "https://model.example.com:8443/v1",
    "https://model.intranet.example.com/v1", "https://api.openai.com/v1",
  ]) expect(validateAiProviderUrl(value).href).toBe(value);
  for (const value of [
    "file:///etc/passwd", "ftp://model.lan/v1", "data:text/plain,hello",
    "https://user:secret@model.lan/v1", "http://model.lan/v1#fragment", "invalid",
  ]) expect(() => validateAiProviderUrl(value)).toThrow();
});

test("desktop AI streams from a real local HTTP model without following redirects", async () => {
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push({ path: request.url, method: request.method, auth: request.headers.authorization, body });
    if (request.url === "/redirect") {
      response.writeHead(307, { location: "/should-not-be-called" });
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write('data: {"text":"local reply"}\n\n');
    response.end("data: [DONE]\n\n");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const runtime = createAiDirectRuntime();
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const chunks = [];
    await new Promise((resolve, reject) => {
      runtime.open("local-model-1", {
        url: `${baseUrl}/v1/chat/completions`, method: "POST",
        headers: { authorization: "Bearer local-key" }, body: '{"stream":true}',
      }, { onData: bytes => chunks.push(new TextDecoder().decode(bytes)), onEnd: resolve, onError: reject }).catch(reject);
    });
    expect(chunks.join("")).toContain("local reply");
    expect(requests).toEqual([{ path: "/v1/chat/completions", method: "POST", auth: "Bearer local-key", body: '{"stream":true}' }]);
    await expect(runtime.open("local-redirect", {
      url: `${baseUrl}/redirect`, body: "{}",
    }, { onData() {}, onEnd() {}, onError() {} })).rejects.toThrow();
    expect(requests.map(request => request.path)).toEqual(["/v1/chat/completions", "/redirect"]);
    expect(runtime.activeCount).toBe(0);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test("desktop AI provider transport streams POST bodies to public HTTPS hosts", async () => {
  let received;
  const runtime = createAiDirectRuntime({
    fetchImpl: async (url, init) => {
      received = { url, method: init.method, body: init.body };
      return new Response("data: {\"choices\":[{\"delta\":{\"content\":\"ok\"}}]}\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  const chunks = [];
  const opened = await new Promise((resolve, reject) => {
    runtime.open("req-12345", {
      url: "https://integrate.api.nvidia.com/v1/chat/completions",
      method: "POST",
      headers: { authorization: "Bearer test" },
      body: "{\"stream\":true}",
    }, {
      onData: (bytes) => chunks.push(new TextDecoder().decode(bytes)),
      onEnd: () => resolve(true),
      onError: reject,
    }).then((headers) => {
      expect(headers.status).toBe(200);
    });
  });
  expect(opened).toBe(true);
  expect(received.url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
  expect(received.method).toBe("POST");
  expect(chunks.join("")).toContain("ok");
  expect(runtime.activeCount).toBe(0);
});

test("desktop AI provider transport rejects GET", async () => {
  const runtime = createAiDirectRuntime({ fetchImpl: async () => new Response("no") });
  await expect(runtime.open("req-12345", {
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    method: "GET",
    body: "{}",
  }, { onData() {}, onEnd() {}, onError() {} })).rejects.toThrow(/POST/);
});

test("desktop AI transport sends multipart audio bytes directly to the speech provider", async () => {
  let received;
  const runtime = createAiDirectRuntime({
    fetchImpl: async (url, init) => {
      received = { url, body: init.body, headers: init.headers };
      return Response.json({ text: "recognized" });
    },
  });
  const form = new FormData();
  form.set("model", "whisper-1");
  form.set("file", new File(["audio bytes"], "clip.mp3", { type: "audio/mpeg" }));
  const request = new Request("https://api.openai.com/v1/audio/transcriptions", { method: "POST", body: form });
  const headers = Object.fromEntries(request.headers);
  const bodyBytes = new Uint8Array(await request.arrayBuffer());
  const result = await new Promise((resolve, reject) => {
    let text = "";
    runtime.open("speech-12345", {
      url: request.url,
      method: "POST",
      headers,
      body: "",
      bodyBytes,
    }, {
      onData: (bytes) => { text += new TextDecoder().decode(bytes); },
      onEnd: () => resolve(text),
      onError: reject,
    }).catch(reject);
  });
  expect(received.url).toBe("https://api.openai.com/v1/audio/transcriptions");
  expect(received.body).toBeInstanceOf(Uint8Array);
  expect(received.headers["content-type"]).toMatch(/^multipart\/form-data; boundary=/);
  expect(JSON.parse(result).text).toBe("recognized");
  await expect(runtime.open("speech-invalid", {
    url: "https://api.openai.com/v1/chat/completions",
    method: "POST",
    headers,
    body: "",
    bodyBytes: new Uint8Array([1]),
  }, { onData() {}, onEnd() {}, onError() {} })).rejects.toThrow(/multipart speech/);
});

test("desktop preload and main process expose the AI provider stream pair", async () => {
  const [main, preload] = await Promise.all([
    Bun.file(new URL("./index.mjs", import.meta.url)).text(),
    Bun.file(new URL("../preload/index.cjs", import.meta.url)).text(),
  ]);
  expect(main).toContain('ipcMain.handle("desktop:ai-direct-open"');
  expect(main).toContain('ipcMain.on("desktop:ai-direct-cancel"');
  expect(preload).toContain('openAiProviderStream: (requestId, input) => ipcRenderer.invoke("desktop:ai-direct-open"');
  expect(preload).toContain('ipcRenderer.send("desktop:ai-direct-cancel"');
});
