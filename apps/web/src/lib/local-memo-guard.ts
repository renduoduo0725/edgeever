import type { MemoDetail } from "@edgeever/shared";

/** Synchronous comparison so it can run inside an IndexedDB write transaction. */
const canonical = (value: unknown) => JSON.stringify(value, (_key, item) =>
  item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const memoLocalSnapshot = (memo: MemoDetail) => ({
  revision: memo.revision, contentHash: memo.contentHash, title: memo.title,
  tags: memo.tags, contentMarkdown: memo.contentMarkdown, contentJson: memo.contentJson,
});
export const assertLocalMemoSnapshot = (current: MemoDetail | null, expected: MemoDetail, hasConflict: boolean) => {
  if (!current || current.isDeleted || hasConflict || canonical(memoLocalSnapshot(current)) !== canonical(memoLocalSnapshot(expected))) {
    throw Object.assign(new Error("The note changed locally or has an unresolved sync conflict. Reload or resolve it before editing from a plugin."), { code: "NOTE_CONFLICT" });
  }
};
