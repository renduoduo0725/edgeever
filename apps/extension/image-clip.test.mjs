import { describe, expect, test } from "bun:test";
import {
  filenameForImage,
  imageAltText,
  imageFromBytes,
  imageFromDataUrl,
  imageHostName,
  imageMemoMarkdown,
  imageOriginPattern,
  MAX_IMAGE_BYTES,
  noteTitleForImage,
  preferredImageUrls,
  googleSearchKeyword,
  saveCapturedImageNote,
  sniffImageMimeType,
} from "./src/image-clip.ts";

const source = {
  pageUrl: "https://x.com/huoshan007/status/1",
  capturedAt: "2026-09-26T00:00:00.000Z",
  sourceLabel: "来源",
  capturedAtLabel: "抓取时间",
  googleSearchLabel: "Google 搜索",
  keywordLabel: "关键词",
};

describe("preferred image URLs", () => {
  test("asks Twitter for the original asset before the clicked preview", () => {
    const urls = preferredImageUrls("https://pbs.twimg.com/media/Abc123?format=jpg&name=small");
    expect(urls).toHaveLength(3);
    expect(new URL(urls[0]).searchParams.get("name")).toBe("orig");
    expect(new URL(urls[1]).searchParams.get("name")).toBe("large");
    expect(urls[2]).toBe("https://pbs.twimg.com/media/Abc123?format=jpg&name=small");
  });

  test("keeps an original Twitter URL as a single candidate", () => {
    const src = "https://pbs.twimg.com/media/Abc123?format=png&name=orig";
    expect(preferredImageUrls(src)).toEqual([src]);
  });

  test("upgrades the legacy Twitter size suffix and leaves other sites unchanged", () => {
    const legacy = preferredImageUrls("https://pbs.twimg.com/media/Abc.jpg:small");
    expect(new URL(legacy[0]).pathname.endsWith(":orig")).toBe(true);
    expect(legacy[1]).toBe("https://pbs.twimg.com/media/Abc.jpg:small");
    expect(preferredImageUrls("https://images.example.com/photo.png?name=small")).toEqual([
      "https://images.example.com/photo.png?name=small",
    ]);
  });
});

describe("image note content", () => {
  test("embeds the uploaded resource and the source page", () => {
    const markdown = imageMemoMarkdown({
      ...source,
      resourceId: "res_1",
      alt: "Jianying ] Headless",
      altFallback: "图片",
    });
    expect(markdown.startsWith("![Jianying Headless](/api/v1/resources/res_1/blob)")).toBe(true);
    expect(markdown).toContain("[https://x.com/huoshan007/status/1](https://x.com/huoshan007/status/1)");
    expect(markdown).not.toContain("pbs.twimg.com");
  });

  test("encodes parentheses in the source link and falls back when alt is empty", () => {
    const markdown = imageMemoMarkdown({
      ...source,
      pageUrl: "https://example.com/a(b)",
      resourceId: "res_2",
      alt: "  ",
      altFallback: "图片",
    });
    expect(markdown).toContain("![图片](/api/v1/resources/res_2/blob)");
    expect(markdown).toContain("(https://example.com/a%28b%29)");
    expect(imageAltText("]", "图片")).toBe("图片");
  });

  test("names the file from the media id and clips the note title", () => {
    expect(filenameForImage("https://pbs.twimg.com/media/Abc123?format=jpg&name=small", "image/jpeg")).toBe("Abc123.jpg");
    expect(filenameForImage("https://pbs.twimg.com/media/Abc.jpg:large", "image/png")).toBe("Abc.png");
    expect(noteTitleForImage(` ${"标".repeat(180)} `, "", "图片")).toHaveLength(160);
    expect(noteTitleForImage("  ", "卡片", "图片")).toBe("卡片");
    expect(noteTitleForImage(" ", " ", "图片")).toBe("图片");
  });

  test("reads an http image origin and ignores blob URLs", () => {
    expect(imageOriginPattern("https://pbs.twimg.com/media/Abc")).toBe("https://pbs.twimg.com/*");
    expect(imageHostName("https://pbs.twimg.com/media/Abc")).toBe("pbs.twimg.com");
    expect(imageOriginPattern("blob:https://x.com/8fb53d6f")).toBeNull();
    expect(imageHostName("data:image/png;base64,aaaa")).toBe("");
  });
});

describe("image bytes", () => {
  test("recognizes common image signatures and rejects other payloads", () => {
    expect(sniffImageMimeType(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d))).toBe("image/png");
    expect(sniffImageMimeType(Uint8Array.of(0xff, 0xd8, 0xff, 0x00))).toBe("image/jpeg");
    expect(sniffImageMimeType(Uint8Array.of(0x47, 0x49, 0x46, 0x38))).toBe("image/gif");
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(sniffImageMimeType(webp)).toBe("image/webp");
    const avif = new Uint8Array(12);
    avif.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
    expect(sniffImageMimeType(avif)).toBe("image/avif");
    expect(imageFromBytes(Uint8Array.of(0x89, 0x50, 0x4e, 0x47), "").mimeType).toBe("image/png");
    expect(imageFromBytes(Uint8Array.of(0x3c, 0x68, 0x74, 0x6d, 0x6c), "text/html")).toEqual({ error: "unsupported" });
    expect(imageFromBytes(new Uint8Array(), "image/png")).toEqual({ error: "empty" });
    expect(imageFromBytes(new Uint8Array(MAX_IMAGE_BYTES + 1), "image/png")).toEqual({ error: "too-large" });
    expect(imageFromBytes(Uint8Array.of(1, 2, 3), "image/jpg").mimeType).toBe("image/jpeg");
  });
});

describe("image clip sources", () => {
  test("records a Google image search as the search and its keyword", () => {
    const pageUrl = "https://www.google.com/search?newwindow=1&sca_esv=080dae4805299e94&sxsrf=APpeTracking&udm=2&fbs=ABfTracking&q=cat&sa=X&ved=2ahUK&biw=1920&bih=836&dpr=2";
    expect(googleSearchKeyword(pageUrl)).toBe("cat");
    const markdown = imageMemoMarkdown({
      ...source,
      pageUrl,
      resourceId: "res_google",
      alt: "cat",
      altFallback: "图片",
    });
    expect(markdown).toContain("来源: Google 搜索\n关键词: cat");
    expect(markdown).not.toContain("google.com");
    expect(markdown).not.toContain("fbs=");
    expect(markdown).not.toContain("sxsrf=");
  });

  test("decodes the keyword and keeps an image-viewer query without the tracking URL", () => {
    expect(googleSearchKeyword(
      "https://www.google.com/search?newwindow=1&q=%E7%8C%AB&udm=2&fbs=ABfTracking&biw=1920#sv=viewer",
    )).toBe("猫");
    expect(googleSearchKeyword(
      "https://www.google.com/imgres?imgurl=https%3A%2F%2Fexample.com%2Fcat.jpg&q=white+kitten&tbnid=abc",
    )).toBe("white kitten");
    const markdown = imageMemoMarkdown({
      ...source,
      pageUrl: "https://www.google.com/search?udm=2",
      resourceId: "res_google",
      alt: "",
      altFallback: "图片",
    });
    expect(markdown).toContain("来源: Google 搜索");
    expect(markdown).not.toContain("关键词");
    expect(markdown).not.toContain("http");
    expect(googleSearchKeyword("https://example.com/cats#photo")).toBeNull();
  });

  test("escapes markdown characters in the keyword", () => {
    const markdown = imageMemoMarkdown({
      ...source,
      pageUrl: "https://www.google.com.hk/search?q=cat%5B1%5D*%60",
      resourceId: "res_google",
      alt: "",
      altFallback: "图片",
    });
    expect(markdown).toContain("关键词: cat\\[1\\]\\*\\`");
  });

  test("reads a right-clicked data URL image", () => {
    const image = imageFromDataUrl("data:image/png;base64,iVBORw0KGgo=");
    expect(image?.mimeType).toBe("image/png");
    expect(imageFromDataUrl("https://example.com/cat.jpg")).toBeNull();
  });
});

describe("saveCapturedImageNote", () => {
  const image = {
    notebookId: "nb_inbox",
    title: "火山哥 on X",
    alt: "卡片",
    filename: "Abc123.jpg",
    mimeType: "image/jpeg",
    bytes: Uint8Array.of(0xff, 0xd8, 0xff),
    ...source,
    altFallback: "图片",
  };

  const client = (overrides = {}) => {
    const order = [];
    const calls = { deleted: [], saved: null, created: null };
    return {
      order,
      calls,
      api: {
        listNotebooks: async () => {
          order.push("list");
          return { notebooks: [{ id: "nb_first" }] };
        },
        createMemo: async (body) => {
          order.push("create");
          calls.created = body;
          return { memo: { id: "memo_1" } };
        },
        uploadImage: async () => {
          order.push("upload");
          return { id: "res_1" };
        },
        createEditSession: async () => {
          order.push("session");
          return { editSession: { id: "edit_1", baseRevision: 0, baseContentHash: "a".repeat(64) } };
        },
        saveMemo: async (_memoId, body) => {
          order.push("save");
          calls.saved = body;
        },
        deleteMemo: async (memoId) => {
          order.push("delete");
          calls.deleted.push(memoId);
        },
        createWithImage: async (body) => {
          order.push("create-with-image");
          calls.created = body;
          return { memoId: "memo_1", resourceId: "res_1" };
        },
        ...overrides,
      },
    };
  };

  test("creates the note with the image already in the first version", async () => {
    const fixture = client();
    const saved = await saveCapturedImageNote(fixture.api, image);
    expect(saved).toEqual({ memoId: "memo_1", resourceId: "res_1" });
    expect(fixture.order).toEqual(["create-with-image"]);
    expect(fixture.calls.created.notebookId).toBe("nb_inbox");
    expect(fixture.calls.created.tags).toEqual(["web-clip"]);
    expect(fixture.calls.created.contentMarkdown).toContain("](/api/v1/resources/EDGEVERRESOURCEID/blob)");
    expect(fixture.calls.created.bytes).toEqual(image.bytes);
    expect(fixture.calls.deleted).toEqual([]);
  });

  test("uses the first notebook when none is selected", async () => {
    const fixture = client();
    await saveCapturedImageNote(fixture.api, { ...image, notebookId: "" });
    expect(fixture.order[0]).toBe("list");
    expect(fixture.calls.created.notebookId).toBe("nb_first");
  });

  test("does not leave a source-only note when storing the image fails", async () => {
    const fixture = client({
      createWithImage: async () => {
        throw new Error("Missing required scope: write:resources");
      },
    });
    await expect(saveCapturedImageNote(fixture.api, image)).rejects.toThrow("write:resources");
    expect(fixture.calls.deleted).toEqual([]);
  });

  test("does not delete anything when no notebook exists", async () => {
    const fixture = client({
      listNotebooks: async () => ({ notebooks: [] }),
    });
    await expect(saveCapturedImageNote(fixture.api, { ...image, notebookId: "" })).rejects.toThrow("no-notebook");
    expect(fixture.calls.deleted).toEqual([]);
  });
});
