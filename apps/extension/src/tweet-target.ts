// Content script for x.com and twitter.com. It only remembers which tweet was
// under the pointer so a later menu click can save that post. No imports:
// content scripts are classic scripts, and this file is also injected again
// after the user grants access.
(() => {
  const root = globalThis as typeof globalThis & { __edgeeverTweetTarget?: boolean };
  if (root.__edgeeverTweetTarget) return;
  root.__edgeeverTweetTarget = true;

  document.addEventListener("contextmenu", (event) => {
    const rawTarget = event.target;
    const element = rawTarget instanceof Element
      ? rawTarget
      : rawTarget instanceof Node
        ? rawTarget.parentElement
        : null;
    if (!element) return;
    const article = element.closest('article[data-testid="tweet"]');
    for (const node of document.querySelectorAll("[data-edgeever-tweet-target]")) {
      node.removeAttribute("data-edgeever-tweet-target");
    }
    if (article) article.setAttribute("data-edgeever-tweet-target", "1");
  }, true);
})();
