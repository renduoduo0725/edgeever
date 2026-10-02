// Content script for zhihu.com and zhuanlan.zhihu.com. It only remembers which
// answer or article was under the pointer so a later menu click can save that
// item. No imports: content scripts are classic scripts, and this file is also
// injected again after the user grants access.
(() => {
  const root = globalThis as typeof globalThis & { __edgeeverZhihuTarget?: boolean };
  if (root.__edgeeverZhihuTarget) return;
  root.__edgeeverZhihuTarget = true;

  // Keep identical to targetFromLocation in zhihu-clip.ts.
  const targetFromLocation = (hostname: string, pathname: string) => {
    const host = hostname.toLowerCase();
    const articleHost = host === "zhuanlan.zhihu.com" || host === "www.zhuanlan.zhihu.com";
    if (articleHost) {
      const article = pathname.match(/^\/p\/(\d+)(?=\/|$)/);
      if (article?.[1]) return { kind: "article" as const, id: article[1], questionId: "" };
      return null;
    }
    const zhihuHost = host === "zhihu.com" || host === "www.zhihu.com";
    if (!zhihuHost) return null;
    const answer = pathname.match(/^\/question\/(\d+)\/answer\/(\d+)(?=\/|$)/);
    if (answer?.[1] && answer?.[2]) return { kind: "answer" as const, id: answer[2], questionId: answer[1] };
    const bare = pathname.match(/^\/answer\/(\d+)(?=\/|$)/);
    if (bare?.[1]) return { kind: "answer" as const, id: bare[1], questionId: "" };
    return null;
  };

  const readItem = (node: Element) => {
    const raw = node.getAttribute("data-zop") || "";
    try {
      const parsed = JSON.parse(raw) as { type?: unknown; itemId?: unknown };
      const kind = parsed.type === "article" || parsed.type === "answer" ? parsed.type : "";
      const id = typeof parsed.itemId === "string" || typeof parsed.itemId === "number"
        ? String(parsed.itemId)
        : "";
      if (kind && /^\d+$/.test(id)) return { kind, id };
    } catch {
      // A card without data-zop can still be an answer or article element.
    }
    const itemProp = node.getAttribute("itemprop");
    const name = node.getAttribute("name") || "";
    if ((itemProp === "answer" || itemProp === "article") && /^\d+$/.test(name)) {
      return { kind: itemProp, id: name };
    }
    return null;
  };

  document.addEventListener("contextmenu", (event) => {
    const rawTarget = event.target;
    const element = rawTarget instanceof Element
      ? rawTarget
      : rawTarget instanceof Node
        ? rawTarget.parentElement
        : null;
    if (!element) return;
    for (const node of document.querySelectorAll("[data-edgeever-zhihu-target]")) {
      node.removeAttribute("data-edgeever-zhihu-target");
      node.removeAttribute("data-edgeever-zhihu-kind");
      node.removeAttribute("data-edgeever-zhihu-id");
    }
    const item = element.closest(".ContentItem");
    if (item) {
      const info = readItem(item);
      if (!info) return;
      item.setAttribute("data-edgeever-zhihu-target", "1");
      item.setAttribute("data-edgeever-zhihu-kind", info.kind);
      item.setAttribute("data-edgeever-zhihu-id", info.id);
      return;
    }
    const post = element.closest("article.Post-Main, .Post-Main");
    if (!post) return;
    const fromPage = targetFromLocation(location.hostname, location.pathname);
    if (!fromPage || fromPage.kind !== "article") return;
    post.setAttribute("data-edgeever-zhihu-target", "1");
    post.setAttribute("data-edgeever-zhihu-kind", fromPage.kind);
    post.setAttribute("data-edgeever-zhihu-id", fromPage.id);
  }, true);
})();
