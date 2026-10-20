import { articlePlatform, substackPaywall } from "./article-platform";
import { articleMetadata, type ArticleContent } from "./article-metadata";
import { platformReadableCopy, platformText } from "./platform-clip";
/** Read the displayed newsletter article, excluding subscription and sharing UI. */
export const substackContent = (doc: Document, pageUrl: string): ArticleContent | null => {
  if (articlePlatform(doc,pageUrl) !== "Substack") return null;
  if (substackPaywall(doc)) return null;
  const liveArticle = doc.querySelector('article.newsletter-post');
  const article = liveArticle ? platformReadableCopy(liveArticle) : null;
  const title = article?.querySelector('h1.post-title');
  const content = article?.querySelector('.body.markup');
  if (!title?.textContent?.trim() || !content || content.closest('[hidden], [aria-hidden="true"]')) return null;
  const body = content.cloneNode(true) as Element;
  body.querySelectorAll('.subscribe-widget, .button-wrapper, .header-anchor-parent, .image-link-expand, script, style, svg, button, form, input, iframe, video, audio, source, [hidden], [aria-hidden="true"]').forEach((node)=>node.remove());
  // Substack wraps zoomable images in links containing block elements. Those
  // blocks split the Markdown link across blank lines, leaving visible syntax.
  for (const link of Array.from(body.querySelectorAll('a.image-link'))) {
    if (!link.querySelector('img') || platformText(link)) continue;
    while (link.firstChild) link.parentNode!.insertBefore(link.firstChild, link);
    link.remove();
  }
  const subtitle = article?.querySelector('.subtitle');
  if (subtitle?.textContent?.trim() && !subtitle.closest('[hidden], [aria-hidden="true"]')) {
    const paragraph = doc.createElement('p');
    paragraph.textContent = subtitle.textContent.trim();
    body.insertBefore(paragraph,body.firstChild);
  }
  const name=platformText(title);
  return body.textContent?.trim() || body.querySelector('img[src]') ? {title:name,body,...articleMetadata(doc,pageUrl,name,article!)} : null;
};
