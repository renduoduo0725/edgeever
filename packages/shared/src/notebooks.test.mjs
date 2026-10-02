import { describe, expect, test } from "bun:test";
import { formatNotebookMemoCount, getNotebookDescendantIds, getNotebookDescendantMemoCount, getNotebookScopeIds } from "./notebooks.ts";

const notebook = (id, parentId, memoCount = 0) => ({
  id,
  parentId,
  name: id,
  slug: null,
  icon: null,
  color: null,
  sortOrder: 0,
  memoCount,
  lastMemoUpdatedAt: null,
  createdAt: "",
  updatedAt: "",
});

describe("getNotebookDescendantIds", () => {
  test("includes the selected notebook and descendants at every depth", () => {
    const notebooks = [
      notebook("root", null),
      notebook("child", "root"),
      notebook("grandchild", "child"),
      notebook("other", null),
    ];

    expect(new Set(getNotebookDescendantIds(notebooks, "root"))).toEqual(
      new Set(["root", "child", "grandchild"])
    );
  });

  test("does not loop forever if imported data contains a cycle", () => {
    const notebooks = [notebook("first", "second"), notebook("second", "first")];

    expect(new Set(getNotebookDescendantIds(notebooks, "first"))).toEqual(new Set(["first", "second"]));
  });
});

describe("getNotebookScopeIds", () => {
  const notebooks = [notebook("root", null), notebook("child", "root"), notebook("grandchild", "child")];

  test("covers the whole subtree when descendant notes are shown", () => {
    expect(new Set(getNotebookScopeIds(notebooks, "root", true))).toEqual(new Set(["root", "child", "grandchild"]));
  });

  test("covers only the notebook itself when descendant notes are hidden", () => {
    expect(getNotebookScopeIds(notebooks, "root", false)).toEqual(["root"]);
  });
});

describe("formatNotebookMemoCount", () => {
  test("keeps the aggregated total when descendant notes are shown", () => {
    expect(formatNotebookMemoCount({ directCount: 2, totalCount: 7, hasChildren: true }, true)).toBe("7");
  });

  test("shows direct/total for a parent when descendant notes are hidden", () => {
    expect(formatNotebookMemoCount({ directCount: 2, totalCount: 7, hasChildren: true }, false)).toBe("2/7");
  });

  test("shows a single number for a leaf when descendant notes are hidden", () => {
    expect(formatNotebookMemoCount({ directCount: 2, totalCount: 2, hasChildren: false }, false)).toBe("2");
  });
});

describe("getNotebookDescendantMemoCount", () => {
  test("sums notes in sub-notebooks at every depth but not the notebook itself", () => {
    const notebooks = [
      notebook("root", null, 2),
      notebook("child", "root", 3),
      notebook("grandchild", "child", 1),
      notebook("other", null, 9),
    ];

    expect(getNotebookDescendantMemoCount(notebooks, "root")).toBe(4);
    expect(getNotebookDescendantMemoCount(notebooks, "grandchild")).toBe(0);
  });
});
