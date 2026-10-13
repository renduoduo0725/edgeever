import { afterEach, expect, test } from "bun:test";
import { createPicGoUploadQueue, normalizePicGoEndpoint, testPicGoConnection, uploadPicGoImage } from "./picgo.mjs";

const servers = [];
afterEach(() => { for (const server of servers.splice(0)) server.stop(true); });
const serve = (handler) => {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: handler });
  servers.push(server);
  return `http://127.0.0.1:${server.port}/upload`;
};
const image = (endpoint) => ({ endpoint, filename: "截图.png", mimeType: "image/png", bytes: new Uint8Array([137, 80, 78, 71]) });

test("connection check uses heartbeat and never uploads or reads the clipboard", async () => {
  const requests = [];
  const endpoint = serve(async (request) => {
    requests.push([new URL(request.url).pathname, request.method, await request.text()]);
    return Response.json({ success: true, result: "alive" });
  });
  expect(await testPicGoConnection(endpoint)).toBe(true);
  expect(requests).toEqual([["/heartbeat", "POST", ""]]);
});

test("sends captured image bytes using PicGo multipart protocol and preserves returned URL", async () => {
  const endpoint = serve(async (request) => {
    expect(new URL(request.url).pathname).toBe("/upload");
    const form = await request.formData();
    const file = form.get("files");
    expect(file.name).toBe("截图.png");
    expect(file.type).toBe("image/png");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(image("").bytes);
    return Response.json({ success: true, result: ["https://images.example.com/picture.png?q=a%20b"] });
  });
  expect(await uploadPicGoImage(image(endpoint))).toEqual({ url: "https://images.example.com/picture.png?q=a%20b" });
});

test("rejects wrong services, failed uploads and unsafe or ambiguous URLs", async () => {
  const wrong = serve(() => Response.json({ ok: true }));
  await expect(testPicGoConnection(wrong)).rejects.toThrow();
  for (const response of [
    { success: false, result: [] },
    { success: true, result: ["javascript:alert(1)"] },
    { success: true, result: ["https://user:secret@example.com/image.png"] },
    { success: true, result: [null] },
    { success: true, result: ["https://example.com/a", "https://example.com/b"] },
  ]) {
    await expect(uploadPicGoImage(image(serve(() => Response.json(response))))).rejects.toThrow();
  }
});

test("only accepts local upload endpoints and image bytes", async () => {
  for (const endpoint of ["https://example.com/upload", "http://192.168.0.1/upload", "http://127.0.0.1/other", "http://user:pass@localhost/upload", "http://localhost/upload?secret=foo", "http://localhost/upload#foo"]) {
    expect(() => normalizePicGoEndpoint(endpoint)).toThrow();
  }
  expect(normalizePicGoEndpoint("http://[::1]:36677/upload").hostname).toBe("[::1]");
  const endpoint = serve(() => { throw new Error("Should not send non-images"); });
  await expect(uploadPicGoImage({ ...image(endpoint), mimeType: "application/pdf" })).rejects.toThrow();
  await expect(uploadPicGoImage({ ...image(endpoint), bytes: new Uint8Array() })).rejects.toThrow();
});

test("does not follow redirects or wait indefinitely", async () => {
  let reached = false;
  const target = serve(() => { reached = true; return Response.json({ success: true, result: ["https://example.com/a"] }); });
  await expect(uploadPicGoImage(image(serve(() => Response.redirect(target))))).rejects.toThrow();
  expect(reached).toBe(false);
  const slow = serve(async () => { await new Promise((resolve) => setTimeout(resolve, 80)); return Response.json({ success: true, result: "alive" }); });
  await expect(testPicGoConnection(slow, { timeoutMs: 10 })).rejects.toThrow();
});

test("retries only on explicit choice, serializes batches and recovers after cancellation", async () => {
  const calls = [];
  const choices = [0, 1, 2];
  const upload = createPicGoUploadQueue({
    isActive: () => true,
    upload: async (input) => {
      calls.push(input);
      await Promise.resolve();
      if (input !== "success") throw new Error("Unavailable");
      return { url: "https://example.com/image.png" };
    },
    chooseFailure: async () => choices.shift(),
  });
  const first = upload("fallback");
  const second = upload("cancel");
  const third = upload("success");
  expect(await first).toEqual({ fallback: true });
  await expect(second).rejects.toThrow("cancelled");
  expect(await third).toEqual({ url: "https://example.com/image.png" });
  expect(calls).toEqual(["fallback", "fallback", "cancel", "success"]);
});

test("closed editor stops queued work before uploading or prompting", async () => {
  const upload = createPicGoUploadQueue({
    isActive: () => false,
    upload: () => { throw new Error("Must not upload"); },
    chooseFailure: () => { throw new Error("Must not prompt"); },
  });
  await expect(upload(image(""))).rejects.toThrow("editor closed");
});
