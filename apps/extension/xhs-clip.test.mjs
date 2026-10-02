import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import {
  canonicalNoteUrl,
  cleanXhsText,
  imageUrlsFromXhsImages,
  noteIdFromPageUrl,
  readXhsStateInPage,
  resolveXhsNote,
  saveCapturedXhsNote,
  splitXhsDateText,
  xhsBodyText,
  xhsNoteMarkdown,
  xhsNoteTitle,
  xhsTimeIso,
} from "./src/xhs-clip.ts";

const noteId = "64b8f2e1000000001a01ebee";
const pageUrl = `https://www.xiaohongshu.com/explore/${noteId}?xsec_token=CBjuq-token&xsec_source=app_share&foo=1`;

const labels = {
  capturedAt: "2026-09-26T00:00:00.000Z",
  sourceLabel: "来源",
  capturedAtLabel: "抓取时间",
  timeLabel: "时间",
  locationLabel: "地点",
  altFallback: "图片",
};

const read = {
  ok: true,
  noteId,
  title: "世赛现场，会贴瓷砖的女生帅爆了",
  desc: "谁说贴瓷砖是男生的主场\n#世界技能大赛",
  nickname: "王小猫",
  timeMs: Date.parse("2026-09-20T08:00:00.000Z"),
  timeText: "",
  location: "上海",
  tags: ["世界技能大赛", "瓷砖铺贴"],
  images: [{
    url: "",
    urlDefault: "http://sns-webpic-qc.xhscdn.com/note/cover!nd_dft_wlteh_webp_3",
    urlPre: "http://sns-webpic-qc.xhscdn.com/note/cover!nd_prv_wlteh_webp_3",
    infoList: [
      { imageScene: "WB_PRV", url: "http://sns-webpic-qc.xhscdn.com/note/cover!nd_prv_wlteh_webp_3" },
      { imageScene: "WB_DFT", url: "https://sns-webpic-qc.xhscdn.com/note/cover!nd_dft_wlteh_webp_3" },
    ],
  }],
};

describe("xiaohongshu addresses", () => {
  test("reads a note id from a detail page and ignores the feed", () => {
    expect(noteIdFromPageUrl(pageUrl)).toBe(noteId);
    expect(noteIdFromPageUrl(`https://www.xiaohongshu.com/discovery/item/${noteId}`)).toBe(noteId);
    expect(noteIdFromPageUrl(`https://www.xiaohongshu.com/user/profile/abc123/${noteId}?xsec_token=1`)).toBe(noteId);
    expect(noteIdFromPageUrl("https://www.xiaohongshu.com/explore")).toBe("");
    expect(noteIdFromPageUrl("https://x.com/home")).toBe("");
    expect(canonicalNoteUrl(pageUrl, noteId)).toBe(
      `https://www.xiaohongshu.com/explore/${noteId}?xsec_token=CBjuq-token&xsec_source=app_share`,
    );
  });
});

describe("xiaohongshu note content", () => {
  test("keeps the note text, missing tags, display photo, and source link", () => {
    expect(cleanXhsText("谁说贴瓷砖是男生的主场\n展开")).toBe("谁说贴瓷砖是男生的主场");
    expect(xhsBodyText(read.desc, read.tags)).toBe("谁说贴瓷砖是男生的主场\n#世界技能大赛\n#瓷砖铺贴");
    expect(splitXhsDateText("6天前 上海")).toEqual({ timeText: "6天前", location: "上海" });
    expect(splitXhsDateText("昨天 12:30 上海")).toEqual({ timeText: "昨天 12:30", location: "上海" });
    expect(xhsTimeIso(read.timeMs)).toBe("2026-09-20T08:00:00.000Z");
    const resolved = resolveXhsNote(read, pageUrl);
    expect(resolved?.imageUrls).toEqual(["https://sns-webpic-qc.xhscdn.com/note/cover!nd_dft_wlteh_webp_3"]);
    expect(xhsNoteTitle({ title: resolved.title, nickname: resolved.nickname, body: resolved.body, fallback: "一篇小红书笔记" }))
      .toBe("世赛现场，会贴瓷砖的女生帅爆了");
    const markdown = xhsNoteMarkdown({
      ...labels,
      nickname: resolved.nickname,
      title: resolved.title,
      body: resolved.body,
      datetime: resolved.datetime,
      location: resolved.location,
      noteUrl: resolved.noteUrl,
      images: [{ resourceId: "res_1", alt: "封面]图" }],
    });
    expect(markdown.startsWith("王小猫")).toBe(true);
    expect(markdown).toContain("世赛现场，会贴瓷砖的女生帅爆了");
    expect(markdown).toContain("#瓷砖铺贴");
    expect(markdown).toContain("![封面 图](/api/v1/resources/res_1/blob)");
    expect(markdown).toContain(`(https://www.xiaohongshu.com/explore/${noteId}?xsec_token=CBjuq-token&xsec_source=app_share)`);
    expect(markdown).toContain("地点: 上海");
    expect(markdown).not.toContain("xhscdn.com");
    expect(markdown).not.toContain("foo=1");
  });

  test("uses the visible date when the page has no timestamp, and skips avatars", () => {
    const resolved = resolveXhsNote({
      ...read,
      title: "",
      timeMs: 0,
      timeText: "编辑于 6天前 上海",
      location: "",
      images: [{
        url: "https://sns-avatar-qc.xhscdn.com/avatar/cat.jpg",
        urlDefault: "",
        urlPre: "",
        infoList: [],
      }, {
        url: "https://example.com/not-a-note.jpg",
        urlDefault: "https://ci.xiaohongshu.com/note/second.jpg",
        urlPre: "",
        infoList: [],
      }],
    }, pageUrl);
    expect(resolved?.datetime).toBe("编辑于 6天前");
    expect(resolved?.location).toBe("上海");
    expect(resolved?.imageUrls).toEqual(["https://ci.xiaohongshu.com/note/second.jpg"]);
    expect(xhsNoteTitle({ title: "", nickname: "王小猫", body: resolved.body, fallback: "一篇小红书笔记" }))
      .toBe("王小猫: 谁说贴瓷砖是男生的主场");
    expect(imageUrlsFromXhsImages([{
      url: "https://sns-webpic-qc.xhscdn.com/note/clip.mp4",
      urlDefault: "",
      urlPre: "",
      infoList: [],
    }])).toEqual([]);
  });

  test("reads note state in the page world without calling extension helpers", () => {
    const source = readXhsStateInPage.toString();
    expect(source).toContain("__INITIAL_STATE__");
    expect(source).toContain("noteDetailMap");
    expect(source).not.toContain("noteIdFromPageUrl");
    expect(source).not.toContain("resolveXhsNote");
  });

  test("keeps the note id parser identical in the page scripts", () => {
    const library = readFileSync(new URL("./src/xhs-clip.ts", import.meta.url), "utf8");
    const parser = library.match(/const noteIdFromPath = \(pathname: string\) => \{[\s\S]*?\n\};/);
    const compact = (source) => source.replace(/^[ \t]+/gm, "");
    expect(parser?.[0]).toBeTruthy();
    for (const file of ["./src/capture-xhs.ts", "./src/xhs-target.ts"]) {
      const page = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(compact(page)).toContain(compact(parser[0]));
    }
    const background = readFileSync(new URL("./src/background.ts", import.meta.url), "utf8");
    const patterns = background.slice(background.indexOf("const XHS_DOCUMENT_PATTERNS"), background.indexOf("const XHS_DOCUMENT_PATTERNS") + 220);
    const block = background.slice(background.indexOf("id: XHS_MENU_ID"), background.indexOf("id: XHS_MENU_ID") + 280);
    expect(patterns).toContain("https://www.xiaohongshu.com/*");
    expect(patterns).toContain("https://xiaohongshu.com/*");
    expect(block).toContain('contexts: ["page", "video"]');
    expect(block).toContain("documentUrlPatterns: XHS_DOCUMENT_PATTERNS");
    expect(block).not.toContain("selection");
    expect(block).not.toContain('"image"');
  });
});

describe("saveCapturedXhsNote", () => {
  const client = (overrides = {}) => {
    const order = [];
    const calls = { saved: null, created: null };
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
        deleteMemo: async () => {
          order.push("delete");
        },
        createWithImage: async () => {
          order.push("with-image");
          return { memoId: "memo_1", resourceId: "res_1" };
        },
        ...overrides,
      },
    };
  };

  const input = {
    notebookId: "nb_inbox",
    title: "世赛现场，会贴瓷砖的女生帅爆了",
    nickname: "王小猫",
    noteTitle: "世赛现场，会贴瓷砖的女生帅爆了",
    body: "谁说贴瓷砖是男生的主场",
    datetime: "2026-09-20T08:00:00.000Z",
    location: "上海",
    noteUrl: canonicalNoteUrl(pageUrl, noteId),
    capturedAt: labels.capturedAt,
    sourceLabel: labels.sourceLabel,
    capturedAtLabel: labels.capturedAtLabel,
    timeLabel: labels.timeLabel,
    locationLabel: labels.locationLabel,
    altFallback: labels.altFallback,
  };

  test("creates a text note when the post has no photo", async () => {
    const fixture = client();
    const saved = await saveCapturedXhsNote(fixture.api, { ...input, images: [] });
    expect(saved).toEqual({ memoId: "memo_1", resourceIds: [] });
    expect(fixture.order).toEqual(["create"]);
    expect(fixture.calls.created.tags).toEqual(["web-clip"]);
    expect(fixture.calls.created.contentMarkdown).toContain("谁说贴瓷砖是男生的主场");
  });

  test("keeps the text note when a photo cannot be uploaded", async () => {
    const fixture = client({
      uploadImage: async () => {
        throw new Error("Missing required scope: write:resources");
      },
    });
    const saved = await saveCapturedXhsNote(fixture.api, {
      ...input,
      notebookId: "",
      images: [{ bytes: Uint8Array.of(1), mimeType: "image/jpeg", filename: "cover.jpg", alt: "封面" }],
    });
    expect(saved.memoId).toBe("memo_1");
    expect(saved.resourceIds).toEqual([]);
    expect(fixture.order).toEqual(["list", "create"]);
  });

  test("attaches an uploaded photo to the same note", async () => {
    const fixture = client();
    const saved = await saveCapturedXhsNote(fixture.api, {
      ...input,
      images: [{ bytes: Uint8Array.of(1), mimeType: "image/jpeg", filename: "cover.jpg", alt: "封面" }],
    });
    expect(saved.resourceIds).toEqual(["res_1"]);
    expect(fixture.order).toEqual(["create", "upload", "session", "save"]);
    expect(fixture.calls.saved.contentMarkdown).toContain("](/api/v1/resources/res_1/blob)");
    expect(fixture.calls.created.contentMarkdown.includes("](/api/v1/resources/")).toBe(false);
  });
});
