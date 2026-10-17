import { afterEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { useMemoLinkNavigation } from "./useMemoLinkNavigation.ts";

const globals = ["window", "document", "IS_REACT_ACT_ENVIRONMENT"];
const originals = new Map(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let root;

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = undefined;
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const mount = async () => {
  const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(window.document.getElementById("root"));
  const requests = [];
  const opened = [];
  let errors = 0;
  let openLink;
  const repository = {
    getMemo(id) {
      const request = { id, ...deferred() };
      requests.push(request);
      return request.promise;
    },
  };
  const Harness = ({ scope, repo }) => {
    openLink = useMemoLinkNavigation({
      repository: repo,
      navigationScope: scope,
      onOpen: (memo) => opened.push(memo),
      onError: () => { errors += 1; },
    });
    return null;
  };
  const render = async (scope = "source-notebook/source-memo", repo = repository) => {
    await act(async () => root.render(createElement(Harness, { scope, repo })));
  };
  await render();
  return { render, requests, opened, errors: () => errors, open: (id) => openLink(id) };
};

describe("internal memo link navigation", () => {
  test("resolves a target outside the current notebook/list before opening it", async () => {
    const h = await mount();
    const target = { id: "target", notebookId: "other-notebook", isDeleted: false };
    const opening = h.open(target.id);
    expect(h.requests.map((r) => r.id)).toEqual(["target"]);
    expect(h.opened).toEqual([]);
    await act(async () => {
      h.requests[0].resolve({ memo: target });
      await opening;
    });
    expect(h.opened).toEqual([target]);
    expect(h.errors()).toBe(0);
  });

  test("the latest click wins when link targets finish loading out of order", async () => {
    const h = await mount();
    const first = h.open("first");
    const second = h.open("second");
    await act(async () => {
      h.requests[1].resolve({ memo: { id: "second", notebookId: "second-notebook" } });
      await second;
      h.requests[0].resolve({ memo: { id: "first", notebookId: "first-notebook" } });
      await first;
    });
    expect(h.opened.map((m) => m.id)).toEqual(["second"]);
  });

  test("ignores a late response after the user changes notebook and returns", async () => {
    const h = await mount();
    const opening = h.open("target");
    await h.render("another-notebook/another-memo");
    await h.render();
    await act(async () => {
      h.requests[0].resolve({ memo: { id: "target", notebookId: "other-notebook" } });
      await opening;
    });
    expect(h.opened).toEqual([]);
  });

  test("an ordinary rerender while a link loads does not cancel it", async () => {
    const h = await mount();
    const opening = h.open("target");
    await h.render();
    await act(async () => {
      h.requests[0].resolve({ memo: { id: "target", notebookId: "other-notebook" } });
      await opening;
    });
    expect(h.opened.map((m) => m.id)).toEqual(["target"]);
  });

  test("keeps the current editor and reports missing targets and load errors", async () => {
    const h = await mount();
    const opening = h.open("missing");
    await act(async () => {
      h.requests[0].reject(new Error("404 or offline"));
      await opening;
    });
    expect(h.opened).toEqual([]);
    expect(h.errors()).toBe(1);
  });

  test("does not open a deleted target returned by a local repository", async () => {
    const h = await mount();
    const opening = h.open("deleted");
    await act(async () => {
      h.requests[0].resolve({ memo: { id: "deleted", notebookId: "other-notebook", isDeleted: true } });
      await opening;
    });
    expect(h.opened).toEqual([]);
    expect(h.errors()).toBe(1);
  });

  test("suppresses stale errors after a newer link was opened", async () => {
    const h = await mount();
    const first = h.open("first");
    const second = h.open("second");
    await act(async () => {
      h.requests[0].reject(new Error("offline"));
      await first;
      h.requests[1].resolve({ memo: { id: "second", notebookId: "second-notebook" } });
      await second;
    });
    expect(h.opened.map((m) => m.id)).toEqual(["second"]);
    expect(h.errors()).toBe(0);
  });

  test("ignores pending targets from an account/repository that was replaced", async () => {
    const h = await mount();
    const opening = h.open("target");
    await h.render("source-notebook/source-memo", { getMemo: async () => { throw new Error("other account"); } });
    await act(async () => {
      h.requests[0].resolve({ memo: { id: "target", notebookId: "other-notebook" } });
      await opening;
    });
    expect(h.opened).toEqual([]);
    expect(h.errors()).toBe(0);
  });

  test("does not navigate or display a late error after unmount", async () => {
    const h = await mount();
    const opening = h.open("target");
    await act(async () => root.unmount());
    root = undefined;
    h.requests[0].reject(new Error("offline"));
    await opening;
    expect(h.opened).toEqual([]);
    expect(h.errors()).toBe(0);
  });
});
