import { expect, test } from "bun:test";
import { createEdgeEverClient } from "./index.ts";

const credential = { provider: "openai-compatible", baseUrl: "http://192.168.1.20:11434/v1", apiKey: "model-key", modelId: "local-model" };

test("model connection tests prepare credentials then call the provider on the client", async () => {
  const paths = []; const requests = [];
  const client = createEdgeEverClient({ baseUrl: "https://notes.example", token: "session-token", fetch: async (url, init) => {
    paths.push(String(url)); expect(new Headers(init.headers).get("Authorization")).toBe("Bearer session-token");
    return Response.json(credential);
  }, providerFetch: async (url, init) => {
    requests.push({ url, auth: new Headers(init.headers).get("Authorization"), body: JSON.parse(init.body) });
    expect(init.redirect).toBe("error"); expect(init.credentials).toBe("omit");
    return Response.json({ choices: [{ message: { content: "OK" }, finish_reason: "stop" }] });
  } });
  expect(await client.testAiProvider("provider-1", { modelId: "local-model" })).toEqual({ ok: true, response: "OK" });
  expect(paths).toEqual(["https://notes.example/api/v1/ai/providers/provider-1/direct-credential"]);
  expect(requests).toHaveLength(1); expect(requests[0].url).toBe(`${credential.baseUrl}/chat/completions`);
  expect(requests[0].auth).toBe("Bearer model-key"); expect(requests[0].body.model).toBe("local-model");
});

test("model discovery issues one authenticated GET from the client", async () => {
  const paths = []; const requests = [];
  const client = createEdgeEverClient({ fetch: async url => { paths.push(String(url)); return Response.json(credential); },
    providerFetch: async (url, init) => { requests.push({ url, init }); return Response.json({ data: [{ id: "model-a", name: "Model A" }] }); },
  });
  expect(await client.discoverAiProviderModels("provider-1")).toEqual({ models: [{ modelId: "model-a", displayName: "Model A" }] });
  expect(paths).toEqual(["/api/v1/ai/providers/provider-1/direct-credential"]);
  expect(requests).toHaveLength(1); expect(requests[0].url).toBe(`${credential.baseUrl}/models`);
  expect(requests[0].init.method).toBe("GET"); expect(requests[0].init.body).toBeUndefined();
  expect(new Headers(requests[0].init.headers).get("Authorization")).toBe("Bearer model-key");
});

for (const operation of ["test", "discovery"]) test(`${operation} network failure never falls back to a server call`, async () => {
  const paths=[];let calls=0;
  const client=createEdgeEverClient({fetch:async url=>{paths.push(String(url));return Response.json(credential);},providerFetch:async()=>{calls++;throw new TypeError("Failed to fetch");}});
  await expect(operation === "test" ? client.testAiProvider("provider-1",{modelId:"model"}) : client.discoverAiProviderModels("provider-1")).rejects.toThrow();
  expect(paths).toEqual(["/api/v1/ai/providers/provider-1/direct-credential"]);expect(calls).toBe(1);
});

test("infographic tools and model loop run on the client after credential preparation", async () => {
  const paths=[];let calls=0;const events=[];
  const proposal={template:"list-grid-simple",data:{title:"Direct",lists:[{label:"One"}]},explanation:"Created"};
  const client=createEdgeEverClient({fetch:async url=>{paths.push(String(url));return Response.json(credential);},providerFetch:async (url,init)=>{
    expect(url).toBe(`${credential.baseUrl}/chat/completions`);expect(new Headers(init.headers).get("Authorization")).toBe("Bearer model-key");
    calls++;
    const chunks=calls===1?[
      {choices:[{delta:{tool_calls:[{index:0,id:"call-1",type:"function",function:{name:"propose_infographic",arguments:JSON.stringify(proposal)}}]},finish_reason:null}]},
      {choices:[{delta:{},finish_reason:"tool_calls"}]},
    ]:[{choices:[{delta:{content:"Created"},finish_reason:null}]},{choices:[{delta:{},finish_reason:"stop"}]}];
    return new Response(chunks.map(x=>`data: ${JSON.stringify(x)}\n\n`).join("")+"data: [DONE]\n\n",{headers:{"content-type":"text/event-stream"}});
  }});
  await client.streamInfographicAgent({prompt:"Make a list",currentContent:"",candidates:["list-grid-simple"],history:[]},{onEvent:e=>events.push(e)});
  expect(paths).toEqual(["/api/v1/ai/infographic-agent/prepare"]);expect(calls).toBe(2);
  expect(events).toContainEqual({type:"proposal",...proposal});expect(events.at(-1)).toEqual({type:"finish"});
});

test("Anthropic client generation and model discovery opt in to browser-direct access", async () => {
  const { buildAiDirectProviderRequest } = await import("@edgeever/shared/ai-generation");
  const prepared = { ...credential, provider: "anthropic", baseUrl: "https://api.anthropic.com/v1", system: "Reply", prompt: "OK", maxOutputTokens: 16 };
  const request = buildAiDirectProviderRequest(prepared);
  expect(request.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  const { createClientAiModel } = await import("./ai-model.ts");
  const { generateText } = await import("ai");
  const paths = [];
  const fetch = async (url, init) => {
    paths.push(String(url));expect(new Headers(init.headers).get("anthropic-dangerous-direct-browser-access")).toBe("true");
    if (String(url).endsWith("/models")) return Response.json({ data: [{ id: "claude-test" }] });
    return Response.json({ id: "msg-1", type: "message", role: "assistant", model: "claude-test", content: [{ type: "text", text: "OK" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } });
  };
  const result = await generateText({ model: createClientAiModel({ ...prepared, fetch }), prompt: "OK", maxRetries: 0 });
  expect(result.text).toBe("OK");
  const { discoverAiModels } = await import("./ai-provider-direct.ts");
  expect(await discoverAiModels(prepared, fetch)).toEqual([{ modelId: "claude-test", displayName: "claude-test" }]);
  expect(paths).toHaveLength(2);
});
