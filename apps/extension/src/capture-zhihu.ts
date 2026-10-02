// Injected on demand. Finds the answer or article marked by zhihu-target.js,
// or the one named by the page URL. Must stay import-free.
(() => {
  const root = globalThis as typeof globalThis & {
    __edgeeverZhihuTarget?: boolean;
    __edgeeverZhihuClipPayload?: { requestId?: string };
  };
  const payload = root.__edgeeverZhihuClipPayload;
  delete root.__edgeeverZhihuClipPayload;
  if (!payload || typeof payload.requestId !== "string") return;
  const requestId = payload.requestId;

  const finish = (result: Record<string, unknown>) => {
    void chrome.runtime.sendMessage({ type: "pageZhihuRead", requestId, result });
  };

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

  // Keep identical to questionIdFromHref in zhihu-clip.ts.
  const questionIdFromHref = (href: string) => {
    if (!href) return "";
    try {
      const url = new URL(href, "https://www.zhihu.com");
      return url.pathname.match(/^\/question\/(\d+)(?:\/answer\/\d+)?(?=\/|$)/)?.[1] ?? "";
    } catch {
      return "";
    }
  };

  const clean = (value: string) => value
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const textOf = (node: Element | null) => clean(node?.textContent || "");

  const readMarked = (node: Element) => {
    const kind = node.getAttribute("data-edgeever-zhihu-kind");
    const id = node.getAttribute("data-edgeever-zhihu-id") || "";
    if ((kind === "answer" || kind === "article") && /^\d+$/.test(id)) return { kind, id };
    return null;
  };

  const domSnapshot = (scope: Element | null, kind: "answer" | "article") => {
    const empty = { href: "", title: "", author: "", domHtml: "", domComplete: false };
    const root = scope || (kind === "article" ? document.querySelector(".Post-Main") : null);
    if (!root) return empty;
    const richCandidates = [...root.querySelectorAll(".RichText")]
      .filter((node) => !node.closest(".Comment, .Comments, .Comments-container, .HotComment, .ContentItem-actions"));
    const rich = kind === "article"
      ? (root.querySelector(".Post-RichText") || richCandidates[0] || null)
      : (richCandidates[0] || null);
    const collapsed = Boolean(
      root.querySelector(".RichContent.is-collapsed, button.ContentItem-more"),
    );
    const domHtml = (rich?.innerHTML || "").slice(0, 1_000_000);
    const href = root.querySelector(".ContentItem-title a")?.getAttribute("href") || "";
    const title = textOf(root.querySelector(".ContentItem-title, .Post-Title"))
      || (kind === "answer" ? textOf(document.querySelector(".QuestionHeader-title")) : "");
    const author = textOf(root.querySelector(".AuthorInfo-name"));
    return {
      href,
      title,
      author,
      domHtml,
      domComplete: Boolean(domHtml.trim()) && !collapsed,
    };
  };

  try {
    const marked = document.querySelector("[data-edgeever-zhihu-target='1']");
    const fromPage = targetFromLocation(location.hostname, location.pathname);
    const fromMark = marked ? readMarked(marked) : null;
    const chosen = fromMark || (!marked ? fromPage : null);
    if (!chosen) {
      finish({ ok: false, reason: root.__edgeeverZhihuTarget ? "not-found" : "needs-listener" });
      return;
    }
    const scope = marked
      || document.querySelector(`.ContentItem[name="${chosen.id}"]`);
    const kind = chosen.kind === "article" ? "article" : "answer";
    const dom = domSnapshot(scope, kind);
    const questionId = chosen.kind === "answer"
      ? (questionIdFromHref(dom.href) || (fromPage?.id === chosen.id ? fromPage.questionId : ""))
      : "";
    finish({
      ok: true,
      kind: chosen.kind,
      id: chosen.id,
      questionId,
      title: dom.title,
      author: dom.author,
      href: dom.href,
      pageUrl: location.href,
      domHtml: dom.domHtml,
      domComplete: dom.domComplete,
    });
  } catch {
    finish({ ok: false, reason: "not-found" });
  }
})();
