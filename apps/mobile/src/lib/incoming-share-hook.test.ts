import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Exercise the patched dependency's actual hook without booting React Native.
const hookSource = readFileSync(
  new URL("../../node_modules/expo-sharing/src/useIncomingShare.ts", import.meta.url), "utf8",
);
const hookCode = new Bun.Transpiler({ loader: "ts" }).transformSync(hookSource)
  .replace(/^import .* from [^;]+;\n/gm, "")
  .replace("export function useIncomingShare", "function useIncomingShare");

const article = [{ value: "https://www.zhihu.com/pin/2094371908041052336", mimeType: "text/plain", shareType: "url" }];
const deferred = () => {
  let resolve!: (value: unknown[]) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<unknown[]>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function mountHook() {
  const slots: unknown[] = [];
  let cursor = 0;
  let nativePayloads = article;
  const requests: ReturnType<typeof deferred>[] = [];
  const useState = (initial: unknown) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], (next: unknown) => { slots[index] = next; }];
  };
  const useRef = (initial: unknown) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = { current: initial };
    return slots[index];
  };
  const hook = new Function(
    "useState", "useRef", "useCallback", "useEffect", "AppState",
    "clearNativeSharedPayloads", "getSharedPayloads", "getResolvedSharedPayloadsAsync",
    `${hookCode}\nreturn useIncomingShare;`,
  )(
    useState, useRef, (callback: unknown) => callback, () => {}, {},
    () => { nativePayloads = []; }, () => nativePayloads,
    () => { const request = deferred(); requests.push(request); return request.promise; },
  );
  return {
    render: () => { cursor = 0; return hook(); },
    shareAgain: () => { nativePayloads = article; },
    requests,
  };
}

describe("incoming share hook", () => {
  test("clearing during resolution prevents a late result replaying a consumed Zhihu share", async () => {
    const app = mountHook();
    const pending = app.render().refreshSharePayloads();
    app.render().clearSharedPayloads();
    app.requests[0]!.resolve(article);
    await pending;
    expect(app.render().sharedPayloads).toEqual([]);
    expect(app.render().resolvedSharedPayloads).toEqual([]);
    expect(app.render().isResolving).toBe(false);
    await app.render().refreshSharePayloads(); // returning to the foreground
    expect(app.requests).toHaveLength(1);
  });

  test("a stale failure cannot overwrite a new share or end its loading state", async () => {
    const app = mountHook();
    const first = app.render().refreshSharePayloads();
    app.render().clearSharedPayloads();
    app.shareAgain();
    const second = app.render().refreshSharePayloads();
    app.requests[0]!.reject(new Error("old request failed"));
    await first;
    expect(app.render().error).toBeNull();
    expect(app.render().isResolving).toBe(true);
    app.requests[1]!.resolve(article);
    await second;
    expect(app.render().resolvedSharedPayloads).toEqual(article);
    expect(app.render().isResolving).toBe(false);
  });

  test("the user can deliberately share the same link after completing a clip", async () => {
    const app = mountHook();
    const first = app.render().refreshSharePayloads();
    app.requests[0]!.resolve(article);
    await first;
    app.render().clearSharedPayloads();
    expect(app.render().resolvedSharedPayloads).toEqual([]);
    await app.render().refreshSharePayloads();
    app.shareAgain();
    const second = app.render().refreshSharePayloads();
    expect(app.requests).toHaveLength(2);
    app.requests[1]!.resolve(article);
    await second;
    expect(app.render().resolvedSharedPayloads).toEqual(article);
  });
});

test("workspace finishes the accepted clip when resolved payloads rerun its effect", async () => {
  const source = readFileSync(new URL("../screens/WorkspaceScreen.tsx", import.meta.url), "utf8");
  const start = source.indexOf("  useEffect(() => {\n    if (incomingShareIsResolving)");
  const end = source.indexOf("  }, [\n    incomingShareError,", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const effectBody = source.slice(start + "  useEffect(() => {".length, end);
  const request = deferred();
  const opened: unknown[] = [];
  let importing = false;
  let handled = 0;
  const context = {
    incomingShareIsResolving: false,
    incomingShareError: null,
    incomingSharePayloads: article,
    incomingShareUrl: article[0]!.value,
    sharedImages: [],
    notebooks: [{}],
    notebooksQuery: { isSuccess: true },
    processedShareUrlRef: { current: null },
    incomingShareTaskRef: { current: null },
    resolvedLocale: "zh-CN",
    isWeChatArticleUrl: () => false,
    setIsImportingShare: (value: boolean) => { importing = value; },
    buildMobileWebClipDraft: () => request.promise,
    openIncomingClipDraft: (draft: unknown) => { opened.push(draft); },
    onIncomingShareHandledRef: { current: () => { handled++; } },
    Alert: { alert: () => { throw new Error("unexpected alert"); } },
  };
  const runEffect = () => new Function(...Object.keys(context), effectBody)(...Object.values(context));
  const cleanup = runEffect();
  expect(importing).toBe(true);
  // React cleans up the previous effect when the hook replaces raw payloads
  // with resolved payloads, even though the article URL has not changed.
  if (typeof cleanup === "function") cleanup();
  runEffect();
  const draft = { title: "知乎", contentMarkdown: "来源链接" };
  request.resolve([draft]);
  await request.promise;
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(opened).toEqual([[draft]]);
  expect(importing).toBe(false);
  expect(handled).toBe(1);
});
