import { parseMemoLinkHref } from "@edgeever/shared";

/** Recognize the legacy URL agents sometimes invent for a workspace note. */
export function parseAssistantNoteLinkHref(href: unknown): string | null {
  const memoId = parseMemoLinkHref(href);
  if (memoId) return memoId;
  if (typeof href !== "string") return null;

  try {
    const url = new URL(href);
    if (url.origin !== "https://edgeever.ai" || url.search || url.hash) return null;
    return /^\/memo\/(memo_[0-9a-f]{32})\/?$/i.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}
