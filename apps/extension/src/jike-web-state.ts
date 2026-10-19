/** Read only the selected card's current host props, never Fiber/alternate trees. */
export function readJikeWebStateInPage(expectedId?: string) {
  // Closure-free: scripting.executeScript serializes this function into MAIN.
  if (new URL(location.href).origin !== "https://web.okjike.com") return null;
  if (expectedId && !/^[a-f0-9]{24}$/.test(expectedId)) return null;
  const object = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" ? v as Record<string, unknown> : null;
  const visible = (node: Element) => {
    for (let n: Element | null = node; n; n = n.parentElement) {
      if (n.matches('[hidden], [aria-hidden="true"]') || (n.ownerDocument.defaultView?.getComputedStyle?.(n) || (n as HTMLElement).style)?.display === "none") return false;
    }
    const visibility = node.ownerDocument.defaultView?.getComputedStyle?.(node).visibility || (node as HTMLElement).style?.visibility;
    return visibility !== "hidden" && visibility !== "collapse";
  };
  const read = (card: Element) => {
    const keys = Object.getOwnPropertyNames(card).filter(k => k.startsWith("__reactProps$"));
    if (keys.length !== 1) return null;
    const stack: unknown[] = [(card as unknown as Record<string, unknown>)[keys[0]]], seen = new WeakSet<object>();
    const posts = new Map<string, { id: string; type: string; content: string; createdAt?: string; user: { username: string }; pictures: { picUrl?: string; middlePicUrl?: string; thumbnailUrl?: string }[] }>();
    while (stack.length) {
      const value = object(stack.pop());
      if (!value || seen.has(value)) continue;
      seen.add(value);
      if (Array.isArray(value)) { stack.push(...value); continue; }
      const props = object(value.props) || value, data = object(props.data), user = object(data?.user);
      if (data && typeof data.id === "string" && /^[a-f0-9]{24}$/.test(data.id) && typeof data.type === "string" && user && typeof user.username === "string") {
        if (typeof data.content !== "string" || !Array.isArray(data.pictures)) return null;
        const pictures: { picUrl?: string; middlePicUrl?: string; thumbnailUrl?: string }[] = [];
        for (const picture of data.pictures) {
          const p = object(picture);
          if (!p) return null;
          pictures.push({ picUrl: typeof p.picUrl === "string" ? p.picUrl : undefined, middlePicUrl: typeof p.middlePicUrl === "string" ? p.middlePicUrl : undefined, thumbnailUrl: typeof p.thumbnailUrl === "string" ? p.thumbnailUrl : undefined });
        }
        const post = { id: data.id, type: data.type, content: data.content, createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined, user: { username: user.username }, pictures };
        if (posts.has(post.id) && JSON.stringify(posts.get(post.id)) !== JSON.stringify(post)) return null;
        posts.set(post.id, post);
      }
      if (props.children) stack.push(props.children);
    }
    const postsList = [...posts.values()];
    return postsList.length === 1 && postsList[0].type === "ORIGINAL_POST" ? postsList[0] : null;
  };
  const matches = [];
  const url=new URL(location.href);
  const route = /^(\/u\/[^/]+)\/post\/([a-f0-9]{24})\/?$/.exec(url.pathname);
  if (route && expectedId && route[2] !== expectedId) return null;
  const selector=route ? '[data-clickable-feedback][class*="_postCard_"]' : expectedId ? `[data-edgeever-jike-id="${expectedId}"]` : '[data-edgeever-jike-selected]';
  for (const card of Array.from(document.querySelectorAll(selector))) {
    const header = card.querySelector("header"), body = card.querySelector('[class*="_contentWrapper_"]');
    if (!card.matches('[data-clickable-feedback]') || !header || !body || body.contains(header) || header.closest('[data-clickable-feedback]') !== card || body.closest('[data-clickable-feedback]') !== card || !visible(card)) continue;
    if (route && !Array.from(header.querySelectorAll('a[href]')).some(link => {
      try { return visible(link) && new URL(link.getAttribute('href') || '',url.origin).href === `${url.origin}${route[1]}`; } catch { return false; }
    })) continue;
    const post = read(card);
    if (post && (!expectedId || post.id === expectedId) && (!route || post.id === route[2])) matches.push({ card, post });
  }
  if (matches.length !== 1) return null;
  if (!route) matches[0].card.setAttribute("data-edgeever-jike-id", matches[0].post.id);
  return { pageUrl: location.href, post: matches[0].post };
}
