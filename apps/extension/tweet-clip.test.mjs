import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import {
  canonicalStatusUrl,
  cleanTweetText,
  isTweetPhotoUrl,
  saveCapturedTweetNote,
  statusIdFromPageUrl,
  tweetAuthorLine,
  tweetNoteMarkdown,
  tweetNoteTitle,
  visibleTweetAuthor,
} from "./src/tweet-clip.ts";

const labels = {
  capturedAt: "2026-09-26T00:00:00.000Z",
  sourceLabel: "来源",
  capturedAtLabel: "抓取时间",
  timeLabel: "时间",
  altFallback: "图片",
};

const tweet = {
  displayName: "火山哥",
  handle: "huoshan007",
  text: "兄弟们，我今天挖到一个真狠活。\n显示更多",
  quotedDisplayName: "Jianying",
  quotedHandle: "jianying",
  quotedText: "无界面后台版",
  datetime: "2026-09-26T01:00:00.000Z",
  statusUrl: "https://x.com/huoshan007/status/123",
  ...labels,
};

describe("tweet addresses", () => {
  test("reads a status id from a post page and ignores a timeline", () => {
    expect(statusIdFromPageUrl("https://x.com/huoshan007/status/123")).toBe("123");
    expect(statusIdFromPageUrl("https://twitter.com/huoshan007/status/123/photo/1")).toBe("123");
    expect(statusIdFromPageUrl("https://x.com/home")).toBe("");
    expect(canonicalStatusUrl("https://x.com/huoshan007/status/123/photo/1?s=20")).toBe("https://x.com/huoshan007/status/123");
  });
});

describe("tweet note content", () => {
  test("keeps the visible post, quote, photo, and source link", () => {
    expect(cleanTweetText(tweet.text)).toBe("兄弟们，我今天挖到一个真狠活。");
    expect(tweetAuthorLine("火山哥", "@huoshan007")).toBe("火山哥 (@huoshan007)");
    expect(tweetNoteTitle({ ...tweet, fallback: "一条推文" })).toBe("火山哥: 兄弟们，我今天挖到一个真狠活。");
    const markdown = tweetNoteMarkdown({
      ...tweet,
      text: cleanTweetText(tweet.text),
      images: [{ resourceId: "res_1", alt: "卡片]图" }],
    });
    expect(markdown.startsWith("火山哥 (@huoshan007)")).toBe(true);
    expect(markdown).toContain("兄弟们，我今天挖到一个真狠活。");
    expect(markdown).toContain("> Jianying (@jianying)\n> 无界面后台版");
    expect(markdown).toContain("![卡片 图](/api/v1/resources/res_1/blob)");
    expect(markdown).toContain("(https://x.com/huoshan007/status/123)");
    expect(markdown).toContain("时间: 2026-09-26T01:00:00.000Z");
    expect(markdown).not.toContain("pbs.twimg.com");
  });

  test("reads a quote author from the visible name block when it has no links", () => {
    expect(visibleTweetAuthor("yetone\n@yetone\n·\n9月25日")).toEqual({ displayName: "yetone", handle: "yetone" });
    expect(visibleTweetAuthor("Geek\n@geekbb\n·\n2小时")).toEqual({ displayName: "Geek", handle: "geekbb" });
    expect(visibleTweetAuthor("")).toEqual({ displayName: "", handle: "" });
    const page = readFileSync(new URL("./src/capture-tweet.ts", import.meta.url), "utf8");
    const library = readFileSync(new URL("./src/tweet-clip.ts", import.meta.url), "utf8");
    const parser = library.match(/const visibleTweetAuthor = \(value: string\) => \{[\s\S]*?\n\};/);
    const compact = (source) => source.replace(/^[ \t]+/gm, "");
    expect(parser?.[0]).toBeTruthy();
    expect(compact(page)).toContain(compact(parser[0]));
  });

  test("accepts post photos and skips avatars, emoji, and video posters", () => {
    expect(isTweetPhotoUrl("https://pbs.twimg.com/media/Abc?format=jpg&name=small")).toBe(true);
    expect(isTweetPhotoUrl("https://pbs.twimg.com/card_img/Abc/img")).toBe(true);
    expect(isTweetPhotoUrl("https://pbs.twimg.com/profile_images/Abc/avatar.jpg")).toBe(false);
    expect(isTweetPhotoUrl("https://abs.twimg.com/emoji/v2/svg/1f600.svg")).toBe(false);
    expect(isTweetPhotoUrl("https://pbs.twimg.com/ext_tw_video_thumb/Abc/img.jpg")).toBe(false);
  });
});

describe("saveCapturedTweetNote", () => {
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
        ...overrides,
      },
    };
  };

  test("creates a text note when the post has no photo", async () => {
    const fixture = client();
    const saved = await saveCapturedTweetNote(fixture.api, {
      notebookId: "nb_inbox",
      title: "火山哥: 兄弟们",
      ...tweet,
      images: [],
    });
    expect(saved).toEqual({ memoId: "memo_1", resourceIds: [] });
    expect(fixture.order).toEqual(["create"]);
    expect(fixture.calls.created.tags).toEqual(["web-clip"]);
    expect(fixture.calls.created.contentMarkdown).toContain("兄弟们，我今天挖到一个真狠活。");
  });

  test("keeps the text note when a photo cannot be uploaded", async () => {
    const fixture = client({
      uploadImage: async () => {
        throw new Error("Missing required scope: write:resources");
      },
    });
    const saved = await saveCapturedTweetNote(fixture.api, {
      notebookId: "",
      title: "火山哥: 兄弟们",
      ...tweet,
      images: [{ bytes: Uint8Array.of(1), mimeType: "image/jpeg", filename: "Abc.jpg", alt: "卡片" }],
    });
    expect(saved.memoId).toBe("memo_1");
    expect(saved.resourceIds).toEqual([]);
    expect(fixture.order).toEqual(["list", "create"]);
    expect(fixture.calls.created.notebookId).toBe("nb_first");
  });

  test("attaches an uploaded photo to the same note", async () => {
    const fixture = client();
    const saved = await saveCapturedTweetNote(fixture.api, {
      notebookId: "nb_inbox",
      title: "火山哥: 兄弟们",
      ...tweet,
      images: [{ bytes: Uint8Array.of(1), mimeType: "image/jpeg", filename: "Abc.jpg", alt: "卡片" }],
    });
    expect(saved.resourceIds).toEqual(["res_1"]);
    expect(fixture.order).toEqual(["create", "upload", "session", "save"]);
    expect(fixture.calls.saved.contentMarkdown).toContain("](/api/v1/resources/res_1/blob)");
    expect(fixture.calls.created.contentMarkdown.includes("](/api/v1/resources/")).toBe(false);
  });
});
