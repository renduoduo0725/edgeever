import { imageAltText, type ImageNoteClient } from "./image-clip";

const XHS_HOSTS = new Set([
  "xiaohongshu.com",
  "www.xiaohongshu.com",
]);

const MAX_XHS_IMAGES = 18;

export type XhsImageSource = {
  url: string;
  urlDefault: string;
  urlPre: string;
  infoList: Array<{ imageScene: string; url: string }>;
};

export type XhsPageSuccess = {
  ok: true;
  noteId: string;
  title: string;
  desc: string;
  nickname: string;
  timeMs: number;
  timeText: string;
  location: string;
  tags: string[];
  images: XhsImageSource[];
};

export type XhsPageFailure = {
  ok: false;
  reason: "not-found" | "needs-listener" | "needs-open";
};

export type XhsPageRead = XhsPageSuccess | XhsPageFailure;

export type ResolvedXhsNote = {
  noteId: string;
  nickname: string;
  title: string;
  body: string;
  datetime: string;
  location: string;
  noteUrl: string;
  imageUrls: string[];
};

export type XhsNoteImage = {
  resourceId: string;
  alt: string;
};

// Keep identical to noteIdFromPath in capture-xhs.ts and xhs-target.ts.
const noteIdFromPath = (pathname: string) => {
  const direct = pathname.match(/^\/(?:explore|discovery\/item)\/([0-9a-fA-F]{16,32})(?=\/|$)/);
  if (direct?.[1]) return direct[1];
  const profile = pathname.match(/^\/user\/profile\/[^/]+\/([0-9a-fA-F]{16,32})(?=\/|$)/);
  return profile?.[1] ?? "";
};

const escapeMarkdownLabel = (value: string) =>
  value.replace(/[\r\n]+/g, " ").replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");

const markdownDestination = (value: string) =>
  value.replace(/\\/g, "%5C").replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");

const sceneRank = (scene: string) => {
  const value = scene.toUpperCase();
  if (value.includes("ORG")) return 0;
  if (value.includes("DFT")) return 1;
  if (value.includes("PRV") || value.includes("PREV") || value.includes("THUMB")) return 5;
  if (value.startsWith("WB_")) return 2;
  return 4;
};

const isXhsImageHost = (hostname: string) => {
  const host = hostname.toLowerCase();
  if (host.includes("avatar")) return false;
  return host === "xhscdn.com"
    || host.endsWith(".xhscdn.com")
    || host === "xhscdn.net"
    || host.endsWith(".xhscdn.net")
    || host === "xiaohongshu.com"
    || host.endsWith(".xiaohongshu.com");
};

export const noteIdFromPageUrl = (pageUrl: string) => {
  try {
    const url = new URL(pageUrl);
    if (!XHS_HOSTS.has(url.hostname.toLowerCase())) return "";
    return noteIdFromPath(url.pathname);
  } catch {
    return "";
  }
};

export const canonicalNoteUrl = (pageUrl: string, noteId: string) => {
  if (!noteId) return "";
  const next = new URL(`https://www.xiaohongshu.com/explore/${noteId}`);
  try {
    const url = new URL(pageUrl);
    const token = url.searchParams.get("xsec_token");
    const source = url.searchParams.get("xsec_source");
    if (token) next.searchParams.set("xsec_token", token);
    if (source) next.searchParams.set("xsec_source", source);
  } catch {
    // The note id still identifies the post when the page URL cannot be parsed.
  }
  return next.toString();
};

export const normalizeXhsPhotoUrl = (value: string) => {
  const raw = value.trim();
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (!isXhsImageHost(url.hostname)) return "";
    if (url.pathname.toLowerCase().includes("avatar")) return "";
    if (/\.(mp4|mov|m3u8)$/i.test(url.pathname)) return "";
    if (url.protocol === "http:") url.protocol = "https:";
    return url.toString();
  } catch {
    return "";
  }
};

const photoKey = (value: string) => {
  try {
    const url = new URL(value);
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/![^/]*$/, "").toLowerCase()}`;
  } catch {
    return value;
  }
};

export const imageUrlsFromXhsImages = (images: XhsImageSource[]) => {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const image of images) {
    if (urls.length >= MAX_XHS_IMAGES) break;
    const ranked: Array<{ rank: number; url: string }> = [];
    for (const info of image.infoList) {
      if (info.url) ranked.push({ rank: sceneRank(info.imageScene), url: info.url });
    }
    if (image.urlDefault) ranked.push({ rank: 1, url: image.urlDefault });
    if (image.url) ranked.push({ rank: 3, url: image.url });
    if (image.urlPre) ranked.push({ rank: 5, url: image.urlPre });
    ranked.sort((left, right) => left.rank - right.rank);
    for (const item of ranked) {
      const normalized = normalizeXhsPhotoUrl(item.url);
      if (!normalized) continue;
      const key = photoKey(normalized);
      if (seen.has(key)) break;
      seen.add(key);
      urls.push(normalized);
      break;
    }
  }
  return urls;
};

export const cleanXhsText = (value: string) => {
  const lines = value.replace(/\r/g, "").split("\n").map((line) => line.trim());
  while (lines.length > 0 && !lines[0]) lines.shift();
  while (lines.length > 0 && !lines[lines.length - 1]) lines.pop();
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\n?(展开全文|展开|收起)\s*$/u, "").trim();
};

export const xhsBodyText = (desc: string, tags: string[]) => {
  const text = cleanXhsText(desc);
  const missing: string[] = [];
  for (const tag of tags) {
    const bare = tag.replace(/^#/, "").replace(/\[话题\]#?$/u, "").trim();
    if (!bare || text.includes(bare)) continue;
    missing.push(`#${bare}`);
  }
  if (missing.length === 0) return text;
  const line = missing.join(" ");
  return text ? `${text}\n${line}` : line;
};

export const splitXhsDateText = (value: string) => {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return { timeText: "", location: "" };
  const match = text.match(/^(.*?)(?:\s+)([^\s]+)$/);
  const head = match?.[1]?.trim() ?? "";
  const tail = match?.[2]?.trim() ?? "";
  if (head && tail && /(前|昨天|今天|编辑于|\d{4}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})/.test(head) && !/(前|昨天|今天)/.test(tail)) {
    return { timeText: head, location: tail };
  }
  return { timeText: text, location: "" };
};

export const xhsTimeIso = (timeMs: number) => {
  if (!Number.isFinite(timeMs) || timeMs <= 0) return "";
  const ms = timeMs < 1e11 ? timeMs * 1000 : timeMs;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
};

const isImageSource = (value: unknown): value is XhsImageSource => {
  if (!value || typeof value !== "object") return false;
  const image = value as Partial<XhsImageSource>;
  return typeof image.url === "string"
    && typeof image.urlDefault === "string"
    && typeof image.urlPre === "string"
    && Array.isArray(image.infoList)
    && image.infoList.every((info) => {
      const item = info as { imageScene?: unknown; url?: unknown };
      return typeof item?.imageScene === "string" && typeof item?.url === "string";
    });
};

export const isXhsPageRead = (value: unknown): value is XhsPageRead => {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<XhsPageSuccess> & Partial<XhsPageFailure>;
  if (record.ok === false) {
    return record.reason === "not-found" || record.reason === "needs-listener" || record.reason === "needs-open";
  }
  if (record.ok !== true) return false;
  return typeof record.noteId === "string"
    && typeof record.title === "string"
    && typeof record.desc === "string"
    && typeof record.nickname === "string"
    && typeof record.timeMs === "number"
    && typeof record.timeText === "string"
    && typeof record.location === "string"
    && Array.isArray(record.tags)
    && record.tags.every((tag) => typeof tag === "string")
    && Array.isArray(record.images)
    && record.images.every((image) => isImageSource(image));
};

export const resolveXhsNote = (read: XhsPageSuccess, pageUrl: string): ResolvedXhsNote | null => {
  const noteId = read.noteId || noteIdFromPageUrl(pageUrl);
  const split = splitXhsDateText(read.timeText);
  const nickname = read.nickname.replace(/\s+/g, " ").trim();
  const title = read.title.replace(/\s+/g, " ").trim();
  const body = xhsBodyText(read.desc, read.tags);
  const imageUrls = imageUrlsFromXhsImages(read.images);
  if (!title && !body && !nickname && imageUrls.length === 0) return null;
  return {
    noteId,
    nickname,
    title,
    body,
    datetime: xhsTimeIso(read.timeMs) || split.timeText,
    location: read.location.replace(/\s+/g, " ").trim() || split.location,
    noteUrl: canonicalNoteUrl(pageUrl, noteId) || pageUrl,
    imageUrls,
  };
};

export const xhsNoteTitle = (input: { title: string; nickname: string; body: string; fallback: string }) => {
  const heading = input.title.replace(/\s+/g, " ").trim();
  if (heading) return heading.slice(0, 160);
  const first = cleanXhsText(input.body).split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  const name = input.nickname.replace(/\s+/g, " ").trim();
  const combined = name && first ? `${name}: ${first}` : (first || name || input.fallback);
  return combined.replace(/\s+/g, " ").trim().slice(0, 160);
};

export const xhsNoteMarkdown = (input: {
  nickname: string;
  title: string;
  body: string;
  datetime: string;
  location: string;
  noteUrl: string;
  images: XhsNoteImage[];
  capturedAt: string;
  sourceLabel: string;
  capturedAtLabel: string;
  timeLabel: string;
  locationLabel: string;
  altFallback: string;
}) => {
  const blocks: string[] = [];
  const nickname = input.nickname.replace(/\s+/g, " ").trim();
  if (nickname) blocks.push(nickname);
  const title = input.title.replace(/\s+/g, " ").trim();
  const body = cleanXhsText(input.body);
  if (title && !body.startsWith(title)) blocks.push(title);
  if (body) blocks.push(body);
  if (input.images.length > 0) {
    blocks.push(input.images.map((image) => (
      `![${imageAltText(image.alt, input.altFallback)}](/api/v1/resources/${encodeURIComponent(image.resourceId)}/blob)`
    )).join("\n\n"));
  }
  const footer = [
    input.noteUrl ? `${input.sourceLabel}: [${escapeMarkdownLabel(input.noteUrl)}](${markdownDestination(input.noteUrl)})` : "",
    input.datetime ? `${input.timeLabel}: ${input.datetime}` : "",
    input.location ? `${input.locationLabel}: ${input.location}` : "",
    `${input.capturedAtLabel}: ${input.capturedAt}`,
  ].filter(Boolean);
  blocks.push(footer.join("\n\n"));
  return blocks.join("\n\n");
};

export const saveCapturedXhsNote = async (
  client: ImageNoteClient,
  input: {
    notebookId: string;
    title: string;
    nickname: string;
    noteTitle: string;
    body: string;
    datetime: string;
    location: string;
    noteUrl: string;
    images: Array<{ bytes: Uint8Array; mimeType: string; filename: string; alt: string }>;
    capturedAt: string;
    sourceLabel: string;
    capturedAtLabel: string;
    timeLabel: string;
    locationLabel: string;
    altFallback: string;
  },
) => {
  let notebookId = input.notebookId;
  if (!notebookId) {
    const listed = await client.listNotebooks();
    notebookId = listed.notebooks[0]?.id ?? "";
  }
  if (!notebookId) throw new Error("no-notebook");

  const markdownFor = (images: XhsNoteImage[]) => xhsNoteMarkdown({
    nickname: input.nickname,
    title: input.noteTitle,
    body: input.body,
    datetime: input.datetime,
    location: input.location,
    noteUrl: input.noteUrl,
    images,
    capturedAt: input.capturedAt,
    sourceLabel: input.sourceLabel,
    capturedAtLabel: input.capturedAtLabel,
    timeLabel: input.timeLabel,
    locationLabel: input.locationLabel,
    altFallback: input.altFallback,
  });
  const created = await client.createMemo({
    notebookId,
    title: input.title,
    contentMarkdown: markdownFor([]),
    tags: ["web-clip"],
  });
  const memoId = created.memo.id;
  if (!memoId) throw new Error("create-missing-id");
  if (input.images.length === 0) return { memoId, resourceIds: [] as string[] };

  const uploaded: XhsNoteImage[] = [];
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

// Runs in the page's main world, where window.__INITIAL_STATE__ lives.
// Keep this function free of closures: Chrome serializes it with toString().
export function readXhsStateInPage(): XhsPageRead {
  const noteIdFromPath = (pathname: string) => {
    const direct = pathname.match(/^\/(?:explore|discovery\/item)\/([0-9a-fA-F]{16,32})(?=\/|$)/);
    if (direct?.[1]) return direct[1];
    const profile = pathname.match(/^\/user\/profile\/[^/]+\/([0-9a-fA-F]{16,32})(?=\/|$)/);
    return profile?.[1] ?? "";
  };
  const asString = (value: unknown) => (typeof value === "string" ? value : "");
  const asNumber = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    return 0;
  };
  try {
    const state = (window as unknown as {
      __INITIAL_STATE__?: {
        note?: {
          noteDetailMap?: Record<string, unknown>;
          currentNoteId?: unknown;
          firstNoteId?: unknown;
        };
      };
    }).__INITIAL_STATE__;
    const noteRoot = state?.note;
    if (!noteRoot?.noteDetailMap) return { ok: false, reason: "not-found" };
    const detailOpen = Boolean(document.querySelector("#noteContainer"));
    const noteId = noteIdFromPath(location.pathname)
      || (detailOpen ? asString(noteRoot.currentNoteId) || asString(noteRoot.firstNoteId) : "");
    if (!noteId) return { ok: false, reason: "not-found" };
    const entry = noteRoot.noteDetailMap[noteId];
    if (!entry || typeof entry !== "object") return { ok: false, reason: "not-found" };
    const record = entry as { note?: unknown };
    const note = record.note && typeof record.note === "object"
      ? record.note as Record<string, unknown>
      : record as Record<string, unknown>;
    const user = note.user && typeof note.user === "object" ? note.user as Record<string, unknown> : {};
    const tags: string[] = [];
    if (Array.isArray(note.tagList)) {
      for (const tag of note.tagList) {
        if (tags.length >= 40) break;
        const name = tag && typeof tag === "object" ? asString((tag as { name?: unknown }).name) : "";
        if (name) tags.push(name);
      }
    }
    const images: XhsImageSource[] = [];
    if (Array.isArray(note.imageList)) {
      for (const image of note.imageList) {
        if (images.length >= 18 || !image || typeof image !== "object") continue;
        const source = image as { url?: unknown; urlDefault?: unknown; urlPre?: unknown; infoList?: unknown };
        const infoList: XhsImageSource["infoList"] = [];
        if (Array.isArray(source.infoList)) {
          for (const info of source.infoList) {
            if (infoList.length >= 8 || !info || typeof info !== "object") continue;
            const item = info as { imageScene?: unknown; url?: unknown };
            infoList.push({ imageScene: asString(item.imageScene), url: asString(item.url) });
          }
        }
        images.push({
          url: asString(source.url),
          urlDefault: asString(source.urlDefault),
          urlPre: asString(source.urlPre),
          infoList,
        });
      }
    }
    const title = asString(note.title);
    const desc = asString(note.desc);
    const nickname = asString(user.nickname) || asString(user.nickName);
    if (!title && !desc && !nickname && images.length === 0) return { ok: false, reason: "not-found" };
    return {
      ok: true,
      noteId: asString(note.noteId) || noteId,
      title,
      desc,
      nickname,
      timeMs: asNumber(note.time),
      timeText: "",
      location: asString(note.ipLocation),
      tags,
      images,
    };
  } catch {
    return { ok: false, reason: "not-found" };
  }
}
