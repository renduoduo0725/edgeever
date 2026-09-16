import type { QueryClient } from "@tanstack/react-query";
import {
  createExcerpt,
  docToText,
  getDiagramSummary,
  resolveMemoContentDoc,
  type MemoDetail,
  type MemoSummary,
  type Notebook,
} from "@edgeever/shared";
import type { MemoView } from "@/lib/app-helpers";
import type { MemoListQueryData } from "@/lib/memo-list-cache";

export type ListNotebooksQueryData = {
  notebooks: Notebook[];
};

export const memoDetailQueryKey = (memoId: string, view: MemoView) => ["memo", memoId, view] as const;

export const memoToSummary = (memo: MemoDetail): MemoSummary => ({
  id: memo.id,
  notebookId: memo.notebookId,
  title: memo.title,
  excerpt: memo.excerpt || createExcerpt(memo.contentText || docToText(resolveMemoContentDoc(memo.contentJson, memo.contentMarkdown))),
  ...getDiagramSummary(memo.contentMarkdown),
  tags: memo.tags,
  isPinned: memo.isPinned,
  isArchived: memo.isArchived,
  isDeleted: memo.isDeleted,
  revision: memo.revision,
  createdAt: memo.createdAt,
  updatedAt: memo.updatedAt,
  deletedAt: memo.deletedAt,
});

export const cacheMemoDetail = (queryClient: QueryClient, memo: MemoDetail, view: MemoView = memo.isDeleted ? "trash" : "notebook") => {
  queryClient.setQueryData(memoDetailQueryKey(memo.id, view), { memo });
};

export const collectMemoSummariesFromCache = (queryClient: QueryClient, memoIds: Set<string>) => {
  const summaries = new Map<string, MemoSummary>();

  for (const [, current] of queryClient.getQueriesData<MemoListQueryData>({ queryKey: ["memos"] })) {
    for (const page of current?.pages ?? []) {
      for (const memo of page.memos) {
        if (memoIds.has(memo.id) && !summaries.has(memo.id)) {
          summaries.set(memo.id, memo);
        }
      }
    }
  }

  for (const [, current] of queryClient.getQueriesData<{ memo: MemoDetail }>({ queryKey: ["memo"] })) {
    if (current?.memo && memoIds.has(current.memo.id) && !summaries.has(current.memo.id)) {
      summaries.set(current.memo.id, memoToSummary(current.memo));
    }
  }

  return Array.from(summaries.values());
};

export const removeMemoSummariesFromLists = (queryClient: QueryClient, memoIds: Set<string>) => {
  queryClient.setQueriesData<MemoListQueryData>({ queryKey: ["memos"] }, (current) => {
    if (!current) {
      return current;
    }

    let changed = false;
    const pages = current.pages.map((page) => {
      const memos = page.memos.filter((memo) => !memoIds.has(memo.id));

      if (memos.length === page.memos.length) {
        return page;
      }

      changed = true;
      return {
        ...page,
        memos,
        totalCount: Math.max(0, page.totalCount - (page.memos.length - memos.length)),
      };
    });

    return changed ? { ...current, pages } : current;
  });
};

export const clearTrashMemoLists = (queryClient: QueryClient) => {
  for (const [queryKey, current] of queryClient.getQueriesData<MemoListQueryData>({ queryKey: ["memos", "trash"] })) {
    if (!current) {
      continue;
    }

    queryClient.setQueryData(queryKey, {
      ...current,
      pages: current.pages.map((page) => ({ ...page, memos: [], totalCount: 0, nextCursor: null })),
    });
  }
};

export const decrementNotebookMemoCounts = (queryClient: QueryClient, removedMemos: MemoSummary[]) => {
  if (removedMemos.length === 0) {
    return;
  }

  const countsByNotebook = new Map<string, number>();

  for (const memo of removedMemos) {
    if (memo.isDeleted) {
      continue;
    }

    countsByNotebook.set(memo.notebookId, (countsByNotebook.get(memo.notebookId) ?? 0) + 1);
  }

  if (countsByNotebook.size === 0) {
    return;
  }

  queryClient.setQueryData<ListNotebooksQueryData>(["notebooks"], (current) =>
    current
      ? {
          notebooks: current.notebooks.map((notebook) => {
            const removedCount = countsByNotebook.get(notebook.id) ?? 0;
            return removedCount > 0 ? { ...notebook, memoCount: Math.max(0, notebook.memoCount - removedCount) } : notebook;
          }),
        }
      : current
  );
};

export const getAdjacentMemoIdAfterRemoval = (memos: MemoSummary[], removedMemoIds: Set<string>, anchorMemoId: string) => {
  const anchorIndex = memos.findIndex((memo) => memo.id === anchorMemoId);

  if (anchorIndex < 0) {
    return null;
  }

  for (let index = anchorIndex + 1; index < memos.length; index++) {
    const memoId = memos[index]?.id;
    if (memoId && !removedMemoIds.has(memoId)) {
      return memoId;
    }
  }

  for (let index = anchorIndex - 1; index >= 0; index--) {
    const memoId = memos[index]?.id;
    if (memoId && !removedMemoIds.has(memoId)) {
      return memoId;
    }
  }

  return null;
};
