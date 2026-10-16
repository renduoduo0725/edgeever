import { markdownText, platformHtmlMarkdown, platformReadableCopy, platformTarget, platformText, type PlatformRead } from "./platform-clip";

/** Closure-free, read-only probe shared with the popup's executeScript call. */
export function bossLoginRequired(doc: Document = document): boolean {
  return Array.from(doc.querySelectorAll(".job-detail-section .job-sec-text .zp-more-info-layer-wrapper .zp-more-info-layer-text")).some((node) => {
    let visibleText = "";
    const walker = doc.createTreeWalker(node, 4 /* SHOW_TEXT */);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const parent = text.parentElement;
      if (!parent) continue;
      let visibility = doc.defaultView?.getComputedStyle?.(parent).visibility, hidden = false;
      for (let current: Element | null = parent; current; current = current.parentElement) {
        if (current.matches('[hidden], [aria-hidden="true"], script, style, template')) { hidden = true; break; }
        const style = doc.defaultView?.getComputedStyle?.(current) || (current as HTMLElement).style;
        if (style?.display === "none") { hidden = true; break; }
        if (!visibility && style?.visibility && style.visibility !== "inherit") visibility = style.visibility;
      }
      if (!hidden && visibility !== "hidden" && visibility !== "collapse") visibleText += text.textContent || "";
    }
    return visibleText.replace(/\s+/g, "").includes("登录查看完整内容");
  });
}

export const readBoss = (doc: Document, pageUrl: string): PlatformRead => {
  const target = platformTarget(pageUrl);
  if (target?.platform !== "boss") return { ok: false, reason: "not-target" };
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
  if (canonical && platformTarget(canonical)?.url !== target.url) return { ok: false, reason: "changed" };
  const banner = doc.querySelector(".job-banner .info-primary");
  const body = doc.querySelector(".job-detail-section:not(.job-detail-company) .job-sec-text");
  const company = doc.querySelector(".job-detail-company .job-sec-text");
  if (!banner || !body) return { ok: false, reason: "unreadable" };
  // The public preview cuts the requirements mid-sentence. Never save it as a
  // complete job, or recover the protected remainder from scripts or APIs.
  if (bossLoginRequired(doc)) return { ok: false, reason: "unreadable" };
  const cleanBanner = platformReadableCopy(banner);
  const title = platformText(cleanBanner.querySelector("h1"));
  const salary = platformText(cleanBanner.querySelector(".salary"));
  const requirements = platformText(cleanBanner.querySelector("p"));
  const companyName = Array.from(doc.querySelectorAll(".sider-company .company-info a[href]"))
    .map((node) => platformText(platformReadableCopy(node))).find(Boolean) || "";
  const bodyMarkdown = platformHtmlMarkdown(platformReadableCopy(body), target.url);
  const companyMarkdown = company ? platformHtmlMarkdown(platformReadableCopy(company), target.url) : "";
  if (!title || !bodyMarkdown) return { ok: false, reason: "unreadable" };
  // Keep the site's headings instead of inventing a second classification of
  // responsibilities and requirements. Only the relevant text blocks enter.
  const info = [salary, requirements].filter(Boolean).map(markdownText).join(" · ");
  const address = doc.querySelector(".job-detail-company .location-address");
  const companyHeading = doc.querySelector(".job-detail-company h3");
  const bodyHeading = body.parentElement?.querySelector("h3,.detail-content-header");
  const heading = (node: Element | null | undefined) => node ? platformText(platformReadableCopy(node)) : "";
  const companyLabel = heading(companyHeading) || companyName;
  const benefits = Array.from(doc.querySelectorAll(".job-banner .job-tags"))
    .map((node) => platformText(platformReadableCopy(node))).find(Boolean);
  return { ok: true, clip: { ...target, title, author: companyName || undefined,
    markdown: [info, companyName ? markdownText(companyName) : "", benefits ? markdownText(benefits) : "", `## ${markdownText(heading(bodyHeading) || title)}`, bodyMarkdown,
      companyMarkdown && companyLabel ? `## ${markdownText(companyLabel)}` : "", companyMarkdown,
      address ? markdownText(platformText(platformReadableCopy(address))) : ""].filter(Boolean).join("\n\n"),
    tags: ["web-clip", "boss"], completeness: "complete" } };
};
