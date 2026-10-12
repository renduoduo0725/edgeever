import { clipDateTimeText } from "./clip-time";
export { clipDateTimeText } from "./clip-time";
import TurndownService from "turndown";

export type ClipPlatform = "hacker-news" | "v2ex" | "xiaoyuzhou" | "facebook" | "instagram" | "linkedin" | "threads" | "bluesky" | "substack-note";
export type PlatformTarget = { platform: ClipPlatform; id: string; url: string };
export type PublishedTime = { value: string; precision: "datetime" | "date" | "relative" };
export type PlatformClip = PlatformTarget & {
  title: string;
  markdown: string;
  author?: string;
  publishedAt?: PublishedTime;
  tags: string[];
  completeness: "complete" | "no-shownotes";
};
export type PlatformRead = { ok: true; clip: PlatformClip } | {
  ok: false;
  reason: "not-target" | "unreadable" | "changed" | "incomplete";
};
export type PlatformLabels = {
  score: string;
  externalLink: string;
  supplement: string;
  podcast: string;
  noShowNotes: string;
  relativeTime: string;
};

export const PLATFORM_MENUS = [
  { id: "save-hacker-news", title: "saveHackerNewsToEdgeEver", patterns: ["https://news.ycombinator.com/item?*"] },
  { id: "save-v2ex", title: "saveV2exToEdgeEver", patterns: ["https://www.v2ex.com/t/*", "https://v2ex.com/t/*"] },
  { id: "save-xiaoyuzhou", title: "saveXiaoyuzhouToEdgeEver", patterns: ["https://www.xiaoyuzhoufm.com/episode/*"] },
  { id: "save-facebook", title: "saveFacebookToEdgeEver", patterns: ["https://www.facebook.com/*", "https://facebook.com/*", "https://m.facebook.com/*"] },
  { id: "save-instagram", title: "saveInstagramToEdgeEver", patterns: ["https://www.instagram.com/*", "https://instagram.com/*"] },
  { id: "save-linkedin", title: "saveLinkedinToEdgeEver", patterns: ["https://www.linkedin.com/*", "https://linkedin.com/*"] },
  { id: "save-threads", title: "saveThreadsToEdgeEver", patterns: ["https://www.threads.com/*", "https://threads.com/*", "https://www.threads.net/*", "https://threads.net/*"] },
  { id: "save-bluesky", title: "saveBlueskyToEdgeEver", patterns: ["https://bsky.app/*"] },
  { id: "save-substack-note", title: "saveSubstackNoteToEdgeEver", patterns: ["https://substack.com/@*/note/*", "https://www.substack.com/@*/note/*"] },
] as const;

export const platformTarget = (pageUrl: string): PlatformTarget | null => {
  let url: URL;
  try { url = new URL(pageUrl); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (url.hostname === "news.ycombinator.com" && url.pathname === "/item") {
    const ids = url.searchParams.getAll("id");
    if (ids.length !== 1 || !/^[1-9]\d*$/.test(ids[0])) return null;
    return { platform: "hacker-news", id: ids[0], url: `https://news.ycombinator.com/item?id=${ids[0]}` };
  }
  if (url.hostname === "v2ex.com" || url.hostname === "www.v2ex.com") {
    const id = /^\/t\/([1-9]\d*)\/?$/.exec(url.pathname)?.[1];
    return id ? { platform: "v2ex", id, url: `https://www.v2ex.com/t/${id}` } : null;
  }
  if (url.hostname === "www.xiaoyuzhoufm.com") {
    const id = /^\/episode\/([a-f0-9]{24})\/?$/.exec(url.pathname)?.[1];
    return id ? { platform: "xiaoyuzhou", id, url: `https://www.xiaoyuzhoufm.com/episode/${id}` } : null;
  }
  if (url.hostname === "substack.com" || url.hostname === "www.substack.com") {
    const match = /^\/@([a-zA-Z0-9_-]+)\/note\/(c-[1-9]\d*)\/?$/.exec(url.pathname);
    if (match) return { platform: "substack-note", id: `${match[1].toLowerCase()}/${match[2]}`, url: `https://substack.com/@${match[1].toLowerCase()}/note/${match[2]}` };
  }
  if (url.hostname === "bsky.app") {
    const match = /^\/profile\/([a-zA-Z0-9.:%-]+)\/post\/([a-z2-7]{13})\/?$/.exec(url.pathname);
    if (match) return { platform: "bluesky", id: `${match[1]}/${match[2]}`, url: `https://bsky.app/profile/${match[1]}/post/${match[2]}` };
  }
  if (["threads.com", "www.threads.com", "threads.net", "www.threads.net"].includes(url.hostname)) {
    const match = /^\/@([a-zA-Z0-9._]+)\/post\/([a-zA-Z0-9_-]+)\/?$/.exec(url.pathname);
    if (match) return { platform: "threads", id: `${match[1].toLowerCase()}/${match[2]}`, url: `https://www.threads.com/@${match[1].toLowerCase()}/post/${match[2]}` };
  }
  if (["instagram.com", "www.instagram.com"].includes(url.hostname)) {
    const code = /^\/(?:[a-zA-Z0-9._]+\/)?(?:p|reel)\/([a-zA-Z0-9_-]+)\/?$/.exec(url.pathname)?.[1];
    if (code) return { platform: "instagram", id: code, url: `https://www.instagram.com/p/${code}/` };
  }
  if (["facebook.com", "www.facebook.com", "m.facebook.com"].includes(url.hostname)) {
    const match = /^\/([a-zA-Z0-9.]+)\/posts\/(?:[a-zA-Z0-9_-]+\/)?([1-9]\d*|pfbid[a-zA-Z0-9]+)\/?$/.exec(url.pathname);
    if (match) return { platform: "facebook", id: match[2], url: `https://www.facebook.com/${match[1]}/posts/${match[2]}` };
    if (["/permalink.php", "/story.php"].includes(url.pathname)) {
      const id = url.searchParams.get("story_fbid"), owner = url.searchParams.get("id");
      if (url.searchParams.getAll("story_fbid").length === 1 && url.searchParams.getAll("id").length === 1
        && id && owner && /^(?:[1-9]\d*|pfbid[a-zA-Z0-9]+)$/.test(id) && /^[1-9]\d*$/.test(owner)) {
        return { platform: "facebook", id, url: `https://www.facebook.com/${owner}/posts/${id}` };
      }
    }
  }
  if (["linkedin.com", "www.linkedin.com"].includes(url.hostname)) {
    const match = /^\/feed\/update\/urn:li:(activity|ugcPost):([1-9]\d*)\/?$/.exec(url.pathname)
      || /^\/posts\/[a-zA-Z0-9_-]+-(activity|ugcPost)-([1-9]\d*)-[a-zA-Z0-9_-]+\/?$/.exec(url.pathname);
    if (match) return { platform: "linkedin", id: match[1] === "activity" ? match[2] : `ugcPost:${match[2]}`,
      url: `https://www.linkedin.com/feed/update/urn:li:${match[1]}:${match[2]}/` };
  }
  return null;
};

export const socialPlatform = (pageUrl: string): ClipPlatform | null => {
  let url: URL;
  try { url = new URL(pageUrl); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (["www.facebook.com", "facebook.com", "m.facebook.com"].includes(url.hostname)) return "facebook";
  if (["www.instagram.com", "instagram.com"].includes(url.hostname)) return "instagram";
  if (["www.linkedin.com", "linkedin.com"].includes(url.hostname)) return "linkedin";
  if (["www.threads.com", "threads.com", "www.threads.net", "threads.net"].includes(url.hostname)) return "threads";
  if (url.hostname === "bsky.app") return "bluesky";
  return null;
};

export const platformText = (node: Node | null | undefined) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();
export const markdownText = (value: string) => value.replace(/[\r\n]+/g, " ").replace(/([\\`*_{}[\]<>])/g, "\\$1");
export const markdownUrl = (value: string) => value.replace(/[\\ ()<>]/g, (char) => encodeURIComponent(char).replace("(", "%28").replace(")", "%29"));

export const safePlatformUrl = (value: string, base: string, mailto = false) => {
  if (!value.trim()) return "";
  try {
    const url = new URL(value, base);
    return (url.protocol === "http:" || url.protocol === "https:" || (mailto && url.protocol === "mailto:"))
      && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
};

/** Keep the precision of the page's time; never substitute the capture time. */
export const publishedTime = (node: Element | null): PublishedTime | undefined => {
  if (!node) return undefined;
  const machine = (node.getAttribute("datetime") || node.getAttribute("title") || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(machine)) return { value: machine, precision: "date" };
  // Preserve the source timezone here. Known site-specific conventions are
  // handled by the dedicated reader, never inferred from the device timezone.
  const normalized = machine.replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T").replace(/ (?=[+-]\d{2}:\d{2}$)/, "");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(normalized)) {
    return { value: normalized, precision: "datetime" };
  }
  const value = platformText(node);
  return value ? { value, precision: "relative" } : undefined;
};

export const publishedTimeText = (time: PublishedTime, relativeLabel: string) =>
  time.precision === "relative" ? `${time.value} (${relativeLabel})`
    : time.precision === "datetime" ? clipDateTimeText(time.value) : time.value;

/** Converts a detached copy only. Links and images never keep active protocols. */
export const platformHtmlMarkdown = (body: Element | DocumentFragment, baseUrl: string): string => {
  const copy = body.cloneNode(true) as Element | DocumentFragment;
  Array.from(copy.querySelectorAll("script, style, noscript, template, iframe, object, embed, canvas, svg, video, audio, source, link, meta, form, input, button, textarea, select, [hidden], [aria-hidden='true']"))
    .forEach((node) => node.remove());
  for (const node of Array.from(copy.querySelectorAll("*"))) {
    for (const attribute of Array.from(node.attributes)) {
      if (/^on/i.test(attribute.name) || attribute.name === "style") node.removeAttribute(attribute.name);
    }
  }
  for (const link of Array.from(copy.querySelectorAll("a"))) {
    const url = safePlatformUrl(link.getAttribute("href") || "", baseUrl, true);
    if (url) link.setAttribute("href", markdownUrl(url));
    else link.removeAttribute("href");
  }
  for (const img of Array.from(copy.querySelectorAll("img"))) {
    const url = ["data-original", "data-src", "src"].map((name) => safePlatformUrl(img.getAttribute(name) || "", baseUrl)).find(Boolean);
    if (url) img.setAttribute("src", markdownUrl(url));
    else img.remove();
    img.removeAttribute("srcset");
  }
  const turndown = new TurndownService({ bulletListMarker: "-", codeBlockStyle: "fenced", headingStyle: "atx", linkStyle: "inlined" });
  turndown.addRule("platformCode", {
    filter: "pre",
    replacement: (_content, node) => {
      const element = node as HTMLElement;
      const code = element.querySelector("code");
      const language = /(?:^|\s)(?:language|lang)-([a-zA-Z0-9_+-]+)(?=\s|$)/.exec(`${code?.className ?? ""} ${element.className}`)?.[1] || "";
      const text = (code ?? element).textContent?.replace(/\n$/, "") || "";
      const fence = "`".repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((match) => match[0].length + 1)));
      return `\n\n${fence}${language}\n${text}\n${fence}\n\n`;
    },
  });
  return turndown.turndown(copy as HTMLElement).trim();
};

export const isPlatformClip = (value: unknown, expected: PlatformTarget): value is PlatformClip => {
  if (!value || typeof value !== "object") return false;
  const clip = value as Partial<PlatformClip>;
  const time = clip.publishedAt;
  return clip.platform === expected.platform && clip.id === expected.id && clip.url === expected.url
    && typeof clip.title === "string" && !!clip.title.trim() && clip.title.length <= 10_000
    && typeof clip.markdown === "string" && !!clip.markdown.trim() && clip.markdown.length <= 2_000_000
    && (clip.author === undefined || typeof clip.author === "string")
    && (!time || (typeof time.value === "string" && ["datetime", "date", "relative"].includes(time.precision)))
    && Array.isArray(clip.tags) && clip.tags.length === 2 && clip.tags[0] === "web-clip" && clip.tags[1] === expected.platform
    && (clip.completeness === "complete" || (clip.platform === "xiaoyuzhou" && clip.completeness === "no-shownotes"));
};
