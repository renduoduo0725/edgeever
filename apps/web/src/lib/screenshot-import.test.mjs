import { describe, expect, test } from "bun:test";
import {
  createScreenshotImportGate,
  createScreenshotMemo,
  normalizeScreenshotBytes,
  screenshotFileFromImportPayload,
  screenshotImportDedupeKey,
  screenshotNoteContent,
} from "./screenshot-import.ts";

describe("screenshot import bytes", () => {
  test("does not treat Electron Buffer JSON as an empty typed array", () => {
    const encoded = { type: "Buffer", data: [137, 80, 78, 71] };
    expect(new Uint8Array(encoded).byteLength).toBe(0);
    expect(Array.from(normalizeScreenshotBytes(encoded))).toEqual([137, 80, 78, 71]);
  });

  test("copies Uint8Array payloads so later IPC buffer reuse cannot empty the file", () => {
    const source = new Uint8Array([1, 2, 3]);
    const copy = normalizeScreenshotBytes(source);
    source[0] = 9;
    expect(Array.from(copy)).toEqual([1, 2, 3]);
  });

  test("skips creating a screenshot file when the payload has no image bytes", () => {
    const file = screenshotFileFromImportPayload({
      name: "screenshot.png",
      type: "image/png",
      bytes: { type: "Buffer" },
    });
    expect(file.size).toBe(0);
  });

  test("creates a file with the restored screenshot bytes", async () => {
    const file = screenshotFileFromImportPayload({
      name: "screenshot.png",
      type: "image/png",
      bytes: { type: "Buffer", data: [137, 80, 78, 71] },
    });
    expect(file.size).toBe(4);
    expect(Array.from(new Uint8Array(await file.arrayBuffer()))).toEqual([137, 80, 78, 71]);
  });
});

describe("screenshot note content", () => {
  test("stores the image in the note body with room to type underneath", () => {
    const content = screenshotNoteContent("screenshot.png", "/api/v1/resources/res_shot/blob");
    expect(content.contentJson.content?.some((node) => node.type === "image")).toBe(true);
    expect(content.contentJson.content?.at(-1)?.type).toBe("paragraph");
    expect(content.contentMarkdown).toContain("/api/v1/resources/res_shot/blob");
    expect(content.contentMarkdown).toContain("screenshot.png");
  });

  test("creates the memo only after the screenshot is attached", async () => {
    const created = {
      id: "memo_local",
      revision: 0,
      contentHash: "empty",
      title: "截图 2026-09-15 09:28",
      tags: [],
      contentMarkdown: "",
    };
    const saved = {
      ...created,
      revision: 1,
      contentHash: "shot",
      contentMarkdown: "![screenshot.png](/api/v1/resources/res_shot/blob)",
    };
    const file = screenshotFileFromImportPayload({
      name: "screenshot.png",
      type: "image/png",
      bytes: { type: "Buffer", data: [137, 80, 78, 71] },
    });
    const memo = await createScreenshotMemo({
      notebookId: "nb_inbox",
      title: created.title,
      file,
      createMemo: async () => ({ memo: created }),
      uploadResource: async (memoId, uploaded) => {
        expect(memoId).toBe(created.id);
        expect(uploaded.size).toBe(4);
        return { url: "/api/v1/resources/res_shot/blob", filename: uploaded.name };
      },
      updateMemo: async (memoToUpdate, content) => {
        expect(memoToUpdate.id).toBe(created.id);
        expect(content.contentMarkdown).toContain("/api/v1/resources/res_shot/blob");
        return { memo: { ...saved, contentMarkdown: content.contentMarkdown } };
      },
    });
    expect(memo.contentMarkdown).toContain("/api/v1/resources/res_shot/blob");
  });

  test("deletes the empty memo if the screenshot cannot be attached", async () => {
    const deleted = [];
    const file = screenshotFileFromImportPayload({
      name: "screenshot.png",
      type: "image/png",
      bytes: { type: "Buffer", data: [137, 80, 78, 71] },
    });
    await expect(createScreenshotMemo({
      notebookId: "nb_inbox",
      title: "截图",
      file,
      createMemo: async () => ({
        memo: {
          id: "memo_failed",
          revision: 0,
          contentHash: "empty",
          title: "截图",
          tags: [],
          contentMarkdown: "",
        },
      }),
      uploadResource: async () => {
        throw new Error("offline");
      },
      updateMemo: async (memo) => ({ memo }),
      deleteMemo: async (memoId) => {
        deleted.push(memoId);
      },
    })).rejects.toThrow("offline");
    expect(deleted).toEqual(["memo_failed"]);
  });
});

describe("screenshot import gate", () => {
  test("builds a stable key from the title, filename, and byte length", () => {
    expect(screenshotImportDedupeKey({
      name: "screenshot-20260915-222604.png",
      title: "截图 2026-09-15 22:26",
      bytes: new Uint8Array(4),
    })).toBe(["截图 2026-09-15 22:26", "screenshot-20260915-222604.png", "4"].join("\u0000"));
  });

  test("drops a second import while the first screenshot is still being saved", () => {
    const gate = createScreenshotImportGate(1000);
    expect(gate.tryBegin("a")).toBe(true);
    expect(gate.tryBegin("a")).toBe(false);
    expect(gate.tryBegin("b")).toBe(false);
  });

  test("ignores the same screenshot payload during the cooldown after a successful import", () => {
    const gate = createScreenshotImportGate(1000);
    expect(gate.tryBegin("a")).toBe(true);
    gate.finish("a", 0);
    expect(gate.tryBegin("a", 500)).toBe(false);
    expect(gate.tryBegin("b", 500)).toBe(true);
    gate.fail("b");
    expect(gate.tryBegin("a", 1500)).toBe(true);
  });

  test("allows a retry after a failed import", () => {
    const gate = createScreenshotImportGate(1000);
    expect(gate.tryBegin("a")).toBe(true);
    gate.fail("a");
    expect(gate.tryBegin("a")).toBe(true);
  });
});
