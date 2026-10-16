import { markdownText, platformElementHidden, platformHtmlMarkdown, platformReadableCopy, platformTarget, platformText, publishedTime, publishedTimeText, type PlatformLabels, type PlatformRead } from "./platform-clip";

export const readV2ex = (doc: Document, pageUrl: string, labels: PlatformLabels): PlatformRead => {
  const target = platformTarget(pageUrl);
  if (target?.platform !== "v2ex") return { ok: false, reason: "not-target" };
  const header = doc.querySelector("#Main .header");
  const root = header?.closest(".box");
  const titleNode=header?.querySelector("h1");
  const title = titleNode ? platformText(platformReadableCopy(titleNode)) : "";
  if (!root || !header || !title) return { ok: false, reason: "unreadable" };
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
  if (platformTarget(canonical)?.url !== target.url || !header.querySelector(`#topic_${target.id}_votes`)) {
    return { ok: false, reason: "changed" };
  }
  const body = Array.from(root.querySelectorAll(".topic_content")).find((node) => !node.closest(".subtle"));
  const parts = [body ? platformHtmlMarkdown(platformReadableCopy(body), target.url) : ""];
  for (const supplement of Array.from(root.children).filter((node) => node.classList.contains("subtle"))) {
    const clean=platformReadableCopy(supplement);
    const content = clean.querySelector(".topic_content");
    const markdown = content ? platformHtmlMarkdown(content, target.url) : "";
    if (!markdown) {
      if(platformElementHidden(supplement)) continue;
      return { ok: false, reason: "unreadable" };
    }
    const heading = clean.querySelector(".fade");
    const number = /(?:Supplement\s*|第\s*)(\d+)/i.exec(platformText(heading))?.[1];
    const label = number ? `${labels.supplement} ${number}` : platformText(heading);
    const time = publishedTime(heading?.querySelector("time, span[title]") ?? null);
    parts.push([
      label ? `### ${markdownText(label)}` : "",
      time ? markdownText(publishedTimeText(time, labels.relativeTime)) : "",
      markdown,
    ].filter(Boolean).join("\n\n"));
  }
  const markdown = parts.filter(Boolean).join("\n\n");
  if (!markdown) return { ok: false, reason: "unreadable" };
  const metadata = platformReadableCopy(header).querySelector("small.gray");
  return {
    ok: true,
    clip: {
      ...target, title, markdown,
      author: platformText(metadata?.querySelector('a[href^="/member/"]')) || undefined,
      publishedAt: publishedTime(metadata?.querySelector("time, span") ?? null),
      tags: ["web-clip", target.platform], completeness: "complete",
    },
  };
};
