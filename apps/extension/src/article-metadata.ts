import { platformText, publishedTime, safePlatformUrl, type PublishedTime } from "./platform-clip";

export type ArticleContent = { title: string; body: Element; author?: string; publishedAt?: PublishedTime };
/** Read only metadata declared for this article, excluding recommendations and
 * comment authors. Missing author/time never makes a readable article fail. */
export const articleMetadata = (doc: Document, pageUrl: string, title: string, article: Element) => {
  const identity=(value: unknown) => {
    if(typeof value !== "string") return "";
    const safe=safePlatformUrl(value,pageUrl);
    if(!safe) return "";
    const url=new URL(safe);return url.origin+url.pathname.replace(/\/$/,"");
  };
  const own=identity(pageUrl);
  let author: string | undefined, time: PublishedTime | undefined;
  for(const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const parsed=JSON.parse(script.textContent || "");
      const entries=Array.isArray(parsed) ? parsed : Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [parsed];
      for(const item of entries) {
        if(!item || !["SocialMediaPosting","NewsArticle","Article","BlogPosting"].includes(item["@type"]) || identity(item.url || item.mainEntityOfPage || item["@id"]) !== own || (typeof item.headline !== "string" || item.headline.replace(/\s+/g," ").trim() !== title)) continue;
        const authors=Array.isArray(item.author) ? item.author : [item.author];
        author=authors.map((value: unknown)=>typeof value === "string" ? value : value && typeof value === "object" && "name" in value && typeof value.name === "string" ? value.name : "").filter(Boolean).join(", ") || undefined;
        if(typeof item.datePublished === "string") {
          const node=doc.createElement("time");node.setAttribute("datetime",item.datePublished);
          time=publishedTime(node);
        }
      }
    } catch { /* Malformed or unrelated metadata is optional. */ }
  }
  const clean=article;
  author ||= platformText(clean.querySelector('[data-testid="authorName"],.byline a[href*="substack.com/profile/"]')) || undefined;
  const timeNode=clean.querySelector('[data-testid="storyPublishDate"],.byline time[datetime]');
  const displayed=publishedTime(timeNode);
  if (!time && timeNode) {
    const date=/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w* (\d{1,2}), (\d{4})$/.exec(platformText(timeNode));
    if(date) time={value:`${date[3]}-${String(["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(date[1])+1).padStart(2,"0")}-${date[2].padStart(2,"0")}`,precision:"date"};
  }
  time ||= displayed;
  return {author,publishedAt:time};
};
