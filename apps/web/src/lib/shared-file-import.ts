import { docToMarkdown, markdownToDoc, type TiptapDoc } from "@edgeever/shared";
import { screenshotNoteContent } from "./screenshot-import";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
const MARKDOWN_EXTENSIONS = new Set(["md", "markdown"]);
export const MAX_SHARED_MARKDOWN_BYTES = 8 * 1024 * 1024;

const extensionOf = (filename: string) => filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

export const sharedFileTitle = (filename: string) => {
  const trimmed = filename.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) return trimmed || filename;
  const stem = trimmed.slice(0, dot).trim();
  return stem || trimmed;
};

const escapeLabel = (value: string) => value.replace(/[\\[\]]/g, "\\$&");

export const sharedFileAttachmentMarkdown = (filename: string, url: string) =>
  `[附件：${escapeLabel(filename || "file")}](${url})`;

const isImageFile = (filename: string, mimeType: string) =>
  mimeType.toLowerCase().startsWith("image/") || IMAGE_EXTENSIONS.has(extensionOf(filename));

const attachmentNoteContent = (markdown: string) => {
  const parsed = markdownToDoc(markdown);
  const nodes = parsed.content ?? [];
  const contentJson: TiptapDoc = {
    type: "doc",
    content: nodes.at(-1)?.type === "paragraph" ? nodes : [...nodes, { type: "paragraph" }],
  };
  return { contentJson, contentMarkdown: docToMarkdown(contentJson) };
};

type SharedMemo = {
  id: string;
  revision: number;
  contentHash: string;
  title: string | null;
  tags: string[];
  contentMarkdown: string;
};

export const createSharedFileMemo = async <TMemo extends SharedMemo>(input: {
  notebookId: string;
  filename: string;
  file: File;
  createMemo: (payload: {
    notebookId: string;
    title: string;
    contentMarkdown: string;
    tags: string[];
  }) => Promise<{ memo: TMemo }>;
  prepareFile?: (file: File) => Promise<File>;
  uploadResource: (memoId: string, file: File) => Promise<{ url: string; filename?: string | null }>;
  updateMemo: (
    memo: TMemo,
    content: { contentJson: TiptapDoc; contentMarkdown: string },
  ) => Promise<{ memo: TMemo }>;
  deleteMemo?: (memoId: string) => Promise<unknown>;
}) => {
  const title = sharedFileTitle(input.filename);
  const extension = extensionOf(input.filename);
  if (MARKDOWN_EXTENSIONS.has(extension) && input.file.size <= MAX_SHARED_MARKDOWN_BYTES) {
    const text = await input.file.text();
    return (await input.createMemo({
      notebookId: input.notebookId,
      title,
      contentMarkdown: text,
      tags: [],
    })).memo;
  }

  const created = await input.createMemo({
    notebookId: input.notebookId,
    title,
    contentMarkdown: "",
    tags: [],
  });
  try {
    const prepared = input.prepareFile ? await input.prepareFile(input.file) : input.file;
    const resource = await input.uploadResource(created.memo.id, prepared);
    const filename = resource.filename || prepared.name || input.filename;
    const content = isImageFile(filename, prepared.type || input.file.type)
      ? screenshotNoteContent(filename, resource.url)
      : attachmentNoteContent(sharedFileAttachmentMarkdown(filename, resource.url));
    return (await input.updateMemo(created.memo, content)).memo;
  } catch (error) {
    await input.deleteMemo?.(created.memo.id).catch(() => undefined);
    throw error;
  }
};
