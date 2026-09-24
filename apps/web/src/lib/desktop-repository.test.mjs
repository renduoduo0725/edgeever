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
      if (method === "memo.update") {
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
