import { platformHtmlMarkdown, platformReadableCopy, platformTarget, platformText, safePlatformUrl, socialPlatform, type PlatformRead, type PlatformTarget } from "./platform-clip";

type JikePicture = { picUrl?: unknown; middlePicUrl?: unknown; thumbnailUrl?: unknown };
type JikePost = { id?: unknown; content?: unknown; createdAt?: unknown; pictures?: JikePicture[]; user?: { username?: unknown } };
export const JIKE_CARD_SELECTOR = ".post-list .post-item-li";

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
  if (detail?.platform === "jike" && detail.id === target.id) return doc.querySelector(".post-page .post-wrap");
  return Array.from(doc.querySelectorAll(JIKE_CARD_SELECTOR)).find(card=>jikeCardTarget(card,pageUrl)?.id === target.id) || null;
};

/** Public share-page/card reader. It never fetches authenticated Jike APIs. */
export const readJike = (doc: Document, pageUrl: string, target: PlatformTarget | null = platformTarget(pageUrl)): PlatformRead => {
  if (target?.platform !== "jike") return {ok:false,reason:"not-target"};
  const card=jikePostCard(doc,target,pageUrl);
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
  clean.querySelectorAll('button,[role="button"],audio').forEach(node=>{
    if (images.includes(node)) node.removeAttribute("role");
    else if (node.tagName.toLowerCase() !== "audio" && images.some(image=>node.contains(image))) node.replaceWith(...Array.from(node.childNodes));
    else node.remove();
  });
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
export const jikeExpandButton = (doc: Document, card: Element | null = doc.querySelector(".post-page .post-wrap")): HTMLElement | null => Array.from(card?.querySelectorAll<HTMLElement>('.text button,.text [role="button"]') || [])
  .find(n=>/^(展开|展开全文|展开全部|显示全文)$/.test(platformText(platformReadableCopy(n)))) || null;
