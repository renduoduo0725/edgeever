import { afterAll, describe, expect, test } from "bun:test";

let lastRequest = null;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

// Must be installed before importing modules that read `window` at load time.
globalThis.window = {
  location: { hostname: "notes.example.com", origin: "https://notes.example.com" },
  dispatchEvent: () => true,
  edgeeverDesktop: {
    isAvailable: true,
    listStagedResources: async () => [],
    listStagedResourceAliases: async (memoId) => memoId === "memo_alias"
      ? [{ id: "stage_exact", memoId, resourceId: "res_exact" }]
      : [],
    sidecarRequest: async (method, params) => {
      lastRequest = { method, params };
      if (method === "memo.get") {
        const filename = params.memoId === "memo_wechat" ? "微信图片_202609231723_1.jpg" : "screenshot.webp";
        return {
          memo: {
            id: params.memoId,
            contentJson: {
              type: "doc",
              content: [{
                type: "image",
                attrs: { alt: filename, src: "edgeever-staged://stage_dead" },
              }],
            },
            contentMarkdown: `![${filename}](edgeever-staged://stage_dead)\n\n`,
          },
        };
      }
      if (method === "resource.list") {
        return {
          resources: [{
            id: "res_shot",
            memoId: "memo_shot",
            kind: "image",
            filename: "screenshot.webp",
            url: "/api/v1/resources/res_shot/blob",
          }, {
            id: "res_wechat",
            memoId: "memo_wechat",
            kind: "image",
            filename: "微信图片_202609231723_1.webp",
            url: "/api/v1/resources/res_wechat/blob",
          }],
          summary: { totalCount: 2, totalBytes: 2, imageCount: 2, attachmentCount: 0 },
        };
      }
      if (method === "memo.update" || method === "memo.updateGuarded") {
        return { memo: { ...params, id: params.memoId, contentHash: "next-hash" } };
      }
      return { memos: [], totalCount: 0, nextCursor: null };
    },
  },
};

afterAll(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else {
    delete globalThis.window;
  }
});

const { createDesktopRepository } = await import("./desktop-repository.ts");

describe("desktop repository notebook filters", () => {
  test("uses the notebook subtree without also restricting results to the parent", async () => {
    await createDesktopRepository().listMemos({
      notebookId: "parent",
      notebookIds: ["parent", "child"],
    });

    expect(lastRequest).toEqual({
      method: "memo.list",
      params: {
        notebookId: null,
        notebookIds: ["parent", "child"],
      },
    });
  });

  test("forwards the selected tag to the sidecar list query", async () => {
    await createDesktopRepository().listMemos({ tag: "AI-RSS" });

    expect(lastRequest).toEqual({
      method: "memo.list",
      params: {
        notebookId: null,
        tag: "AI-RSS",
      },
    });
  });
});

describe("desktop repository memo saves", () => {
  test("serializes rich content to Markdown before sending it to the sidecar", async () => {
    await createDesktopRepository().updateMemo(
      { id: "memo-1", revision: 2, contentHash: "base-hash" },
      {
        title: "Rich note",
        contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "富文本正文" }] }] },
        tags: [],
      },
    );

    expect(lastRequest.method).toBe("memo.update");
    expect(lastRequest.params.contentMarkdown).toContain("富文本正文");
  });

  test("rewrites a dead staged screenshot URL before saving the memo", async () => {
    await createDesktopRepository().updateMemo(
      { id: "memo_shot", revision: 1, contentHash: "base-hash" },
      {
        title: "截图",
        contentJson: {
          type: "doc",
          content: [{
            type: "image",
            attrs: { alt: "screenshot.webp", src: "edgeever-staged://stage_dead" },
          }],
        },
        contentMarkdown: "![screenshot.webp](edgeever-staged://stage_dead)\n\n",
        tags: [],
      },
    );

    expect(lastRequest.method).toBe("memo.update");
    expect(lastRequest.params.contentMarkdown).toContain("/api/v1/resources/res_shot/blob");
    expect(lastRequest.params.contentMarkdown).not.toContain("edgeever-staged://");
    expect(lastRequest.params.contentJson.content[0].attrs.src).toBe("/api/v1/resources/res_shot/blob");
  });

  test("uses the durable ID mapping when a stale editor saves an image", async () => {
    await createDesktopRepository().updateMemo(
      { id: "memo_alias", revision: 2, contentHash: "base-hash" },
      {
        title: "Image",
        contentJson: { type: "doc", content: [{ type: "image", attrs: {
          alt: "unrelated-original-name.jpg", src: "edgeever-staged://stage_exact",
        } }] },
        contentMarkdown: "![unrelated-original-name.jpg](edgeever-staged://stage_exact)",
        tags: [],
      },
    );
    expect(lastRequest.params.contentJson.content[0].attrs.src).toBe("/api/v1/resources/res_exact/blob");
    expect(lastRequest.params.contentMarkdown).toContain("/api/v1/resources/res_exact/blob");
  });

  test("refuses to save a deleted temporary image with no durable mapping", async () => {
    lastRequest = null;
    await expect(createDesktopRepository().updateMemo(
      { id: "memo_unknown", revision: 2, contentHash: "base-hash" },
      {
        title: "Image",
        contentJson: { type: "doc", content: [{ type: "image", attrs: {
          alt: "missing.jpg", src: "edgeever-staged://stage_missing",
        } }] },
        contentMarkdown: "![missing.jpg](edgeever-staged://stage_missing)",
        tags: [],
      },
    )).rejects.toThrow("missing staged resource");
    expect(lastRequest?.method).not.toBe("memo.update");
  });
});

describe("desktop repository memo reads", () => {
  test("rewrites a dead staged screenshot URL when opening the memo", async () => {
    const result = await createDesktopRepository().getMemo("memo_shot");
    expect(result.memo.contentMarkdown).toContain("edgeever-resource://resource/res_shot");
    expect(result.memo.contentMarkdown).not.toContain("edgeever-staged://");
    expect(result.memo.contentJson.content[0].attrs.src).toBe("edgeever-resource://resource/res_shot");
  });

  test("recovers an imported WeChat image after jpg compression changed its extension", async () => {
    const result = await createDesktopRepository().getMemo("memo_wechat");
    expect(result.memo.contentJson.content[0].attrs.src).toBe("edgeever-resource://resource/res_wechat");
    expect(result.memo.contentMarkdown).toContain("edgeever-resource://resource/res_wechat");
  });
});

describe("guarded desktop plugin saves", () => {
  test("uses a dedicated RPC so older sidecars cannot silently ignore the snapshot guard", async () => {
    const memo = { id: "guarded", revision: 2, contentHash: "base", title: "Title", tags: ["keep"], contentMarkdown: "Original", contentJson: { type: "doc", content: [] } };
    await createDesktopRepository().updateMemo(memo, { title: "Title", contentMarkdown: "Edited", contentJson: memo.contentJson, tags: memo.tags }, { guardLocalSnapshot: true });
    expect(lastRequest.method).toBe("memo.updateGuarded");
    expect(lastRequest.params.expectedLocalSnapshot).toMatchObject({ revision: 2, contentHash: "base", contentMarkdown: "Original", title: "Title", tags: ["keep"] });
  });

  test("reports conflicts and refuses unsupported old hosts without an unguarded fallback", async () => {
    const request = window.edgeeverDesktop.sidecarRequest;
    const memo = { id: "guarded", revision: 2, contentHash: "base", title: "Title", tags: [], contentMarkdown: "Original", contentJson: { type: "doc", content: [] } };
    try {
      for (const [message, code] of [["NOTE_CONFLICT: Changed locally", "NOTE_CONFLICT"], ["Unknown sidecar method: memo.updateGuarded", "HOST_UPGRADE_REQUIRED"]]) {
        const calls = [];
        window.edgeeverDesktop.sidecarRequest = async method => { calls.push(method); throw new Error(message); };
        await expect(createDesktopRepository().updateMemo(memo, { title: "Title", contentJson: memo.contentJson, tags: [] }, { guardLocalSnapshot: true })).rejects.toMatchObject({ code });
        expect(calls).toEqual(["memo.updateGuarded"]);
      }
    } finally { window.edgeeverDesktop.sidecarRequest = request; }
  });
});

describe("desktop note duplication", () => {
  const withDuplicateHarness = async (outboxItems, run) => {
    // Paused, the real synchronization returns at once. Replacing the module
    // instead would leak into other test files run in the same process.
    const { pauseDesktopSyncForImport } = await import("./desktop-sync.ts");
    const resumeSync = await pauseDesktopSyncForImport();
    const { api } = await import("./api.ts");
    const request = window.edgeeverDesktop.sidecarRequest;
    const duplicate = api.duplicateMemo;
    const onLine = Object.getOwnPropertyDescriptor(globalThis.navigator, "onLine");
    Object.defineProperty(globalThis.navigator, "onLine", { configurable: true, value: true });
    const calls = [];
    const apiCalls = [];
    api.duplicateMemo = async (memoId, input) => {
      apiCalls.push({ memoId, input });
      return { memo: { id: "memo_copy", title: input.title, contentMarkdown: "Copy", contentJson: { type: "doc", content: [] } } };
    };
    window.edgeeverDesktop.sidecarRequest = async (method, params) => {
      calls.push({ method, params });
      // Like the sidecar (crates/desktop-sidecar/src/sync.rs): the list holds
      // pending, error and conflict items in queue order, at most 200 of them.
      if (method === "sync.outbox.list") {
        const listed = outboxItems.filter((item) => ["pending", "error", "conflict"].includes(item.status ?? "pending"));
        return { items: listed.slice(0, Math.min(Math.max(params.limit ?? 50, 1), 200)) };
      }
      if (method === "sync.status") {
        const count = (status) => outboxItems.filter((item) => (item.status ?? "pending") === status).length;
        return { pending: count("pending"), syncing: count("syncing"), conflict: count("conflict"), error: count("error"), cursor: 0, syncIdentity: null, lastSyncedAt: null };
      }
      if (method === "memo.get") return { memo: { id: params.memoId, title: "Plan (copy)", contentMarkdown: "Copy", contentJson: { type: "doc", content: [] } } };
      return {};
    };
    try {
      await run({ calls, apiCalls });
    } finally {
      resumeSync();
      window.edgeeverDesktop.sidecarRequest = request;
      api.duplicateMemo = duplicate;
      if (onLine) Object.defineProperty(globalThis.navigator, "onLine", onLine);
      else delete globalThis.navigator.onLine;
    }
  };

  test("checks the outbox, copies on the server and stores the copy in the sidecar", async () => {
    await withDuplicateHarness([], async ({ calls, apiCalls }) => {
      const result = await createDesktopRepository().duplicateMemo("memo_plan", { title: "Plan (copy)" });

      expect(apiCalls).toEqual([{ memoId: "memo_plan", input: { title: "Plan (copy)" } }]);
      expect(calls.map((call) => call.method)).toEqual(["sync.status", "sync.outbox.list", "sync.apply", "memo.get"]);
      expect(calls[2].params.changes[0]).toMatchObject({ entityType: "memo", operation: "upsert", entityId: "memo_copy" });
      expect(result.memo).toMatchObject({ id: "memo_copy", title: "Plan (copy)" });
    });
  });

  const conflicts = (count) => Array.from({ length: count }, (_, index) => ({
    id: index + 1, kind: "memo.update", entityId: `memo_other_${index}`, status: "conflict",
  }));

  test("refuses when the note's conflict lies beyond the 200 items the sidecar lists", async () => {
    const outbox = [...conflicts(200), { id: 201, kind: "memo.update", entityId: "memo_plan", status: "conflict" }];
    await withDuplicateHarness(outbox, async ({ apiCalls }) => {
      await expect(createDesktopRepository().duplicateMemo("memo_plan", { title: "Plan (copy)" }))
        .rejects.toThrow("memo_duplicate_pending_changes");
      expect(apiCalls).toEqual([]);
    });
  });

  test("copies when every outstanding item was listed and none belongs to the note", async () => {
    await withDuplicateHarness(conflicts(150), async ({ apiCalls }) => {
      await createDesktopRepository().duplicateMemo("memo_plan", { title: "Plan (copy)" });
      expect(apiCalls).toHaveLength(1);
    });
  });

  test("refuses while another synchronization is still sending changes", async () => {
    await withDuplicateHarness([{ id: 1, kind: "memo.update", entityId: "memo_other", status: "syncing" }], async ({ apiCalls }) => {
      await expect(createDesktopRepository().duplicateMemo("memo_plan", { title: "Plan (copy)" }))
        .rejects.toThrow("memo_duplicate_pending_changes");
      expect(apiCalls).toEqual([]);
    });
  });

  test("refuses while the note still has unsynchronized changes", async () => {
    await withDuplicateHarness([{ id: 1, kind: "memo.update", entityId: "memo_plan" }], async ({ apiCalls }) => {
      await expect(createDesktopRepository().duplicateMemo("memo_plan", { title: "Plan (copy)" }))
        .rejects.toThrow("memo_duplicate_pending_changes");
      expect(apiCalls).toEqual([]);
    });
  });
});
