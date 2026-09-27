// Injected on demand. Reads the tweet marked by tweet-target.js, or the tweet
// in the address bar when this page is a single status. Must stay import-free.
(() => {
  const root = globalThis as typeof globalThis & {
    __edgeeverTweetTarget?: boolean;
    __edgeeverTweetClipPayload?: { requestId?: string; statusId?: string };
  };
  const payload = root.__edgeeverTweetClipPayload;
  delete root.__edgeeverTweetClipPayload;
  if (!payload || typeof payload.requestId !== "string") return;
  const requestId = payload.requestId;
  const statusId = typeof payload.statusId === "string" ? payload.statusId : "";

  const finish = (result: Record<string, unknown>) => {
    void chrome.runtime.sendMessage({ type: "pageTweetRead", requestId, result });
  };

  const clean = (value: string) => value.replace(/\s+/g, " ").trim();

  // Keep identical to visibleTweetAuthor in tweet-clip.ts.
  const visibleTweetAuthor = (value: string) => {
    const parts = value.replace(/\r/g, "").split("\n").map((part) => part.trim()).filter(Boolean);
    const handlePart = parts.find((part) => /^@[A-Za-z0-9_]{1,15}$/.test(part));
    const handle = handlePart ? handlePart.slice(1) : "";
    const displayName = parts.find((part) => part !== handlePart && part !== "·" && part !== "•") ?? "";
    return { displayName, handle };
  };

  const parseName = (rootNode: Element | null) => {
    if (!rootNode) return { displayName: "", handle: "" };
    const links = [...rootNode.querySelectorAll("a[href]")];
    const handleLink = links.find((link) => clean(link.textContent || "").startsWith("@"));
    const handleFromLink = clean(handleLink?.textContent || "").replace(/^@/, "").split(/\s/)[0] ?? "";
    const handleFromHref = (links.find((link) => /^\/[A-Za-z0-9_]{1,15}$/.test(link.getAttribute("href") || ""))?.getAttribute("href") || "").slice(1);
    const handle = handleFromLink || handleFromHref;
    const nameLink = links.find((link) => {
      const text = clean(link.textContent || "");
      return link !== handleLink && text.length > 0 && !text.startsWith("@");
    });
    const displayName = clean(nameLink?.textContent || "");
    if (displayName || handle) return { displayName, handle };
    return visibleTweetAuthor((rootNode as HTMLElement).innerText || rootNode.textContent || "");
  };

  const hrefMatchesStatus = (href: string, id: string) => new RegExp(`/status/${id}(?:/|\\?|$)`).test(href);

  const quotedTime = (time: Element) => {
    const name = time.closest('[data-testid="User-Name"]');
    return Boolean(name?.closest('[role="link"]'));
  };

  const ownTime = (article: Element) => [...article.querySelectorAll("time")].find((time) => !quotedTime(time)) ?? null;

  const ownStatusHref = (article: Element) => ownTime(article)?.closest("a")?.getAttribute("href") ?? "";

  const findArticle = (preferredId: string) => {
    const marked = document.querySelector('article[data-testid="tweet"][data-edgeever-tweet-target="1"]');
    if (marked) return marked;
    const id = preferredId || statusId;
    if (!id) return null;
    return [...document.querySelectorAll('article[data-testid="tweet"]')].find((article) => hrefMatchesStatus(ownStatusHref(article), id)) ?? null;
  };

  const isMainShowMore = (node: Element) => {
    const card = node.closest('[role="link"]');
    return !card || card === node;
  };

  const mainShowMore = (article: Element) => [...article.querySelectorAll('[data-testid="tweet-text-show-more-link"]')].find((node) => isMainShowMore(node)) ?? null;

  const mainTextNode = (article: Element) => {
    const texts = [...article.querySelectorAll('[data-testid="tweetText"]')];
    return texts.find((node) => !node.closest('[role="link"]')) ?? texts[0] ?? null;
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const expandTruncatedText = async (article: Element) => {
    const button = mainShowMore(article);
    if (!button) return article;
    const before = (mainTextNode(article)?.textContent || "").length;
    const statusKey = ownStatusHref(article).match(/\/status\/(\d+)/)?.[1] ?? statusId;
    (button as HTMLElement).click();
    const started = Date.now();
    const deadline = started + 4000;
    let current = article;
    while (Date.now() < deadline) {
      await sleep(80);
      const next = findArticle(statusKey) ?? (article.isConnected ? article : null);
      if (!next) continue;
      current = next;
      const length = (mainTextNode(current)?.textContent || "").length;
      const stillFolded = Boolean(mainShowMore(current));
      if (!stillFolded && (length > before || Date.now() - started > 500)) break;
    }
    const photoDeadline = Date.now() + 800;
    while (Date.now() < photoDeadline) {
      const next = findArticle(statusKey) ?? (current.isConnected ? current : null);
      if (next) current = next;
      if (current.querySelector('[data-testid="tweetPhoto"] img, [data-testid="card.layoutLarge.media"] img')) break;
      await sleep(80);
    }
    return current;
  };

  const visibleText = (node: Element | null) => {
    if (!node) return "";
    const parts: string[] = [];
    const walk = (current: Node) => {
      if (current.nodeType === Node.TEXT_NODE) {
        parts.push(current.nodeValue || "");
        return;
      }
      if (current.nodeType !== Node.ELEMENT_NODE) return;
      const element = current as HTMLElement;
      if (element.getAttribute("aria-hidden") === "true") return;
      if (element.getAttribute("data-testid") === "tweet-text-show-more-link") return;
      if (element.tagName === "BR") {
        parts.push("\n");
        return;
      }
      if (element.tagName === "IMG") {
        const alt = element.getAttribute("alt");
        if (alt) parts.push(alt);
        return;
      }
      const block = element !== node && /^(block|flex|grid|list-item)$/.test(getComputedStyle(element).display);
      if (block && parts.length > 0 && !parts[parts.length - 1]?.endsWith("\n")) parts.push("\n");
      for (const child of element.childNodes) walk(child);
      if (block && parts.length > 0 && !parts[parts.length - 1]?.endsWith("\n")) parts.push("\n");
    };
    walk(node);
    return parts.join("").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  };

  const isPhoto = (src: string) => {
    if (!src || src.startsWith("blob:") || src.startsWith("data:")) return false;
    try {
      const url = new URL(src, location.href);
      const host = url.hostname.toLowerCase();
      if (host !== "pbs.twimg.com" && !host.endsWith(".twimg.com")) return false;
      const path = url.pathname.toLowerCase();
      if (path.includes("/profile_images/") || path.includes("/profile_banners/") || path.includes("/emoji/")) return false;
      if (path.includes("/amplify_video") || path.includes("/ext_tw_video") || path.includes("/tweet_video")) return false;
      return path.includes("/media/") || path.includes("/card_img/");
    } catch {
      return false;
    }
  };

  const absoluteStatus = (href: string) => {
    if (!href) return "";
    try {
      const url = new URL(href, location.href);
      const match = url.pathname.match(/\/([^/]+)\/status\/(\d+)/);
      if (!match?.[1] || !match[2]) return "";
      return `${url.origin}/${match[1]}/status/${match[2]}`;
    } catch {
      return "";
    }
  };

  const readArticle = (article: Element) => {
    const names = [...article.querySelectorAll('[data-testid="User-Name"]')];
    const mainName = names.find((node) => !node.closest('[role="link"]')) ?? names[0] ?? null;
    const quoteName = names.find((node) => node !== mainName && Boolean(node.closest('[role="link"]'))) ?? null;
    const texts = [...article.querySelectorAll('[data-testid="tweetText"]')];
    const mainText = texts.find((node) => !node.closest('[role="link"]')) ?? texts[0] ?? null;
    const quoteText = texts.find((node) => node !== mainText && Boolean(node.closest('[role="link"]'))) ?? null;
    const author = parseName(mainName);
    const quoted = parseName(quoteName);
    const images: Array<{ url: string; alt: string }> = [];
    for (const img of article.querySelectorAll("img")) {
      if (img.closest('[data-testid="tweetText"]')) continue;
      if (img.closest('[data-testid="Tweet-User-Avatar"]')) continue;
      if (img.closest('[data-testid="videoPlayer"], [data-testid="videoComponent"]')) continue;
      if (img.naturalWidth > 0 && img.naturalHeight > 0 && img.naturalWidth < 48 && img.naturalHeight < 48) continue;
      const src = img.currentSrc || img.src;
      if (!isPhoto(src) || images.some((image) => image.url === src)) continue;
      images.push({ url: src, alt: clean(img.alt) });
      if (images.length >= 6) break;
    }
    return {
      author,
      quoted,
      text: visibleText(mainText),
      quotedText: visibleText(quoteText),
      datetime: ownTime(article)?.getAttribute("datetime") ?? "",
      statusUrl: absoluteStatus(ownStatusHref(article)),
      images,
    };
  };

  void (async () => {
    try {
      const initial = findArticle(statusId);
      if (!initial) {
        finish({ ok: false, reason: root.__edgeeverTweetTarget ? "not-found" : "needs-listener" });
        return;
      }
      const article = await expandTruncatedText(initial);
      const read = readArticle(article);
      if (!read.author.displayName && !read.author.handle && !read.text && !read.quotedText && read.images.length === 0) {
        finish({ ok: false, reason: "not-found" });
        return;
      }
      finish({
        ok: true,
        displayName: read.author.displayName,
        handle: read.author.handle,
        text: read.text,
        quotedDisplayName: read.quoted.displayName,
        quotedHandle: read.quoted.handle,
        quotedText: read.quotedText,
        datetime: read.datetime,
        statusUrl: read.statusUrl,
        images: read.images,
      });
    } catch {
      finish({ ok: false, reason: "not-found" });
    }
  })();
})();
