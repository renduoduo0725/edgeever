import { describe, expect, test } from "bun:test";
import { FILE_ATTACHMENT_NODE_TYPE } from "@edgeever/shared";
import { createWeChatChatMemo } from "./wechat-chat-import.ts";

const memo = {
  id: "memo_1",
  revision: 1,
  contentHash: "hash",
  title: "聊天记录_20260922_223222",
  tags: [],
  contentMarkdown: "",
};

describe("WeChat chat note", () => {
  test("stores the picture inline and the video as an attachment", async () => {
    let updated = null;
    const result = await createWeChatChatMemo({
      notebookId: "nb_inbox",
      title: memo.title,
      markdown: [
        "**鱼** · 2026年9月22日 22:15",
        "",
        "![微信图片_1.jpg](edgeever-wechat-media://m1)",
        "",
        "**鱼** · 2026年9月22日 22:20",
        "",
        "[附件：微信视频_1.mp4](edgeever-wechat-media://m2)",
      ].join("\n"),
      media: [
        { id: "m1", filename: "微信图片_1.jpg", mimeType: "image/jpeg", byteSize: 4 },
        { id: "m2", filename: "微信视频_1.mp4", mimeType: "video/mp4", byteSize: 4 },
      ],
      createMemo: async () => ({ memo }),
      readMedia: async (item) => new File([item.id], item.filename, { type: item.mimeType }),
      uploadResource: async (_memoId, file) => ({ url: `edgeever-staged://${file.name}` }),
      updateMemo: async (_created, content) => {
        updated = content;
        return { memo: { ...memo, contentMarkdown: content.contentMarkdown } };
      },
    });
    expect(result.contentMarkdown).toContain("edgeever-staged://微信图片_1.jpg");
    expect(result.contentMarkdown).toContain("edgeever-staged://微信视频_1.mp4");
    expect(result.contentMarkdown).not.toContain("edgeever-wechat-media://");
    const saved = JSON.stringify(updated.contentJson);
    expect(saved).toContain("edgeever-staged://微信图片_1.jpg");
    expect(saved).toContain(FILE_ATTACHMENT_NODE_TYPE);
  });

  test("removes the empty note when an attachment cannot be saved", async () => {
    const deleted = [];
    await expect(createWeChatChatMemo({
      notebookId: "nb_inbox",
      title: "聊天记录",
      markdown: "![图.jpg](edgeever-wechat-media://m1)",
      media: [{ id: "m1", filename: "图.jpg", mimeType: "image/jpeg", byteSize: 1 }],
      createMemo: async () => ({ memo }),
      readMedia: async () => new File(["x"], "图.jpg", { type: "image/jpeg" }),
      uploadResource: async () => { throw new Error("offline"); },
      updateMemo: async () => { throw new Error("should not update"); },
      deleteMemo: async (id) => { deleted.push(id); },
    })).rejects.toThrow("offline");
    expect(deleted).toEqual(["memo_1"]);
  });
});
