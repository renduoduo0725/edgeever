import { imageAltText, type ImageNoteClient } from "./image-clip";

const TWEET_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
]);

export type CapturedTweet = {
  ok: true;
  displayName: string;
  handle: string;
  text: string;
  quotedDisplayName: string;
  quotedHandle: string;
  quotedText: string;
  datetime: string;
  statusUrl: string;
  images: Array<{ url: string; alt: string }>;
};

export type CapturedTweetFailure = {
  ok: false;
  reason: "not-found" | "needs-listener";
};

export type TweetNoteImage = {
  resourceId: string;
  alt: string;
};

const escapeMarkdownLabel = (value: string) =>
  value.replace(/[\r\n]+/g, " ").replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");

const markdownDestination = (value: string) =>
  value.replace(/\\/g, "%5C").replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");

export const statusIdFromPageUrl = (pageUrl: string) => {
  try {
    const url = new URL(pageUrl);
    if (!TWEET_HOSTS.has(url.hostname.toLowerCase())) return "";
    return url.pathname.match(/\/status\/(\d+)/)?.[1] ?? "";
  } catch {
    return "";
  }
};

export const canonicalStatusUrl = (pageUrl: string) => {
  const statusId = statusIdFromPageUrl(pageUrl);
  if (!statusId) return "";
  try {
    const url = new URL(pageUrl);
    const user = url.pathname.match(/\/([^/]+)\/status\/\d+/)?.[1];
    if (!user) return "";
    return `${url.origin}/${user}/status/${statusId}`;
  } catch {
    return "";
  }
};

export const isTweetPhotoUrl = (src: string) => {
  if (!src || src.startsWith("blob:") || src.startsWith("data:")) return false;
  try {
    const url = new URL(src);
    const host = url.hostname.toLowerCase();
    if (host !== "pbs.twimg.com" && !host.endsWith(".twimg.com")) return false;
    const path = url.pathname.toLowerCase();
    if (path.includes("/profile_images/") || path.includes("/profile_banners/") || path.includes("/emoji/")) return false;
    if (path.includes("/amplify_video") || path.includes("/ext_tw_video") || path.includes("/tweet_video")) return false;
    return path.includes("/media/") || path.includes("/card_img/");
  } catch {
    return false;
  }
};

export const cleanTweetText = (value: string) => {
  const lines = value.replace(/\r/g, "").split("\n").map((line) => line.trimEnd());
  while (lines.length > 0 && !lines[lines.length - 1]?.trim()) lines.pop();
  while (lines.length > 0 && /^(显示更多|Show more|もっと見る|さらに表示)$/i.test(lines[lines.length - 1]?.trim() ?? "")) {
    lines.pop();
  }
  return lines.join("\n").trim();
};

// Quote cards on X put the name and @handle in plain text, not in links.
// Keep the body of this function identical to visibleTweetAuthor in capture-tweet.ts.
export const visibleTweetAuthor = (value: string) => {
  const parts = value.replace(/\r/g, "").split("\n").map((part) => part.trim()).filter(Boolean);
  const handlePart = parts.find((part) => /^@[A-Za-z0-9_]{1,15}$/.test(part));
  const handle = handlePart ? handlePart.slice(1) : "";
  const displayName = parts.find((part) => part !== handlePart && part !== "·" && part !== "•") ?? "";
  return { displayName, handle };
};

export const tweetAuthorLine = (displayName: string, handle: string) => {
  const name = displayName.replace(/\s+/g, " ").trim();
  const user = handle.replace(/^@/, "").replace(/\s+/g, "").trim();
  if (name && user) return `${name} (@${user})`;
  if (user) return `@${user}`;
  return name;
};

export const tweetNoteTitle = (input: { displayName: string; handle: string; text: string; fallback: string }) => {
  const name = input.displayName.replace(/\s+/g, " ").trim()
    || (input.handle.trim() ? `@${input.handle.replace(/^@/, "").trim()}` : "");
  const firstLine = cleanTweetText(input.text).split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  const combined = name && firstLine ? `${name}: ${firstLine}` : (firstLine || name || input.fallback);
  return combined.replace(/\s+/g, " ").trim().slice(0, 160);
};

export const isCapturedTweet = (value: unknown): value is CapturedTweet | CapturedTweetFailure => {
  if (!value || typeof value !== "object") return false;
  const record = value as {
    ok?: unknown;
    reason?: unknown;
    displayName?: unknown;
    handle?: unknown;
    text?: unknown;
    quotedDisplayName?: unknown;
    quotedHandle?: unknown;
    quotedText?: unknown;
    datetime?: unknown;
    statusUrl?: unknown;
    images?: unknown;
  };
  if (record.ok === false) return record.reason === "not-found" || record.reason === "needs-listener";
  if (record.ok !== true) return false;
  if (!Array.isArray(record.images)) return false;
  return typeof record.displayName === "string"
    && typeof record.handle === "string"
    && typeof record.text === "string"
    && typeof record.quotedDisplayName === "string"
    && typeof record.quotedHandle === "string"
    && typeof record.quotedText === "string"
    && typeof record.datetime === "string"
    && typeof record.statusUrl === "string"
    && record.images.every((image) => {
      const item = image as { url?: unknown; alt?: unknown };
      return typeof item?.url === "string" && typeof item?.alt === "string";
    });
};

export const tweetNoteMarkdown = (input: {
  displayName: string;
  handle: string;
  text: string;
  quotedDisplayName: string;
  quotedHandle: string;
  quotedText: string;
  datetime: string;
  statusUrl: string;
  images: TweetNoteImage[];
  capturedAt: string;
  sourceLabel: string;
  capturedAtLabel: string;
  timeLabel: string;
  altFallback: string;
}) => {
  const blocks: string[] = [];
  const author = tweetAuthorLine(input.displayName, input.handle);
  if (author) blocks.push(author);
  const text = cleanTweetText(input.text);
  if (text) blocks.push(text);
  const quoted = cleanTweetText(input.quotedText);
  if (quoted) {
    const quoteAuthor = tweetAuthorLine(input.quotedDisplayName, input.quotedHandle);
    const lines = quoteAuthor ? [quoteAuthor, ...quoted.split("\n")] : quoted.split("\n");
    blocks.push(lines.map((line) => `> ${line}`).join("\n"));
  }
  if (input.images.length > 0) {
    blocks.push(input.images.map((image) => (
      `![${imageAltText(image.alt, input.altFallback)}](/api/v1/resources/${encodeURIComponent(image.resourceId)}/blob)`
    )).join("\n\n"));
  }
  const footer = [
    `${input.sourceLabel}: [${escapeMarkdownLabel(input.statusUrl)}](${markdownDestination(input.statusUrl)})`,
    input.datetime ? `${input.timeLabel}: ${input.datetime}` : "",
    `${input.capturedAtLabel}: ${input.capturedAt}`,
  ].filter(Boolean);
  blocks.push(footer.join("\n\n"));
  return blocks.join("\n\n");
};

export const saveCapturedTweetNote = async (
  client: ImageNoteClient,
  input: {
    notebookId: string;
    title: string;
    displayName: string;
    handle: string;
    text: string;
    quotedDisplayName: string;
    quotedHandle: string;
    quotedText: string;
    datetime: string;
    statusUrl: string;
    images: Array<{ bytes: Uint8Array; mimeType: string; filename: string; alt: string }>;
    capturedAt: string;
    sourceLabel: string;
    capturedAtLabel: string;
    timeLabel: string;
    altFallback: string;
  },
) => {
  let notebookId = input.notebookId;
  if (!notebookId) {
    const listed = await client.listNotebooks();
    notebookId = listed.notebooks[0]?.id ?? "";
  }
  if (!notebookId) throw new Error("no-notebook");

  const markdownFor = (images: TweetNoteImage[]) => tweetNoteMarkdown({ ...input, images });
  const created = await client.createMemo({
    notebookId,
    title: input.title,
    contentMarkdown: markdownFor([]),
    tags: ["web-clip"],
  });
  const memoId = created.memo.id;
  if (!memoId) throw new Error("create-missing-id");
  if (input.images.length === 0) return { memoId, resourceIds: [] as string[] };

  const uploaded: TweetNoteImage[] = [];
  for (const image of input.images) {
    try {
      const resource = await client.uploadImage(memoId, image);
      if (resource.id) uploaded.push({ resourceId: resource.id, alt: image.alt });
    } catch {
      // The text note is still useful when one attachment cannot be stored.
    }
  }
  if (uploaded.length === 0) return { memoId, resourceIds: [] as string[] };

  try {
    const session = await client.createEditSession(memoId);
    await client.saveMemo(memoId, {
      editSessionId: session.editSession.id,
      expectedRevision: session.editSession.baseRevision,
      expectedContentHash: session.editSession.baseContentHash,
      contentMarkdown: markdownFor(uploaded),
    });
  } catch {
    // Leave the text note in place when attaching images fails.
  }
  return { memoId, resourceIds: uploaded.map((image) => image.resourceId) };
};
