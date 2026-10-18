import { platformHtmlMarkdown, platformReadableCopy, platformElementHidden, platformTarget, platformText, safePlatformUrl, socialPlatform, type PlatformRead, type PlatformTarget } from "./platform-clip";

import { socialBodyMarkdown } from "./social-clip";

type JikePicture = { picUrl?: unknown; middlePicUrl?: unknown; thumbnailUrl?: unknown };
type JikePost = { id?: unknown; content?: unknown; createdAt?: unknown; pictures?: JikePicture[]; user?: { username?: unknown } };
const WEB_DETAIL_CARD = '[data-clickable-feedback][class*="_postCard_"]';
const WEB_BODY = '[class*="_contentWrapper_"]';

export const JIKE_CARD_SELECTOR = ".post-list .post-item-li";
export const JIKE_WEB_CARD_SELECTOR = '[data-clickable-feedback]';
export const isJikeWebCard = (card: Element): boolean => {
  const header = card.querySelector("header"), body = card.querySelector(WEB_BODY);
  return card.matches(JIKE_WEB_CARD_SELECTOR) && !!header && !!body && !body.contains(header) && header.closest(JIKE_WEB_CARD_SELECTOR) === card && body.closest(JIKE_WEB_CARD_SELECTOR) === card;
};

/** The Web site redirects signed-out post/feed requests to this login URL. */
export const jikeLoginPost = (pageUrl: string): boolean => {
  try {
    const url=new URL(pageUrl);
    if (url.origin !== "https://web.okjike.com" || url.pathname !== "/login" || url.searchParams.getAll("redirectURL").length !== 1) return false;
    const redirect=new URL(url.searchParams.get("redirectURL")!,url.origin);
    return redirect.origin === url.origin && (platformTarget(redirect.href)?.platform === "jike" || socialPlatform(redirect.href) === "jike");
  } catch {return false;}
};
const pageData = (doc: Document): { post?: JikePost; posts?: JikePost[]; id?: string } => {
  try {
    const state=JSON.parse(doc.querySelector("#__NEXT_DATA__")?.textContent || "");
    return {post:state.props?.pageProps?.post,posts:state.props?.pageProps?.posts,id:state.query?.id};
  } catch {return {};}
};
const bodyInCard = (card: Element) => Array.from(card.querySelectorAll(".text,.image-item,.is-article"))
  .map(node=>node.parentElement).find(Boolean) || null;
const comparisonText = (body: Element, base: string) => {
  const comparison=body.cloneNode(true) as Element;
  for (const n of Array.from(comparison.querySelectorAll('button,[role="button"]'))) n.remove();
  for (const mention of Array.from(comparison.querySelectorAll('[class*="_mentionUser_"]'))) mention.textContent = `@${platformText(mention)}`;
  // Share pages shorten URL labels to hostnames. Mentions remain source text.
  for (const link of Array.from(comparison.querySelectorAll("a[href]"))) {
    const href=safePlatformUrl(link.getAttribute("href") || "",base);
    if (href && platformText(link) === new URL(href).hostname) link.textContent=href;
  }
  for (const n of Array.from(comparison.querySelectorAll("br"))) n.replaceWith(comparison.ownerDocument.createTextNode("\n"));
  return comparison.textContent || "";
};
const normalizedText = (value: string, base: string) => value.replace(/https?:\/\/\S+/g,href=>{
  const own=platformTarget(href);
  return own?.platform === "jike" ? own.url : safePlatformUrl(href,base) || href;
}).replace(/\s+/g,"");
const pictureUrls = (picture: JikePicture | undefined, base: string) => picture ? [picture.picUrl,picture.middlePicUrl,picture.thumbnailUrl]
  .filter((value): value is string=>typeof value === "string").map(value=>safePlatformUrl(value,base)).filter(Boolean) : [];
const webImageIdentity = (src: string) => {
  const url=new URL(src);
  if (url.origin === "https://cdnv2.ruguoapp.com" && url.search.startsWith("?imageMogr2/") && !url.search.includes("&")) url.search="";
  return url.href;
};
const removeJikeControls = (body: Element, images: Element[]) => {
  body.querySelectorAll('button,[role="button"],audio').forEach(node=>{
    if (images.includes(node)) node.removeAttribute("role");
    else if (node.tagName.toLowerCase() !== "audio" && images.some(image=>node.contains(image))) node.replaceWith(...Array.from(node.childNodes));
    else node.remove();
  });
};

/** H5 topic cards have no post link. Bind public data by own author and text,
 * never by array position, a mentioned post, or another card's permalink. */
export const jikeCardTarget = (card: Element, pageUrl: string): PlatformTarget | null => {
  if (!card.matches(JIKE_CARD_SELECTOR) || socialPlatform(pageUrl) !== "jike") return null;
  const clean=platformReadableCopy(card), body=clean.querySelector(".text");
  const avatar=clean.querySelector('a.avatar[href]');
  const profile=safePlatformUrl(avatar?.getAttribute("href") || "",pageUrl);
  if (!profile || new URL(profile).protocol !== "https:" || !["m.okjike.com","web.okjike.com"].includes(new URL(profile).hostname)) return null;
  const username=profile && /^\/users\/([^/]+)\/?$/.exec(new URL(profile).pathname)?.[1].toLowerCase();
  if (!username) return null;
  const content=body ? normalizedText(comparisonText(body,pageUrl),pageUrl) : "";
  const images=Array.from(clean.querySelectorAll(".image-item img")).map(img=>safePlatformUrl(img.getAttribute("src") || "",pageUrl));
  const expand=!!jikeExpandButton(card.ownerDocument,card);
  const posts=pageData(card.ownerDocument).posts;
  const matches=Array.isArray(posts) ? posts.filter(post=>{
    if (typeof post.user?.username !== "string" || post.user.username.toLowerCase() !== username || typeof post.content !== "string") return false;
    const full=normalizedText(post.content,pageUrl);
    if (full !== content && !(expand && content && full.startsWith(content.replace(/[.…]+$/,"")))) return false;
    const pictures=Array.isArray(post.pictures) ? post.pictures : [];
    return images.length === pictures.length && images.every((image,index)=>image && pictureUrls(pictures[index],pageUrl).includes(image));
  }) : [];
  return matches.length === 1 && typeof matches[0].id === "string" ? platformTarget(`https://m.okjike.com/originalPosts/${matches[0].id}`) : null;
};
export const jikePostCard = (doc: Document, target: PlatformTarget, pageUrl: string): Element | null => {
  const detail=platformTarget(pageUrl);
  if (detail?.platform === "jike" && detail.id === target.id) {
    const share = doc.querySelector(".post-page .post-wrap");
    if (share) return share;
    const url = new URL(pageUrl);
    const profilePath = /^(\/u\/[^/]+)\/post\/[a-f0-9]{24}\/?$/.exec(url.pathname)?.[1];
    if (url.hostname !== "web.okjike.com" || !profilePath) return null;
    const cards = Array.from(doc.querySelectorAll(WEB_DETAIL_CARD)).filter(card => !platformElementHidden(card)
      && Array.from(card.querySelector("header")?.querySelectorAll("a[href]") || []).some(link =>
        !platformElementHidden(link) && safePlatformUrl(link.getAttribute("href") || "", pageUrl) === `${url.origin}${profilePath}`));
    return cards.length === 1 ? cards[0] : null;
  }
  const web = Array.from(doc.querySelectorAll(`[data-edgeever-jike-id="${target.id}"]`)).filter(card => isJikeWebCard(card) && !platformElementHidden(card));
  if (web.length) return web.length === 1 ? web[0] : null;
  return Array.from(doc.querySelectorAll(JIKE_CARD_SELECTOR)).find(card=>jikeCardTarget(card,pageUrl)?.id === target.id) || null;
};

/** Signed-in Web detail: bind the single visible post card to its route owner. */
const readWebDetail = (doc: Document, card: Element, target: PlatformTarget, post?: JikePost): PlatformRead => {
  const body = card.querySelector(WEB_BODY);
  if (!body) return {ok:false,reason:"unreadable"};
  if (jikeExpandButton(doc, card)) return {ok:false,reason:"incomplete"};
  const clean = platformReadableCopy(body);
  const ownText = (root: Element) => Array.from(root.querySelectorAll('[class^="_content_"]'))
    .find(node => !node.closest("a"));
  if (platformText(ownText(body) || null) && !platformText(ownText(clean) || null)) return {ok:false,reason:"unreadable"};
  // Inline mentions contain avatars; they are not post attachments.
  clean.querySelectorAll('[class*="_mentionUser_"] img, [class*="_expandButton_"]').forEach(node => node.remove());
  removeJikeControls(clean,Array.from(clean.querySelectorAll("img")));
  // Web's gallery viewer uses the same CDN path without its thumbnail transform.
  for (const image of Array.from(clean.querySelectorAll('img[data-anonymous-gallery="true"]'))) {
    const src = safePlatformUrl(image.getAttribute("src") || "", target.url);
    if (!src) continue;
    const original=webImageIdentity(src);
    if (original !== src) image.setAttribute("data-original",original);
  }
  for (const link of Array.from(clean.querySelectorAll("a[href]"))) {
    const href=safePlatformUrl(link.getAttribute("href") || "", "https://web.okjike.com/");
    const own = platformTarget(href);
    if (href) link.setAttribute("href", own?.platform === "jike" ? own.url : href);
  }
  const text = platformText(ownText(clean) || null);
  if (!text && !clean.querySelector("img")) return {ok:false,reason:"unreadable"};
  if (post) {
    const content = ownText(clean);
    if (!content || typeof post.content !== "string" || normalizedText(comparisonText(content,target.url),target.url) !== normalizedText(post.content,target.url)) return {ok:false,reason:"incomplete"};
    const images = Array.from(clean.querySelectorAll('img[data-anonymous-gallery="true"]'));
    if (!Array.isArray(post.pictures) || images.length !== post.pictures.length) return {ok:false,reason:"incomplete"};
    for (const [index,image] of images.entries()) {
      const shown=safePlatformUrl(image.getAttribute("data-original") || image.getAttribute("src") || "",target.url),picture=post.pictures[index];
      if (!shown || !pictureUrls(picture,target.url).some(url=>webImageIdentity(url)===webImageIdentity(shown))) return {ok:false,reason:"incomplete"};
      const original=typeof picture.picUrl === "string" ? safePlatformUrl(picture.picUrl,target.url) : "";
      if (original) image.setAttribute("data-original",original);
    }
  }
  const liveHeader = card.querySelector("header");
  const header = liveHeader ? platformReadableCopy(liveHeader) : null;
  const author = Array.from(header?.querySelectorAll("a[href]") || []).map(link => platformText(link)).find(Boolean);
  const time = platformText(header?.querySelector('[class*="_descContainer_"]') || null);
  if (post && !Array.from(header?.querySelectorAll('a[href]') || []).some(link => {
    const url=safePlatformUrl(link.getAttribute("href") || "","https://web.okjike.com/");
    return url && new URL(url).origin === "https://web.okjike.com" && new URL(url).pathname.replace(/\/$/,"").toLowerCase() === `/u/${String(post.user?.username).toLowerCase()}`;
  })) return {ok:false,reason:"changed"};
  const date = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(time);
  // Keep mention markers until the completeness comparison above. Their
  // layout divs must then become inline labels to form valid Markdown links.
  for (const link of Array.from(clean.querySelectorAll("a[href]"))) {
    if (link.querySelector("div") && !link.querySelector("img")) link.textContent = platformText(link);
  }
  const markdown = socialBodyMarkdown(doc, clean, target.url);
  if (!markdown) return {ok:false,reason:"unreadable"};
  return {ok:true,clip:{...target,title:text.slice(0,120) || author || "Jike",author,
    publishedAt:date ? {value:`${date[1]}-${date[2]}-${date[3]}`,precision:"date"} : time ? {value:time,precision:"relative"} : undefined,
    markdown,tags:["web-clip","jike"],completeness:"complete"}};
};

/** Public share-page/card reader. It never fetches authenticated Jike APIs. */
export const readJike = (doc: Document, pageUrl: string, target: PlatformTarget | null = platformTarget(pageUrl), currentState?: unknown): PlatformRead => {
  if (target?.platform !== "jike") return {ok:false,reason:"not-target"};
  const card=jikePostCard(doc,target,pageUrl);
  if (!platformTarget(pageUrl) && card && isJikeWebCard(card)) {
    const state=currentState as {pageUrl?: unknown;post?: JikePost} | undefined;
    if (state?.pageUrl !== pageUrl || state.post?.id !== target.id) return {ok:false,reason:"changed"};
    return readWebDetail(doc,card,target,state.post);
  }
  if (card?.matches(WEB_DETAIL_CARD)) return readWebDetail(doc,card,target);
  const body=card && bodyInCard(card);
  if (!card || !body) return {ok:false,reason:"unreadable"};
  const state=pageData(doc), detail=platformTarget(pageUrl)?.platform === "jike";
  const post=detail ? state.post : state.posts?.find(post=>post.id === target.id);
  if (detail && ((post?.id && post.id !== target.id) || (state.id && state.id !== target.id))) return {ok:false,reason:"changed"};
  const clean=platformReadableCopy(body), text=clean.matches(".text") ? clean : clean.querySelector(".text");
  if (jikeExpandButton(doc,card)) return {ok:false,reason:"incomplete"};
  if (typeof post?.content === "string" && !text && post.content.trim()) return {ok:false,reason:"incomplete"};
  if (typeof post?.content === "string" && text && normalizedText(post.content,target.url) !== normalizedText(comparisonText(text,target.url),target.url)) return {ok:false,reason:"incomplete"};
  const pictures=Array.isArray(post?.pictures) ? post.pictures : undefined;
  if (pictures && !pictures.every(p=>pictureUrls(p,target.url).length)) return {ok:false,reason:"incomplete"};
  const images=Array.from(clean.querySelectorAll(".image-item img"));
  if (pictures && images.length !== pictures.length) return {ok:false,reason:"incomplete"};
  for (const [index,image] of images.entries()) {
    const shown=safePlatformUrl(image.getAttribute("src") || "",target.url),picture=pictures?.[index];
    if (picture && !pictureUrls(picture,target.url).includes(shown)) return {ok:false,reason:"incomplete"};
    const original=typeof picture?.picUrl === "string" ? safePlatformUrl(picture.picUrl,target.url) : "";
    if (original) image.setAttribute("data-original",original);
  }
  // Preserve the audio/link preview text and cover, excluding player controls.
  removeJikeControls(clean,images);
  for (const link of Array.from(clean.querySelectorAll("a[href]"))) {
    const own=platformTarget(safePlatformUrl(link.getAttribute("href") || "",target.url));
    if (own?.platform === "jike") link.setAttribute("href",own.url);
  }
  const readableCard=platformReadableCopy(card);
  const author=platformText(readableCard.querySelector(".info .title")),time=platformText(readableCard.querySelector(".info .subtitle"));
  const markdown=platformHtmlMarkdown(clean,target.url);
  if (!markdown) return {ok:false,reason:"unreadable"};
  const title=platformText(text).slice(0,120) || author || "Jike";
  const created=typeof post?.createdAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(post.createdAt) ? post.createdAt : "";
  return {ok:true,clip:{...target,title,author:author || undefined,publishedAt:created ? {value:created,precision:"datetime"} : time ? {value:time,precision:"relative"} : undefined,markdown,tags:["web-clip","jike"],completeness:"complete"}};
};
export const jikeExpandButton = (doc: Document, card: Element | null = doc.querySelector(".post-page .post-wrap")): HTMLElement | null => Array.from(card?.querySelectorAll<HTMLElement>('.text button,.text [role="button"], [class*="_contentWrapper_"] button, [class*="_contentWrapper_"] [role="button"], [class*="_contentWrapper_"] [class*="_expandButton_"]') || [])
  .find(n=>/^(展开|展开全文|展开全部|显示全文|查看更多)$/.test(platformText(platformReadableCopy(n)))) || null;
