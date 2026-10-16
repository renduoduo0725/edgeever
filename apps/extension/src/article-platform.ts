/** Shared article identity; safe to serialize with scripting.executeScript. */
export const articlePlatform = (doc: Document = document, pageUrl: string = location.href): "Medium" | "Substack" | null => {
  let url: URL;
  try { url = new URL(pageUrl); } catch { return null; }
  if (url.protocol !== "https:") return null;
  if ((url.hostname === "medium.com" || url.hostname.endsWith(".medium.com") || doc.querySelector('meta[property="og:site_name"][content="Medium"]'))
    && doc.querySelector('article')) return "Medium";
  if (/^\/p\/[^/]+\/?$/.test(url.pathname)
    && (url.hostname === "substack.com" || url.hostname.endsWith(".substack.com") || doc.querySelector('link[rel="stylesheet"][href^="https://substackcdn.com/bundle/"]'))
    && doc.querySelector('article.newsletter-post')) return "Substack";
  return null;
};

/** Real Substack preview gate; closure-free for the popup's DOM probe. */
export const substackPaywall = (doc: Document = document): boolean => Array.from(doc.querySelectorAll('article.newsletter-post .paywall')).some(node=>{
  const walker=doc.createTreeWalker(node,4 /* SHOW_TEXT */);
  for(let text=walker.nextNode();text;text=walker.nextNode()) {
    const parent=text.parentElement;
    if (!parent || !text.textContent?.trim()) continue;
    let visibility=doc.defaultView?.getComputedStyle?.(parent).visibility, hidden=false;
    for(let current: Element | null=parent;current;current=current.parentElement) {
      if(current.matches('[hidden],[aria-hidden="true"],script,style,template')) {hidden=true;break;}
      const style=doc.defaultView?.getComputedStyle?.(current) || (current as HTMLElement).style;
      if(style?.display === "none") {hidden=true;break;}
      if(!visibility && style?.visibility && style.visibility !== "inherit") visibility=style.visibility;
    }
    if(!hidden && visibility !== "hidden" && visibility !== "collapse") return true;
  }
  return false;
});
