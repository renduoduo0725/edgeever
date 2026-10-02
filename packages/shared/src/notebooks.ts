import type { Notebook } from "./types";

export const getNotebookDescendantIds = (notebooks: Notebook[], targetNotebookId: string) => {
  const childrenByParentId = new Map<string, string[]>();

  for (const notebook of notebooks) {
    if (!notebook.parentId) {
      continue;
    }

    const children = childrenByParentId.get(notebook.parentId) ?? [];
    children.push(notebook.id);
    childrenByParentId.set(notebook.parentId, children);
  }

  const descendantIds: string[] = [];
  const visited = new Set<string>();
  const pendingIds = [targetNotebookId];

  while (pendingIds.length > 0) {
    const notebookId = pendingIds.pop();

    if (!notebookId || visited.has(notebookId)) {
      continue;
    }

    visited.add(notebookId);
    descendantIds.push(notebookId);
    pendingIds.push(...(childrenByParentId.get(notebookId) ?? []));
  }

  return descendantIds;
};

// Notebooks whose memos a notebook view lists: the notebook alone, or its
// whole subtree when the account shows descendant notes.
export const getNotebookScopeIds = (notebooks: Notebook[], targetNotebookId: string, includeDescendants: boolean) =>
  includeDescendants ? getNotebookDescendantIds(notebooks, targetNotebookId) : [targetNotebookId];

// Notes stored in a notebook's sub-notebooks (not the notebook itself). Expects
// direct per-notebook counts, as the notebook list endpoints return them.
export const getNotebookDescendantMemoCount = (notebooks: Notebook[], targetNotebookId: string) => {
  const memoCountById = new Map(notebooks.map((notebook) => [notebook.id, notebook.memoCount]));
  return getNotebookDescendantIds(notebooks, targetNotebookId)
    .filter((notebookId) => notebookId !== targetNotebookId)
    .reduce((total, notebookId) => total + (memoCountById.get(notebookId) ?? 0), 0);
};

// A parent notebook shows "direct/total" once descendant notes are hidden, so
// the first number always matches what opening it lists.
export const formatNotebookMemoCount = (
  counts: { directCount: number; totalCount: number; hasChildren: boolean },
  showDescendantNotes: boolean,
) => {
  if (showDescendantNotes) return String(counts.totalCount);
  return counts.hasChildren ? `${counts.directCount}/${counts.totalCount}` : String(counts.directCount);
};
