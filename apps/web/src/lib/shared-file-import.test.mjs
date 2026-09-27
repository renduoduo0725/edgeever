import { describe, expect, test } from "bun:test";
import { FILE_ATTACHMENT_NODE_TYPE, PDF_ATTACHMENT_NODE_TYPE } from "@edgeever/shared";
import { createSharedFileMemo, sharedFileTitle } from "./shared-file-import.ts";

const memo = {
  id: "memo_1",
  revision: 1,
  contentHash: "hash",
  title: "",
  tags: [],
  contentMarkdown: "",
};

describe("shared file note", () => {
  test("uses the filename without its extension as the title", () => {
    expect(sharedFileTitle("云晰科技爆单键盘项目功能梳理表.xlsx")).toBe("云晰科技爆单键盘项目功能梳理表");
    expect(sharedFileTitle("notes.md")).toBe("notes");
    expect(sharedFileTitle("README")).toBe("README");
  });

  test("stores a spreadsheet as an attachment", async () => {
    let createdTitle = "";
    let updated = null;
    const result = await createSharedFileMemo({
      notebookId: "nb_inbox",
      filename: "云晰科技爆单键盘项目功能梳理表.xlsx",
      file: new File(["sheet"], "云晰科技爆单键盘项目功能梳理表.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      createMemo: async (input) => {
        createdTitle = input.title;
        return { memo: { ...memo, title: input.title } };
      },
      uploadResource: async () => ({ url: "edgeever-staged://sheet" }),
      updateMemo: async (created, content) => {
        updated = content;
        return { memo: { ...created, contentMarkdown: content.contentMarkdown } };
      },
    });
    expect(createdTitle).toBe("云晰科技爆单键盘项目功能梳理表");
    expect(result.contentMarkdown).toContain("edgeever-staged://sheet");
    expect(JSON.stringify(updated.contentJson)).toContain(FILE_ATTACHMENT_NODE_TYPE);
  });

  test("stores a picture inline", async () => {
    let updated = null;
    await createSharedFileMemo({
      notebookId: "nb_inbox",
      filename: "photo.png",
      file: new File(["png"], "photo.png", { type: "image/png" }),
      createMemo: async (input) => ({ memo: { ...memo, title: input.title } }),
      uploadResource: async () => ({ url: "edgeever-staged://photo.png", filename: "photo.png" }),
      updateMemo: async (created, content) => {
        updated = content;
        return { memo: { ...created, contentMarkdown: content.contentMarkdown } };
      },
    });
    expect(updated.contentMarkdown).toContain("![photo.png](edgeever-staged://photo.png)");
    expect(updated.contentJson.content.some((node) => node.type === "image")).toBe(true);
  });

  test("stores a pdf as a pdf attachment", async () => {
    let updated = null;
    await createSharedFileMemo({
      notebookId: "nb_inbox",
      filename: "brief.pdf",
      file: new File(["pdf"], "brief.pdf", { type: "application/pdf" }),
      createMemo: async () => ({ memo }),
      uploadResource: async () => ({ url: "edgeever-staged://brief.pdf", filename: "brief.pdf" }),
      updateMemo: async (_created, content) => {
        updated = content;
        return { memo: { ...memo, contentMarkdown: content.contentMarkdown } };
      },
    });
    expect(JSON.stringify(updated.contentJson)).toContain(PDF_ATTACHMENT_NODE_TYPE);
  });

  test("puts markdown text in the note body", async () => {
    let created = null;
    const uploads = [];
    const result = await createSharedFileMemo({
      notebookId: "nb_inbox",
      filename: "今天.md",
      file: new File(["# 今天\n\n正文"], "今天.md", { type: "text/markdown" }),
      createMemo: async (input) => {
        created = input;
        return { memo: { ...memo, title: input.title, contentMarkdown: input.contentMarkdown } };
      },
      uploadResource: async () => {
        uploads.push(true);
        return { url: "edgeever-staged://unused" };
      },
      updateMemo: async () => { throw new Error("should not update"); },
    });
    expect(created.title).toBe("今天");
    expect(created.contentMarkdown).toBe("# 今天\n\n正文");
    expect(uploads).toHaveLength(0);
    expect(result.contentMarkdown).toBe("# 今天\n\n正文");
  });

  test("removes the empty note when the attachment cannot be saved", async () => {
    const deleted = [];
    await expect(createSharedFileMemo({
      notebookId: "nb_inbox",
      filename: "sheet.xlsx",
      file: new File(["x"], "sheet.xlsx"),
      createMemo: async () => ({ memo }),
      uploadResource: async () => { throw new Error("offline"); },
      updateMemo: async () => { throw new Error("should not update"); },
      deleteMemo: async (id) => { deleted.push(id); },
    })).rejects.toThrow("offline");
    expect(deleted).toEqual(["memo_1"]);
  });
});
