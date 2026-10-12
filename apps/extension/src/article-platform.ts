/** Shared article identity; safe to serialize with scripting.executeScript. */
export const articlePlatform = (doc: Document = document, pageUrl: string = location.href): "Medium" | "Substack" | null => {
  let url: URL;
  try { url = new URL(pageUrl); } catch { return null; }
  if (url.protocol !== "https:") return null;
  if ((url.hostname === "medium.com" || url.hostname.endsWith(".medium.com") || doc.querySelector('meta[property="og:site_name"][content="Medium"]'))
    && doc.querySelector('article h1[data-selectable-paragraph]')?.textContent?.trim()) return "Medium";
  if (/^\/p\/[^/]+\/?$/.test(url.pathname)
    && (url.hostname === "substack.com" || url.hostname.endsWith(".substack.com") || doc.querySelector('link[rel="stylesheet"][href^="https://substackcdn.com/bundle/"]'))
    && doc.querySelector('article.newsletter-post h1.post-title')?.textContent?.trim()
    && doc.querySelector('article.newsletter-post .body.markup')) return "Substack";
  return null;
};
