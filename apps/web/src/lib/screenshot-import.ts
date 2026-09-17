import { docToMarkdown, markdownToDoc, type TiptapDoc } from "@edgeever/shared";

export const normalizeScreenshotBytes = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) {
    const copy = new Uint8Array(value.byteLength);
    copy.set(value);
    return copy;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value.slice(0));
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return Uint8Array.from(value);
  }
  if (value && typeof value === "object" && "type" in value && (value as { type?: unknown }).type === "Buffer") {
    return normalizeScreenshotBytes((value as { data?: unknown }).data);
  }
  return new Uint8Array();
};

export const screenshotFileFromImportPayload = (payload: {
  name?: string;
  type?: string;
  bytes: unknown;
}) => {
  const bytes = normalizeScreenshotBytes(payload.bytes);
  const blobPart = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(blobPart).set(bytes);
  return new File([blobPart], payload.name || "screenshot.png", { type: payload.type || "image/png" });
};

export const screenshotImportDedupeKey = (payload: {
  captureId?: string;
  name?: string;
  title?: string;
}) => payload.captureId?.trim() || [payload.title?.trim() || "", payload.name || ""].join("\u0000");

export const createScreenshotImportGate = (cooldownMs = 15_000) => {
  let inFlight = false;
  const seen = new Map<string, number>();
  return {
    tryBegin(key: string, now = Date.now()) {
      if (inFlight) return false;
      const lastAt = seen.get(key);
      if (lastAt != null && now - lastAt < cooldownMs) return false;
      inFlight = true;
      return true;
    },
    finish(key: string, now = Date.now()) {
      inFlight = false;
      seen.set(key, now);
    },
    fail() {
      inFlight = false;
    },
  };
};

const SCREENSHOT_IMPORT_GATE_KEY = "__edgeeverScreenshotImportGate";

export const getScreenshotImportGate = () => {
  const scope = globalThis as typeof globalThis & {
    [SCREENSHOT_IMPORT_GATE_KEY]?: ReturnType<typeof createScreenshotImportGate>;
  };
  scope[SCREENSHOT_IMPORT_GATE_KEY] ??= createScreenshotImportGate();
  return scope[SCREENSHOT_IMPORT_GATE_KEY];
};

export const screenshotImportGate = {
  tryBegin: (key: string, now?: number) => getScreenshotImportGate().tryBegin(key, now),
  finish: (key: string, now?: number) => getScreenshotImportGate().finish(key, now),
  fail: () => getScreenshotImportGate().fail(),
};

const escapeMarkdownImageAlt = (value: string) => value.replaceAll("\\", "\\\\").replaceAll("]", "\\]");

export const screenshotNoteContent = (filename: string, url: string) => {
  const alt = escapeMarkdownImageAlt(filename || "screenshot.png");
  const contentMarkdown = `![${alt}](${url})`;
  const parsed = markdownToDoc(contentMarkdown);
  const nodes = parsed.content ?? [];
  const contentJson: TiptapDoc = {
    type: "doc",
    content: nodes.at(-1)?.type === "paragraph" ? nodes : [...nodes, { type: "paragraph" }],
  };
  return { contentJson, contentMarkdown: docToMarkdown(contentJson) };
};

type ScreenshotMemo = {
  id: string;
  revision: number;
  contentHash: string;
  title: string | null;
  tags: string[];
  contentMarkdown: string;
};

export const createScreenshotMemo = async <TMemo extends ScreenshotMemo>(input: {
  notebookId: string;
  title: string;
  file: File;
  createMemo: (payload: {
    notebookId: string;
    title: string;
    contentMarkdown: string;
    tags: string[];
  }) => Promise<{ memo: TMemo }>;
  uploadResource: (memoId: string, file: File) => Promise<{ url: string; filename?: string | null }>;
  updateMemo: (
    memo: TMemo,
    content: { contentJson: TiptapDoc; contentMarkdown: string },
  ) => Promise<{ memo: TMemo }>;
  deleteMemo?: (memoId: string) => Promise<unknown>;
}) => {
  const created = await input.createMemo({
    notebookId: input.notebookId,
    title: input.title,
    contentMarkdown: "",
    tags: [],
  });
  try {
    const resource = await input.uploadResource(created.memo.id, input.file);
    const content = screenshotNoteContent(resource.filename || input.file.name, resource.url);
    return (await input.updateMemo(created.memo, content)).memo;
  } catch (error) {
    await input.deleteMemo?.(created.memo.id).catch(() => undefined);
    throw error;
  }
};
