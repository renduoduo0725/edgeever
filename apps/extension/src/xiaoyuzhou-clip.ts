import { createDocument } from "@mixmark-io/domino";
import { markdownText, markdownUrl, platformElementHidden, platformHtmlMarkdown, platformReadableCopy, platformTarget, platformText, publishedTime, safePlatformUrl, type PlatformLabels, type PlatformRead } from "./platform-clip";

/** Runs in MAIN because Next's current route props are not in the isolated DOM. */
export function readXiaoyuzhouStateInPage() {
  // Keep this function closure-free: scripting.executeScript serializes it.
  const next = (window as unknown as { next?: { router?: {
    pathname?: string; query?: { id?: unknown };
    components?: Record<string, { props?: { pageProps?: { episode?: { eid?: unknown; title?: unknown; shownotes?: unknown } } } }>;
  } } }).next;
  const router = next?.router;
  if (router?.pathname !== "/episode/[id]") return null;
  const episode = router.components?.["/episode/[id]"]?.props?.pageProps?.episode;
  if (typeof router.query?.id !== "string" || typeof episode?.eid !== "string"
    || typeof episode.title !== "string" || typeof episode.shownotes !== "string" || episode.shownotes.length > 2_000_000) return null;
  return { pageUrl: location.href, queryId: router.query.id, eid: episode.eid, title: episode.title, shownotes: episode.shownotes };
}

export const readXiaoyuzhou = (doc: Document, pageUrl: string, labels: PlatformLabels, currentState?: unknown): PlatformRead => {
  const target = platformTarget(pageUrl);
  if (target?.platform !== "xiaoyuzhou") return { ok: false, reason: "not-target" };
  const header = doc.querySelector("main header");
  const notes = doc.querySelector('section[aria-label="节目show notes"] .sn-content article');
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
  if (!header || !notes) return { ok: false, reason: "unreadable" };
  const cleanHeader = platformReadableCopy(header);
  const title = platformText(cleanHeader.querySelector("h1"));
  if (!title) return { ok: false, reason: "unreadable" };
  if (platformTarget(canonical)?.url !== target.url) return { ok: false, reason: "changed" };

  // The sampled page loads the full article before its visual expansion.
  // Its own episode payload lets us distinguish that from a truncated DOM or
  // an actually empty episode. Never use this payload to bypass visible access.
  let expectedHtml: string;
  try {
    let episode: { eid?: unknown; title?: unknown; shownotes?: unknown } | undefined;
    let queryId: unknown;
    if (currentState) {
      // __NEXT_DATA__ stays on the initial episode after client navigation.
      const state = currentState as { pageUrl?: unknown; queryId?: unknown; eid?: unknown; title?: unknown; shownotes?: unknown };
      if (typeof state.pageUrl !== "string" || platformTarget(state.pageUrl)?.url !== target.url) return { ok: false, reason: "changed" };
      episode = state;
      queryId = state.queryId;
    } else {
      const json = doc.querySelector("#__NEXT_DATA__")?.textContent || "";
      if (!json || json.length > 2_000_000) return { ok: false, reason: "unreadable" };
      const state = JSON.parse(json);
      episode = state?.props?.pageProps?.episode;
      queryId = state?.query?.id;
    }
    if (episode?.eid !== target.id || queryId !== target.id
      || typeof episode?.title !== "string" || episode.title.replace(/\s+/g, " ").trim() !== title) {
      return { ok: false, reason: "changed" };
    }
    if (typeof episode.shownotes !== "string" || episode.shownotes.length > 2_000_000) return { ok: false, reason: "unreadable" };
    expectedHtml = episode.shownotes;
  } catch { return { ok: false, reason: "unreadable" }; }

  // Parse only in Domino's in-memory DOM: validation must not give untrusted
  // markup to a browser HTML sink that could activate scripts or resource loads.
  const expected = createDocument(expectedHtml).body;
  const cleanNotes = platformReadableCopy(notes);
  if (platformElementHidden(notes) && !cleanNotes.hasChildNodes()) return { ok: false, reason: "unreadable" };
  const markdown = platformHtmlMarkdown(cleanNotes, target.url);
  const fullMarkdown = platformHtmlMarkdown(platformReadableCopy(expected), target.url);
  if (markdown !== fullMarkdown) return { ok: false, reason: "incomplete" };
  // Only an explicitly empty field establishes that the episode has no notes.
  if (!markdown && expectedHtml.trim()) return { ok: false, reason: "unreadable" };
  const podcast = cleanHeader.querySelector('.podcast-title a.name[href^="/podcast/"]');
  const podcastName = platformText(podcast);
  const podcastUrl = safePlatformUrl(podcast?.getAttribute("href") || "", target.url);
  const cover = cleanHeader.querySelector("img.avatar");
  const coverUrl = safePlatformUrl(cover?.getAttribute("src") || "", target.url);
  return {
    ok: true,
    clip: {
      ...target, title,
      publishedAt: publishedTime(cleanHeader.querySelector("time")),
      markdown: [
        podcastName && podcastUrl ? `${markdownText(labels.podcast)}: [${markdownText(podcastName)}](${markdownUrl(podcastUrl)})` : "",
        coverUrl ? `![${markdownText(title)}](${markdownUrl(coverUrl)})` : "",
        markdown || markdownText(labels.noShowNotes),
      ].filter(Boolean).join("\n\n"),
      tags: ["web-clip", target.platform], completeness: markdown ? "complete" : "no-shownotes",
    },
  };
};
