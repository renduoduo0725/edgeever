// Injected on demand into a GitHub tab. Must stay import-free: Chrome loads
// this file with executeScript, which does not resolve extension modules.
// The background page turns this snapshot into the note.
(() => {
  const root = globalThis as typeof globalThis & {
    __edgeeverGithubClipPayload?: { requestId?: string };
  };
  const payload = root.__edgeeverGithubClipPayload;
  delete root.__edgeeverGithubClipPayload;
  if (!payload || typeof payload.requestId !== "string") return;
  const requestId = payload.requestId;

  const finish = (result: Record<string, unknown>) => {
    void chrome.runtime.sendMessage({ type: "pageGithubRead", requestId, result });
  };

  const text = (node: Node | null) => (node?.textContent || "").replace(/\s+/g, " ").trim();

  const metaContent = (selector: string) => document.querySelector(selector)?.getAttribute("content")?.trim() || "";

  try {
    const chunks: string[] = [];
    for (const script of document.querySelectorAll('script[type="application/json"]')) {
      const body = script.textContent || "";
      if (!body.includes("ownerLogin") && !body.includes("sidebarAbout")) continue;
      if (body.length > 500_000) continue;
      chunks.push(body);
      if (chunks.length >= 4) break;
    }

    const about = document.querySelector('[class*="SidebarAbout-module__description"]');
    const website = document.querySelector('[class*="website"] a[href^="http"], a[class*="website"][href^="http"]');
    const topics: string[] = [];
    for (const link of document.querySelectorAll('a[class*="TopicTag"], a[href^="/topics/"]')) {
      const href = link.getAttribute("href") || "";
      if (!/^\/topics\/[^/]+$/.test(href)) continue;
      const name = text(link);
      if (name) topics.push(name);
    }

    let license = "";
    for (const icon of document.querySelectorAll(".octicon-law")) {
      const label = text(icon.closest("a") || icon.parentElement);
      const cleaned = label.replace(/\s+license$/i, "").trim();
      if (cleaned && cleaned.length <= 80 && !/readme/i.test(cleaned)) {
        license = cleaned;
        break;
      }
    }

    const languages: { name: string; percent: number }[] = [];
    for (const section of document.querySelectorAll('[class*="sidebarSection"], [class*="SidebarSection"]')) {
      const stillLoading = Boolean(section.querySelector('[class*="Skeleton"], [data-component="SkeletonText"]'));
      if (stillLoading && !section.textContent?.includes("%")) continue;
      for (const row of section.querySelectorAll("li, a")) {
        const percentNode = [...row.querySelectorAll("span")].find((span) => /^\d+(?:\.\d+)?%$/.test(text(span)));
        const nameNode = [...row.querySelectorAll("span")].find((span) => {
          const label = text(span);
          return Boolean(label) && !label.endsWith("%") && !/^[\d.]+$/.test(label);
        });
        const name = nameNode ? text(nameNode) : "";
        const percent = percentNode ? Number.parseFloat(text(percentNode)) : Number.NaN;
        if (name && Number.isFinite(percent)) languages.push({ name, percent });
      }
    }
    languages.sort((left, right) => right.percent - left.percent);

    const readmeRoot = document.querySelector("#readme") || document.querySelector(".markdown-body");
    const readme = readmeRoot?.querySelector(".markdown-body") || readmeRoot;
    const readmeParagraphs: string[] = [];
    if (readme) {
      for (const paragraph of readme.querySelectorAll("p")) {
        if (paragraph.closest("pre, table")) continue;
        const copy = paragraph.cloneNode(true) as HTMLElement;
        copy.querySelectorAll("img, svg, picture").forEach((node) => node.remove());
        const paragraphText = text(copy);
        if (paragraphText) readmeParagraphs.push(paragraphText);
        if (readmeParagraphs.length >= 8) break;
      }
    }

    finish({
      ok: true,
      source: {
        pageUrl: location.href,
        openGraphDescription: metaContent('meta[property="og:description"]'),
        embeddedJsonChunks: chunks,
        aboutText: text(about),
        homepage: website?.getAttribute("href")?.trim() || "",
        topics,
        license,
        language: languages[0]?.name || "",
        readmeParagraphs,
      },
    });
  } catch {
    finish({ ok: false });
  }
})();
