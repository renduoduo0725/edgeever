import { articlePlatform } from "./article-platform";
/** Read the displayed newsletter article, excluding subscription and sharing UI. */
export const substackContent = (doc: Document, pageUrl: string): { title: string; body: Element } | null => {
  if (articlePlatform(doc,pageUrl) !== "Substack") return null;
  const article = doc.querySelector('article.newsletter-post');
  const title = article?.querySelector('h1.post-title');
  const content = article?.querySelector('.body.markup');
  if (!title?.textContent?.trim() || !content || content.closest('[hidden], [aria-hidden="true"]')) return null;
  const body = content.cloneNode(true) as Element;
  body.querySelectorAll('.subscribe-widget, .button-wrapper, .header-anchor-parent, .image-link-expand, script, style, svg, button, form, input, iframe, video, audio, source, [hidden], [aria-hidden="true"]').forEach((node)=>node.remove());
  const subtitle = article?.querySelector('.subtitle');
  if (subtitle?.textContent?.trim() && !subtitle.closest('[hidden], [aria-hidden="true"]')) {
    const paragraph = doc.createElement('p');
    paragraph.textContent = subtitle.textContent.trim();
    body.insertBefore(paragraph,body.firstChild);
  }
  return body.textContent?.trim() || body.querySelector('img[src]') ? {title:title.textContent.trim(),body} : null;
};
