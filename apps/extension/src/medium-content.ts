import { articlePlatform } from "./article-platform";
import { articleMetadata, type ArticleContent } from "./article-metadata";
import { platformReadableCopy, platformText } from "./platform-clip";
/** Extract only rendered Medium story blocks; never fetch paywalled content. */
export const mediumContent = (doc: Document, pageUrl: string): ArticleContent | null => {
  if (articlePlatform(doc,pageUrl) !== "Medium") return null;
  const liveArticle = doc.querySelector('article');
  const article = liveArticle ? platformReadableCopy(liveArticle) : null;
  const title = article?.querySelector('h1[data-selectable-paragraph]');
  if (!article || !title?.textContent?.trim()) return null;
  const body = doc.createElement('div');
  const chosen = new Set<Element>();
  for (const block of Array.from(article.querySelectorAll('[data-selectable-paragraph], figure, pre, table'))) {
    if (block === title || block.closest('[hidden], [aria-hidden="true"]')) continue;
    const container = block.closest('figure, pre, ul, ol, blockquote, table');
    const source = container && article.contains(container) ? container : block;
    if (chosen.has(source) || Array.from(chosen).some((parent)=>parent.contains(source))) continue;
    chosen.add(source);
    const copy = source.cloneNode(true) as Element;
    copy.querySelectorAll('script, style, button, svg, source, [hidden], [aria-hidden="true"], .speechify-ignore').forEach((node)=>node.remove());
    // Keep the loaded image and caption, excluding Medium's image-viewer prompt.
    copy.querySelectorAll('figure [role="button"] > span, [role="button"] > span').forEach((node)=>node.remove());
    body.appendChild(copy);
  }
  const name=platformText(title);
  return body.textContent?.trim() || body.querySelector('img') ? {title:name,body,...articleMetadata(doc,pageUrl,name,article!)} : null;
};
