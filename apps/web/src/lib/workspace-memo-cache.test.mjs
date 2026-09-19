import { describe, expect, test } from "bun:test";
import { evictIdleMemoDetails } from "./workspace-memo-cache.ts";

describe("idle memo detail eviction", () => {
  test("drops cached memo bodies except the open note", () => {
    const removed = [];
    const queryClient = {
      removeQueries({ predicate }) {
        for (const query of [
          { queryKey: ["memo", "memo_old", "notebook"] },
          { queryKey: ["memo", "memo_open", "notebook"] },
          { queryKey: ["memos", "notebook"] },
          { queryKey: ["memo-link-search", "q"] },
        ]) {
          if (predicate(query)) removed.push(query.queryKey);
        }
      },
    };

    evictIdleMemoDetails(queryClient, "memo_open");
    expect(removed).toEqual([["memo", "memo_old", "notebook"]]);
  });
});
