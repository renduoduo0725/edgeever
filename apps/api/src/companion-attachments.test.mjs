import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { globSync, readFileSync } from "node:fs";
import { Hono } from "hono";
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream } from "ai";
import { createSelfHostedStorageAdapter } from "./self-hosted-storage-adapter.ts";
import { registerCompanionRoutes } from "./companion-routes.ts";
import { beginCompanionTurn, checkpointCompanionTurn, getCompanionTurn, listCompanionTurns, mapCompanionTurn } from "./companion-service.ts";
import { prepareCompanionTurn } from "./companion-prepare.ts";
import { streamCompanion } from "./companion-runtime.ts";
import { bindCompanionTurnAttachments, loadCompanionAttachmentParts, storeCompanionAttachment } from "./companion-attachments.ts";
import { parsePreparedCompanion } from "../../../packages/client/src/companion-direct-stream.ts";

const databases = [];
afterEach(() => databases.splice(0).forEach((db) => db.close()));
const scope = { workspaceId: "ws_test", ownerId: "owner" };
const credentials = { provider: "anthropic", baseUrl: "https://api.anthropic.com", apiKey: "test", modelId: "claude" };
const finish = { type: "finish", finishReason: { unified: "stop" }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } };

function setup(options = {}) {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  for (const file of globSync("migrations/*.sql").sort()) sqlite.exec(readFileSync(file, "utf8"));
  sqlite.query("INSERT INTO workspaces(id, name) VALUES (?, 'Test')").run(scope.workspaceId);
  const storage = createSelfHostedStorageAdapter(sqlite, "/tmp/edgeever-companion-attachment-test-unused");
  const db = storage.db;
  const auth = { kind: "user", actorType: "user", actorId: scope.ownerId, workspaceId: scope.workspaceId, scopes: [], role: "member" };
  let modelLoads = 0;
  const app = new Hono();
  app.use("*", async (c, next) => { c.set("auth", auth); await next(); });
  registerCompanionRoutes(app, {
    isDemoMode: () => false,
    loadCredentials: async () => options.credentials ?? credentials,
    loadModel: async () => { modelLoads += 1; return { modelId: "mock-model" }; },
    stream: async () => { throw new Error("proxy stream should not run"); },
  });
  const request = (path, body) => app.request(`/api/v1/companion/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }, { storage });
  const turnInput = (message, extra = {}) => ({
    id: crypto.randomUUID(), threadId: crypto.randomUUID(), message, allowNotes: false, useMemory: false, locale: "en-US", ...extra,
  });
  return { sqlite, db, request, modelLoads: () => modelLoads, turnInput };
}

describe("companion attachments", () => {
  test("inlines a text upload into the current user message without storing bytes on the turn", async () => {
    const f = setup();
    const text = "hello notes";
    const base64Data = Buffer.from(text).toString("base64");
    const threadId = crypto.randomUUID();
    const prior = f.turnInput("earlier", { threadId });
    const priorRow = await beginCompanionTurn(f.db, scope, prior, "mock");
    await checkpointCompanionTurn(f.db, scope, priorRow, "done", [], "completed");
    const uploaded = await (await f.request("attachments", { filename: "notes.txt", mediaType: "text/plain", base64Data })).json();
    const payload = f.turnInput("Read the file", { threadId, attachmentIds: [uploaded.attachment.id] });
    const response = await f.request("turns/prepare", payload);
    expect(response.status).toBe(200);
    const prepared = await response.json();
    expect(prepared.messages[0]).toEqual({ role: "user", content: "earlier" });
    expect(prepared.messages[1]).toEqual({ role: "assistant", content: "done" });
    expect(prepared.messages.at(-1)).toEqual({
      role: "user",
      content: [
        { type: "text", text: "Read the file" },
        { type: "text", text: "Attached file notes.txt (text/plain):\nhello notes" },
      ],
    });
    const row = await getCompanionTurn(f.db, scope, payload.id);
    expect(row.attachment_meta_json).not.toContain(base64Data);
    expect(row.attachment_meta_json).not.toContain(text);
    expect(mapCompanionTurn(row).attachments).toEqual([{
      id: uploaded.attachment.id, filename: "notes.txt", mediaType: "text/plain", byteLength: Buffer.byteLength(text),
    }]);
    expect(JSON.stringify(mapCompanionTurn(row))).not.toContain(base64Data);
    const resumed = await prepareCompanionTurn({
      db: f.db, scope, input: payload, row, credentials, resume: { response: "Working" },
    });
    expect(typeof resumed.messages.at(-1).content).toBe("string");
    expect(resumed.messages.at(-3).content).toEqual(prepared.messages.at(-1).content);
    const model = new MockLanguageModelV4({ doStream: async () => ({ stream: simulateReadableStream({ chunks: [
      { type: "text-start", id: "1" }, { type: "text-delta", id: "1", delta: "ok" }, { type: "text-end", id: "1" }, finish,
    ] }) }) });
    const result = await streamCompanion({
      db: f.db, scope, input: payload, model, memories: [], history: await listCompanionTurns(f.db, scope, threadId),
      revision: row.memory_revision, signal: new AbortController().signal, sources: [], assertActive: async () => {},
      provider: "anthropic",
    });
    expect(await result.text).toBe("ok");
    const prompt = model.doStreamCalls[0].prompt;
    expect(prompt.at(-1)).toMatchObject({
      role: "user",
      content: [
        { type: "text", text: "Read the file" },
        { type: "text", text: "Attached file notes.txt (text/plain):\nhello notes" },
      ],
    });
    expect(JSON.stringify(prompt)).not.toContain(base64Data);
  });

  test("round-trips image bytes through base64 chunks", async () => {
    const f = setup();
    const base64Data = "A".repeat(700_004);
    const stored = await storeCompanionAttachment(f.db, scope, { filename: "pic.png", mediaType: "image/png", base64Data });
    expect(f.sqlite.query("SELECT length(data) AS n FROM companion_turn_attachment_parts WHERE attachment_id = ? ORDER BY part_index")
      .all(stored.attachment.id).map((row) => row.n)).toEqual([700_000, 4]);
    const input = f.turnInput("See this");
    const row = await beginCompanionTurn(f.db, scope, input, "mock");
    await bindCompanionTurnAttachments(f.db, scope, row.id, [stored.attachment.id]);
    expect(await loadCompanionAttachmentParts(f.db, scope, row.id, "openai-compatible")).toEqual([
      { type: "image", image: base64Data, mediaType: "image/png" },
    ]);
  });

  test("rejects a PDF for an openai-compatible model before a turn starts", async () => {
    const f = setup({ credentials: { provider: "openai-compatible", baseUrl: "https://example.invalid/v1", apiKey: "k", modelId: "m" } });
    const uploaded = await (await f.request("attachments", {
      filename: "brief.pdf", mediaType: "application/pdf", base64Data: Buffer.from("%PDF-1.4").toString("base64"),
    })).json();
    const response = await f.request("turns", f.turnInput("Read the pdf", { attachmentIds: [uploaded.attachment.id] }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "companion_attachment_unsupported" } });
    expect(f.modelLoads()).toBe(0);
    expect(f.sqlite.query("SELECT COUNT(*) AS n FROM companion_turns WHERE status = 'running'").get().n).toBe(0);
  });

  test("places a PDF on the current user message for anthropic", async () => {
    const f = setup();
    const base64Data = Buffer.from("%PDF-1.4").toString("base64");
    const uploaded = await (await f.request("attachments", { filename: "brief.pdf", mediaType: "application/pdf", base64Data })).json();
    const payload = f.turnInput("Read the pdf", { attachmentIds: [uploaded.attachment.id] });
    const prepared = await (await f.request("turns/prepare", payload)).json();
    expect(prepared.messages.at(-1)).toEqual({
      role: "user",
      content: [
        { type: "text", text: "Read the pdf" },
        { type: "file", data: base64Data, mediaType: "application/pdf", filename: "brief.pdf" },
      ],
    });
  });

  test("rejects an expired or foreign-turn attachment", async () => {
    const f = setup();
    const text = await storeCompanionAttachment(f.db, scope, {
      filename: "notes.txt", mediaType: "text/plain", base64Data: Buffer.from("stale").toString("base64"),
    });
    f.sqlite.query("UPDATE companion_turn_attachments SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(text.attachment.id);
    const expiredTurn = await beginCompanionTurn(f.db, scope, f.turnInput("expired"), "mock");
    await expect(bindCompanionTurnAttachments(f.db, scope, expiredTurn.id, [text.attachment.id]))
      .rejects.toMatchObject({ code: "companion_attachment_expired" });
    await checkpointCompanionTurn(f.db, scope, expiredTurn, "", [], "cancelled");

    const image = await storeCompanionAttachment(f.db, scope, { filename: "pic.png", mediaType: "image/png", base64Data: "AAAA" });
    const first = await beginCompanionTurn(f.db, scope, f.turnInput("first"), "mock");
    await bindCompanionTurnAttachments(f.db, scope, first.id, [image.attachment.id]);
    await checkpointCompanionTurn(f.db, scope, first, "done", [], "completed");
    const second = await beginCompanionTurn(f.db, scope, f.turnInput("second"), "mock");
    await expect(bindCompanionTurnAttachments(f.db, scope, second.id, [image.attachment.id]))
      .rejects.toMatchObject({ code: "companion_attachment_unavailable" });
    await expect(bindCompanionTurnAttachments(f.db, scope, second.id, [image.attachment.id, image.attachment.id]))
      .rejects.toMatchObject({ code: "companion_attachment_unavailable" });
    await checkpointCompanionTurn(f.db, scope, second, "", [], "cancelled");

    const stale = await storeCompanionAttachment(f.db, scope, {
      filename: "again.txt", mediaType: "text/plain", base64Data: Buffer.from("later").toString("base64"),
    });
    f.sqlite.query("UPDATE companion_turn_attachments SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(stale.attachment.id);
    const routed = await f.request("turns", f.turnInput("again", { attachmentIds: [stale.attachment.id] }));
    expect(routed.status).toBe(409);
    expect(await routed.json()).toMatchObject({ error: { code: "companion_attachment_expired" } });
    expect(f.sqlite.query("SELECT status FROM companion_turns WHERE message = 'again'").get().status).toBe("cancelled");
  });

  test("direct parser keeps a user content array and still accepts string messages", () => {
    const base = {
      turn: { id: "11111111-1111-4111-8111-111111111111" },
      provider: "anthropic", baseUrl: "https://api.anthropic.com", apiKey: "k", modelId: "claude",
      instructions: "Be brief.", maxSteps: 8, maxOutputTokens: 2048, tools: [],
    };
    expect(parsePreparedCompanion({ ...base, messages: [{ role: "user", content: "hi" }] })?.messages)
      .toEqual([{ role: "user", content: "hi" }]);
    const parts = [
      { type: "text", text: "hi" },
      { type: "image", image: "aaaa", mediaType: "image/png" },
      { type: "file", data: "bbbb", mediaType: "application/pdf", filename: "a.pdf" },
    ];
    expect(parsePreparedCompanion({
      ...base,
      messages: [{ role: "user", content: parts }, { role: "assistant", content: "ok" }],
    })?.messages).toEqual([{ role: "user", content: parts }, { role: "assistant", content: "ok" }]);
    expect(parsePreparedCompanion({
      ...base,
      messages: [{ role: "user", content: "hi" }, { role: "assistant", content: [{ type: "text", text: "no" }] }],
    })).toBeNull();
  });
});
