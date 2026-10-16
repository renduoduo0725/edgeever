import { articlePublishedTime } from "./article-clip";
import { markdownText, markdownUrl, platformElementHidden, platformHtmlMarkdown, platformReadableCopy, platformTarget, platformText, safePlatformUrl, type PlatformRead, type PlatformTarget } from "./platform-clip";

const text = (node: Element | null) => node ? platformText(platformReadableCopy(node)) : "";

/** Douban renders review text with white-space: pre-wrap. */
const restoreReviewParagraphs = (body: Element) => {
  const doc=body.ownerDocument;
  const split=(node: Node): Node[] => {
    if(node.nodeType === 3) return (node.textContent || "").split(/\r?\n[\t ]*\r?\n(?:[\t ]*\r?\n)*/).map(text=>{
      const fragment=doc.createDocumentFragment();
      text.split(/\r?\n/).forEach((line,index)=>{
        if(index) fragment.appendChild(doc.createElement("br"));
        fragment.appendChild(doc.createTextNode(line));
      });
      return fragment;
    });
    if(node.nodeType !== 1 || /^(PRE|CODE)$/.test((node as Element).tagName)) return [node.cloneNode(true)];
    const groups: Node[][]=[[]];
    for(const child of Array.from(node.childNodes)) {
      const parts=split(child);
      groups[groups.length-1].push(parts[0]);
      for(const part of parts.slice(1)) groups.push([part]);
    }
    return groups.map(children=>{
      const copy=node.cloneNode(false);
      children.forEach(child=>copy.appendChild(child));
      return copy;
    });
  };
  for(const paragraph of Array.from(body.querySelectorAll("p"))) {
    if(paragraph.closest("pre,code") || !/\r?\n/.test(paragraph.textContent || "")) continue;
    for(const part of split(paragraph)) paragraph.parentNode!.insertBefore(part,paragraph);
    paragraph.remove();
  }
};

/** Use the short comment's own time link, never a link from its body. */
export const doubanCommentTarget = (card: Element, pageUrl: string): PlatformTarget | null => {
  const link=card.querySelector(".comment-info .comment-time[href]");
  const id=card.getAttribute("data-cid");
  let source: URL; try {source=new URL(pageUrl);} catch {return null;}
  if (!id || !/^[1-9]\d*$/.test(id) || !["book.douban.com","movie.douban.com","music.douban.com"].includes(source.hostname)) return null;
  const target=platformTarget(`https://${source.hostname}/comment/${id}/`);
  const own=link ? platformTarget(safePlatformUrl(link.getAttribute("href") || "",pageUrl)) : null;
  return own && own.url !== target?.url ? null : target;
};

export const readDouban = (doc: Document, target: PlatformTarget, sourceUrl: string, listLabel="Douban"): PlatformRead => {
  if (target.platform !== "douban") return {ok:false,reason:"not-target"};
  const source=platformTarget(sourceUrl), parts=target.id.split("/");
  if (parts[1] !== "comment" && source?.url !== target.url) return {ok:false,reason:"changed"};
  const declared=doc.querySelector('meta[property="og:url"]')?.getAttribute("content");
  if (declared && parts[1] !== "comment" && platformTarget(safePlatformUrl(declared,target.url))?.url !== target.url) return {ok:false,reason:"changed"};
  let body: Element | null, author: Element | null, time: Element | null, subject: Element | null, rating: Element | null;
  let title=text(doc.querySelector("#content h1"));
  if (parts[1] === "review") {
    body=doc.querySelector(`#review-${parts[2]}-content .review-content`);
    author=doc.querySelector('.main-hd > a[href*="/people/"]');
    const header=doc.querySelector(".main-hd");
    time=header?.querySelector(".main-meta span[content],.main-meta time") || null;
    if (/已编辑/.test(text(header?.querySelector(".main-meta") || null))) time=null;
    subject=header?.querySelector('a[href*="/subject/"]') || null;
    rating=header?.querySelector(".main-title-rating[title]") || null;
  } else if (parts[1] === "comment") {
    const card=doc.querySelector(`.comment-item[data-cid="${parts[2]}"]`);
    if (!card || doubanCommentTarget(card,sourceUrl)?.url !== target.url) return {ok:false,reason:"unreadable"};
    // Lists need an explicitly chosen own card. Never archive every short
    // comment as one post, and never read an unrelated page with a copied card.
    if (source?.url !== target.url) {
      let page: URL; try {page=new URL(sourceUrl);} catch {return {ok:false,reason:"not-target"};}
      if (page.hostname !== new URL(target.url).hostname || !/^\/subject\/[1-9]\d*\/comments\/?$/.test(page.pathname)) return {ok:false,reason:"not-target"};
    }
    body=card.querySelector(".comment-content"); author=card.querySelector('.comment-info a[href*="/people/"]');
    time=card.querySelector(".comment-time"); subject=doc.querySelector('h1 a[href*="/subject/"],.subject-title a[href]');
    rating=card.querySelector(".rating[title]");
    title=[text(subject) || title.replace(/\s*短评$/, ""),text(author)].filter(Boolean).join(" · ") || title;
  } else {
    body=doc.querySelector(`#link-report .note`);
    author=doc.querySelector('.note-header a.note-author[href*="/people/"]');
    time=doc.querySelector(".note-header .pub-date,.note-header .pubtime");
    subject=null; rating=null;
  }
  if (!body) return {ok:false,reason:"unreadable"};
  const clean=platformReadableCopy(body);
  if(parts[1] === "review") restoreReviewParagraphs(clean);
  const markdown=platformHtmlMarkdown(clean,target.url);
  if (!markdown || !title) return {ok:false,reason:"unreadable"};
  const subjectName=text(subject), subjectUrl=subject ? safePlatformUrl(subject.getAttribute("href") || "",sourceUrl) : "";
  const ratingText=rating && !platformElementHidden(rating) ? rating.getAttribute("title")?.trim() : "";
  const metadata=[subjectName && subjectUrl ? `[${markdownText(subjectName)}](${markdownUrl(subjectUrl)})` : "",ratingText ? markdownText(ratingText) : ""].filter(Boolean).join(" · ");
  let list="";
  if (parts[1] === "comment" && source?.url !== target.url) {
    const url=new URL(sourceUrl); url.searchParams.delete("_i");url.searchParams.delete("_spm_id");
    const card=doc.querySelector(`.comment-item[data-cid="${parts[2]}"]`);
    url.hash=card?.id || card?.querySelector(`[id="c-${parts[2]}"]`)?.id || "";
    const safe=safePlatformUrl(url.href,target.url);
    if (safe) list=`${markdownText(listLabel)}: [${markdownText(safe)}](${markdownUrl(safe)})`;
  }
  return {ok:true,clip:{...target,title,author:text(author) || undefined,publishedAt:articlePublishedTime(time),markdown:[metadata,list,markdown].filter(Boolean).join("\n\n"),tags:["web-clip","douban"],completeness:"complete"}};
};
