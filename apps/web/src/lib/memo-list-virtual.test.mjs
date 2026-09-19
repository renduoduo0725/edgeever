import { describe, expect, test } from "bun:test";
import { estimateMemoListItemSize } from "./memo-list-virtual.ts";

describe("memo list virtual size", () => {
  test("uses compact card min-heights as the estimate", () => {
    expect(estimateMemoListItemSize("compact", true)).toBe(80);
    expect(estimateMemoListItemSize("compact", false)).toBe(96);
  });

  test("uses preview card min-heights as the estimate", () => {
    expect(estimateMemoListItemSize("preview", true)).toBe(140);
    expect(estimateMemoListItemSize("preview", false)).toBe(148);
  });
});
