import { platformHtmlCopy, platformHtmlMarkdown, platformReadableCopy, platformTarget, platformText, publishedTime, safePlatformUrl, type PlatformRead, type PlatformTarget } from "./platform-clip";

export const XUEQIU_CARD_SELECTOR = '.article__container, [class*="timeline__item__main_"]';
const headerSelector = '.article__author, [class*="timeline__item__info_"]';
const ownHeader = (card: Element) => {
  const header = card.querySelector(headerSelector);
  return header?.closest(XUEQIU_CARD_SELECTOR) === card ? header : null;
};
const headerTargets = (card: Element): PlatformTarget[] => {
  const header = ownHeader(card);
  if (!header) return [];
  const targets = new Map<string, PlatformTarget>();
  for (const link of Array.from(header.querySelectorAll('a.time[href], a[class*="date-and-source_"][href]'))) {
    if (!platformText(platformReadableCopy(link))) continue;
    const target = platformTarget(safePlatformUrl(link.getAttribute("href") || "", "https://xueqiu.com/"));
    if (target?.platform === "xueqiu") targets.set(target.url, target);
  }
  return [...targets.values()];
};
const profileOwner = (header: Element | null): string | undefined => {
  const author = header?.querySelector('a.name[href], a[class*="user-name_"][href]');
  if (!author || !platformText(platformReadableCopy(author))) return;
  const href = safePlatformUrl(author.getAttribute("href") || "", "https://xueqiu.com/");
  if (!href) return;
  const url = new URL(href);
  return ["xueqiu.com", "www.xueqiu.com"].includes(url.hostname) ? /^\/([1-9]\d*)\/?$/.exec(url.pathname)?.[1] : undefined;
};

/** Feed targeting requires an own permalink, never a link from post text. */
export const xueqiuCardTarget = (card: Element): PlatformTarget | null => {
  const targets = headerTargets(card);
  if (targets.length !== 1) return null;
  const target = targets[0], owner = profileOwner(ownHeader(card));
  return owner && owner !== target.id.split("/")[0] ? null : target;
};

const xueqiuStocks = (body: Element, base: string): string[] => {
  const symbols = new Set<string>();
  for (const link of Array.from(body.querySelectorAll("a[href]"))) {
    const href = safePlatformUrl(link.getAttribute("href") || "", base);
    if (!href) continue;
    const url = new URL(href);
    const symbol = /^\/S\/([A-Z][A-Z0-9.-]*|\d{5})\/?$/.exec(url.pathname)?.[1];
    if (symbol && ["xueqiu.com", "www.xueqiu.com"].includes(url.hostname)) symbols.add(symbol);
  }
  // The instance persists at most 24 tags, including the three fixed tags.
  return [...symbols].slice(0, 21);
};

export const readXueqiu = (doc: Document, target: PlatformTarget, sourceUrl: string): PlatformRead => {
  if (target.platform !== "xueqiu") return { ok: false, reason: "not-target" };
  const source = platformTarget(sourceUrl);
  // The sampled home/profile cards are truncated descriptions. Source-page
  // identity, rather than optional metadata, binds a detail read to this post.
  if (!source) return { ok: false, reason: "not-target" };
  if (source.url !== target.url) return { ok: false, reason: "changed" };
  const card = doc.querySelector(".article__container");
  if (!card) return { ok: false, reason: "unreadable" };
  const header = ownHeader(card), owner = profileOwner(header);
  if (headerTargets(card).some((known) => known.url !== target.url)
    || (owner && owner !== target.id.split("/")[0])) return { ok: false, reason: "changed" };
  const body = card.querySelector(".article__bd__detail");
  const titleNode = card.querySelector(".article__bd__title");
  const author = header?.querySelector(".name");
  const timeLink = header?.querySelector("a.time");
  if (!body) return { ok: false, reason: "unreadable" };
  // Stock tags and Markdown must consume the same sanitized body: controls,
  // scripts and hidden references cannot contribute tags after being removed.
  const clean = platformHtmlCopy(platformReadableCopy(body), target.url) as Element;
  const markdown = platformHtmlMarkdown(clean, target.url);
  const title = (titleNode ? platformText(platformReadableCopy(titleNode)) : "") || platformText(clean).slice(0, 120);
  if (!markdown || !title) return { ok: false, reason: "unreadable" };
  const cleanTime = timeLink ? platformReadableCopy(timeLink) : null;
  const published = cleanTime && platformText(cleanTime).startsWith("发布于") ? publishedTime(cleanTime.querySelector("time")) : undefined;
  return { ok: true, clip: { ...target, title, author: author ? platformText(platformReadableCopy(author)) || undefined : undefined, publishedAt: published,
    markdown, tags: ["web-clip", "xueqiu", "投资", ...xueqiuStocks(clean, target.url)], completeness: "complete" } };
};
