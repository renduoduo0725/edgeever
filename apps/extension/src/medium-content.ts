import { articlePlatform } from "./article-platform";
import { articleMetadata, type ArticleContent } from "./article-metadata";
import { platformElementHidden, platformReadableCopy, platformText, safePlatformUrl } from "./platform-clip";

// Medium renders highlighted code without a language class. Read only the
// language of a paragraph whose identity and visible code both match; never
// use the state to recover article text that the reader cannot see.
const codeLanguages = (doc: Document) => {
  const languages = new Map<string, { text: string; language: string }>();
  for (const script of Array.from(doc.querySelectorAll('script'))) {
    const source = script.textContent || '';
    if (source.length > 10_000_000 || !source.includes('codeBlockMetadata')) continue;
    const json = /^\s*window\.__APOLLO_STATE__\s*=\s*({[\s\S]*})\s*;?\s*$/.exec(source)?.[1];
    if (!json) continue;
    try {
      for (const value of Object.values(JSON.parse(json))) {
        if (!value || typeof value !== 'object') continue;
        const paragraph = value as Record<string, unknown>;
        const metadata = paragraph.codeBlockMetadata as { lang?: unknown } | null;
        if (paragraph.__typename === 'Paragraph' && paragraph.type === 'PRE'
          && typeof paragraph.name === 'string' && typeof paragraph.text === 'string'
          && typeof metadata?.lang === 'string' && /^[a-zA-Z0-9_+-]+$/.test(metadata.lang)) {
          languages.set(paragraph.name, { text: paragraph.text, language: metadata.lang });
        }
      }
    } catch { /* Page scripts are data only; malformed state is ignored. */ }
  }
  return languages;
};
/** Extract only rendered Medium story blocks; never fetch paywalled content. */
export const mediumContent = (doc: Document, pageUrl: string): ArticleContent | null => {
  if (articlePlatform(doc,pageUrl) !== "Medium") return null;
  const liveArticle = doc.querySelector('article');
  const article = liveArticle ? platformReadableCopy(liveArticle) : null;
  const title = article?.querySelector('h1[data-selectable-paragraph]');
  if (!liveArticle || !article || !title?.textContent?.trim()) return null;
  const liveTitle = Array.from(liveArticle.querySelectorAll('h1[data-selectable-paragraph]'))
    .find(node=>platformText(platformReadableCopy(node)));
  const body = doc.createElement('div');
  const languages = codeLanguages(doc);
  const chosen = new Set<Element>();
  for (const block of Array.from(liveArticle.querySelectorAll('[data-selectable-paragraph], figure, pre, table, a[href]'))) {
    if (block === liveTitle) continue;
    const preview = block.tagName === "A" && !!block.querySelector("h2");
    if (block.tagName === "A" && !preview) continue;
    const container = block.closest('figure, pre, ul, ol, blockquote, table');
    const source = container && liveArticle.contains(container) ? container : block;
    if (chosen.has(source) || Array.from(chosen).some((parent)=>parent.contains(source))) continue;
    chosen.add(source);
    const copy = platformReadableCopy(source);
    for (const pre of copy.tagName === 'PRE' ? [copy] : Array.from(copy.querySelectorAll('pre'))) {
      Array.from(pre.querySelectorAll('br')).forEach(node => node.parentNode?.replaceChild(doc.createTextNode('\n'),node));
      const paragraph = pre.matches('[data-selectable-paragraph][id]') ? pre : pre.querySelector('[data-selectable-paragraph][id]');
      const declared = paragraph && languages.get(paragraph.id);
      if (declared && declared.text === pre.textContent
        && !/(?:^|\s)(?:language|lang)-/.test(pre.className)
        && !pre.querySelector('code[class*="language-"], code[class*="lang-"]')) {
        pre.classList.add(`language-${declared.language}`);
      }
    }
    copy.querySelectorAll('script, style, button, svg, source, [hidden], [aria-hidden="true"], .speechify-ignore').forEach((node)=>node.remove());
    // Keep the loaded image and caption, excluding Medium's image-viewer prompt.
    copy.querySelectorAll('figure [role="button"] > span, [role="button"] > span').forEach((node)=>node.remove());
    if (preview && source === block) {
      // Medium link cards are not selectable paragraphs. Flatten their label
      // into a real Markdown link and retain the rendered CSS thumbnail.
      const card = doc.createElement("p");
      for (const image of Array.from(copy.querySelectorAll("img"))) card.appendChild(image);
      for (const element of Array.from(source.querySelectorAll("*"))) {
        if (platformElementHidden(element)) continue;
        const background = doc.defaultView?.getComputedStyle?.(element).backgroundImage
          || (element as HTMLElement).style.backgroundImage;
        const raw = /^url\(["']?(.*?)["']?\)$/.exec(background || "")?.[1];
        const url = raw && safePlatformUrl(raw,pageUrl);
        if (url) { const image=doc.createElement("img");image.setAttribute("src",url);card.appendChild(image); }
      }
      for (const part of Array.from(copy.querySelectorAll("h2,h3,p"))) part.appendChild(doc.createTextNode(" "));
      const link=doc.createElement("a");link.setAttribute("href",copy.getAttribute("href") || "");link.textContent=platformText(copy);card.appendChild(link);
      body.appendChild(card);
    } else body.appendChild(copy);
  }
  const name=platformText(title);
  return body.textContent?.trim() || body.querySelector('img') ? {title:name,body,...articleMetadata(doc,pageUrl,name,article)} : null;
};
