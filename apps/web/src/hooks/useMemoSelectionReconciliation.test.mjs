import { afterEach, describe, expect, test } from "bun:test";
import { act, createElement, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { useMemoLinkNavigation } from "./useMemoLinkNavigation.ts";
import { useMemoSelectionReconciliation } from "./useMemoSelectionReconciliation.ts";

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

const source = { id: "source", notebookId: "A" };
const target = { id: "target-on-later-page", notebookId: "B", isDeleted: false };
const firstB = { id: "first-B", notebookId: "B" };
const firstC = { id: "first-C", notebookId: "C" };

const mount = async (options = {}) => {
  const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(window.document.getElementById("root"));
  const repository = { getMemo: async () => ({ memo: target }) };
  let api;
  let lists = { A: [source], B: [firstB], C: [firstC], empty: [] };

  const Harness = ({ lists }) => {
    const [notebookId, setNotebookId] = useState("A");
    const [selectedMemoId, setSelectedMemoId] = useState(options.initialMemoId === undefined ? source.id : options.initialMemoId);
    const [filter, setFilter] = useState("");
    const memos = useMemo(() => lists[filter || notebookId] ?? [], [lists, filter, notebookId]);
    const pendingOpenedMemoIdRef = useRef(null);
    const pendingCreatedMemoIdRef = useRef(options.pendingCreatedMemoId ?? null);
    const creatingMemoSelectionRef = useRef(false);
    const clearPendingMemoSelection = useMemoSelectionReconciliation({
      memos, selectedMemoId, setSelectedMemoId,
      rendererRecoveryMode: options.rendererRecoveryMode ?? false,
      createdMemoEditId: options.createdMemoEditId ?? null,
      pendingOpenedMemoIdRef, pendingCreatedMemoIdRef, creatingMemoSelectionRef,
    });
    const openLink = useMemoLinkNavigation({
      repository,
      navigationScope: JSON.stringify([notebookId, selectedMemoId, filter]),
      onOpen: (memo) => {
        pendingOpenedMemoIdRef.current = memo.id;
        setNotebookId(memo.notebookId);
        setFilter("");
        setSelectedMemoId(memo.id);
      },
      onError: () => { throw new Error("Unexpected link error"); },
    });
    api = {
      openLink,
      selectNotebook(id) {
        clearPendingMemoSelection();
        setNotebookId(id);
      },
      changeFilter(value) {
        clearPendingMemoSelection();
        setFilter(value);
      },
      notebookId, selectedMemoId,
      pendingId: () => pendingOpenedMemoIdRef.current,
    };
    return createElement("div", null, `${notebookId}:${selectedMemoId ?? "none"}`);
  };
  const render = async () => {
    await act(async () => root.render(createElement(Harness, { lists })));
  };
  await render();
  return {
    state: () => api,
    openTarget: async () => { await act(async () => api.openLink(target.id)); },
    selectNotebook: async (id) => { await act(async () => api.selectNotebook(id)); },
    changeFilter: async (filter) => { await act(async () => api.changeFilter(filter)); },
    updateList: async (key, memos) => { lists = { ...lists, [key]: memos }; await render(); },
  };
};

describe("pending linked-note selection and list reconciliation", () => {
  test("A → B link outside B's first page → C selects C's note without loading more", async () => {
    const h = await mount();
    await h.openTarget();
    expect(h.state().notebookId).toBe("B");
    expect(h.state().selectedMemoId).toBe(target.id);
    expect(h.state().pendingId()).toBe(target.id);

    await h.selectNotebook("C");
    expect(h.state().notebookId).toBe("C");
    expect(h.state().pendingId()).toBeNull();
    expect(h.state().selectedMemoId).toBe(firstC.id);
  });

  test("an empty destination clears the old linked note from the editor", async () => {
    const h = await mount();
    await h.openTarget();
    await h.selectNotebook("empty");
    expect(h.state().pendingId()).toBeNull();
    expect(h.state().selectedMemoId).toBeNull();
  });

  test("explicitly reselecting B releases the guard even when its list is unchanged", async () => {
    const h = await mount();
    await h.openTarget();
    await h.selectNotebook("B");
    expect(h.state().pendingId()).toBeNull();
    expect(h.state().selectedMemoId).toBe(firstB.id);
  });

  test("a deliberate filter change reconciles to that filter's results", async () => {
    const h = await mount();
    const filtered = { id: "matching-B", notebookId: "B" };
    await h.updateList("search-results", [filtered]);
    await h.openTarget();
    await h.changeFilter("search-results");
    expect(h.state().notebookId).toBe("B");
    expect(h.state().pendingId()).toBeNull();
    expect(h.state().selectedMemoId).toBe(filtered.id);
  });

  test("the programmatic link transition stays protected while B loads and paginates", async () => {
    const h = await mount();
    await h.openTarget();
    await h.updateList("B", []);
    expect(h.state().selectedMemoId).toBe(target.id);
    expect(h.state().pendingId()).toBe(target.id);
    await h.updateList("B", [firstB]);
    expect(h.state().selectedMemoId).toBe(target.id);
    expect(h.state().pendingId()).toBe(target.id);
    await h.updateList("B", [firstB, target]);
    expect(h.state().selectedMemoId).toBe(target.id);
    expect(h.state().pendingId()).toBeNull();
  });

  test("ordinary list changes without a pending link retain a visible selected note", async () => {
    const h = await mount();
    await h.selectNotebook("C");
    await h.updateList("C", [{ id: "new-first-C", notebookId: "C" }, firstC]);
    expect(h.state().selectedMemoId).toBe(firstC.id);
  });

  test("renderer recovery never automatically selects the first available note", async () => {
    const h = await mount({ rendererRecoveryMode: true, initialMemoId: null });
    expect(h.state().selectedMemoId).toBeNull();
    await h.updateList("A", [{ id: "another-A", notebookId: "A" }]);
    expect(h.state().selectedMemoId).toBeNull();
  });

  test("an in-flight created note remains selected before its list entry arrives", async () => {
    const h = await mount({ initialMemoId: "new-note", pendingCreatedMemoId: "new-note" });
    expect(h.state().selectedMemoId).toBe("new-note");
    await h.updateList("A", []);
    expect(h.state().selectedMemoId).toBe("new-note");
  });

  test("a created note waiting for editor autofocus is not replaced by the first list note", async () => {
    const h = await mount({ initialMemoId: "new-note", createdMemoEditId: "new-note" });
    expect(h.state().selectedMemoId).toBe("new-note");
    await h.updateList("A", [{ id: "another-A", notebookId: "A" }]);
    expect(h.state().selectedMemoId).toBe("new-note");
  });
});
