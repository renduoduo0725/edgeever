import { platformTarget, socialPlatform } from "./platform-clip";
import { ownPostLinks, metaPostCard, linkedinCardTarget, LINKEDIN_CARD_SELECTOR } from "./social-clip";

// Only remembers the card under the pointer. No network or automatic capture.
(() => {
  const root = globalThis as typeof globalThis & { __edgeeverSocialTarget?: boolean };
  if (root.__edgeeverSocialTarget) return;
  root.__edgeeverSocialTarget = true;
  document.addEventListener("contextmenu", (event) => {
    for (const node of document.querySelectorAll("[data-edgeever-social-target]")) node.removeAttribute("data-edgeever-social-target");
    const element = event.target instanceof Element ? event.target : event.target instanceof Node ? event.target.parentElement : null;
    if (!element) return;
    const platform = socialPlatform(location.href);
    const selector = platform === "facebook" ? '[role="article"], article'
      : platform === "bluesky" ? '[data-testid^="postThreadItem-by-"], [data-testid^="feedItem-by-"]'
      : platform === "linkedin" ? LINKEDIN_CARD_SELECTOR
      : platform === "instagram" ? "article" : "";
    const card = selector ? element.closest(selector) : null;
    const mark = (node: Element) => {
      if (platform === "linkedin") {
        const target = linkedinCardTarget(node);
        if (target) { node.setAttribute("data-edgeever-social-target", target.url); return true; }
        return false;
      }
      for (const link of ownPostLinks(node,platform || '')) {
        if (selector && node.matches(selector) && link.closest(selector) !== node) continue;
        if ((platform === "instagram" || platform === "threads") && !link.querySelector("time[datetime]")) continue;
        const href=(link.getAttribute("href") || "").trim();
        if (!href.startsWith("/") && !href.startsWith("https://")) continue;
        let url: URL;
        try { url = new URL(href,location.href); } catch { continue; }
        if (platform === "facebook" && url.searchParams.has("comment_id")) continue;
        const target = platformTarget(url.href);
        if (target?.platform === platform) { node.setAttribute("data-edgeever-social-target",target.url); return true; }
      }
      return false;
    };
    if (card) { mark(card); return; }
    if (platform === "threads" || platform === "instagram") {
      for (const link of Array.from(document.querySelectorAll('a[href]'))) {
        const candidate=metaPostCard(link,platform,location.href);
        if (candidate?.contains(element) && mark(candidate)) break;
      }
    }
  },true);
})();
