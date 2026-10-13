import { describe, expect, test } from "bun:test";
import { applyInfographicOperations, StructuredNoteError } from "@edgeever/shared";
import { infographicSyntaxAdapter as adapter } from "./infographic-syntax-adapter";

const document = () => ({ schemaVersion: 1, syntax: `infographic list-grid-simple
width 900
height 600
data
  title Original
  desc Preserve this description
  lists
    - label First
      desc First detail
      icon mdi/star
    - label Second
      desc Second detail
theme dark
  colorBg #123456
  palette #123456 #abcdef
design
  item simple
`, history: [{ id: "turn", prompt: "Create", createdAt: "2026-01-01", kind: "generated", resultTitle: "Original" }] });

describe("lossless infographic detail editing with the installed AntV parser", () => {
  test("changes nested data while preserving template, styles, icons and history", () => {
    const current = document();
    const result = applyInfographicOperations(current, [{ op: "set_data", path: ["lists", 0, "label"], value: "Edited" }], adapter);
    expect(adapter.parse(result.document.syntax).errors).toHaveLength(0);
    expect(adapter.parse(result.document.syntax).options.data.lists).toEqual([
      { label: "Edited", desc: "First detail", icon: "mdi/star" }, { label: "Second", desc: "Second detail" },
    ]);
    expect(result.document.syntax).toContain("theme dark\n  colorBg #123456\n  palette #123456 #abcdef");
    expect(result.document.syntax).toContain("width 900\nheight 600");
    expect(result.document.syntax).toContain("design\n  item simple");
    expect(result.document.history).toEqual(current.history);
    expect(current).toEqual(document());
  });

  test("inserts and removes items in an atomic batch", () => {
    const result = applyInfographicOperations(document(), [
      { op: "insert_data", path: ["lists"], index: 1, value: { label: "New", desc: "Added" } },
      { op: "remove_data", path: ["lists", 0] },
      { op: "remove_data", path: ["desc"] },
    ], adapter);
    const data = adapter.parse(result.document.syntax).options.data;
    expect(data.lists.map(item => item.label)).toEqual(["New", "Second"]);
    expect(data.desc).toBeUndefined();
  });

  test("changes themes and templates only when explicitly requested and preserves overrides", () => {
    const result = applyInfographicOperations(document(), [
      { op: "set_theme", theme: "light" },
      { op: "set_template", template: "list-column-done-list" },
    ], adapter);
    expect(adapter.parse(result.document.syntax).options).toMatchObject({ template: "list-column-done-list", theme: "light", themeConfig: { colorBg: "#123456", palette: ["#123456", "#abcdef"] } });
    expect(result.document.syntax).toContain("  icon mdi/star");
  });

  test("rejects invalid paths, prototypes, nonfinite numbers, unknown templates and partial batches", () => {
    for (const op of [
      { op: "set_data", path: ["lists", 9, "label"], value: "Wrong" },
      { op: "set_data", path: ["__proto__", "polluted"], value: true },
      { op: "set_data", path: ["title"], value: NaN },
      { op: "insert_data", path: ["lists"], index: 9, value: { label: "Wrong" } },
      { op: "set_template", template: "not-a-template" },
      { op: "set_theme", theme: "not-a-theme" },
    ]) {
      const current = document();
      expect(() => applyInfographicOperations(current, [{ op: "set_data", path: ["title"], value: "Must not apply" }, op], adapter)).toThrow(StructuredNoteError);
      expect(current).toEqual(document());
    }
    expect({}.polluted).toBeUndefined();
  });

  test("rejects changes the syntax builder cannot represent instead of silently dropping them", () => {
    for (const value of [null, "First\nSecond", [{ custom: "no identifying field" }]]) {
      expect(() => applyInfographicOperations(document(), [{ op: "set_data", path: ["title"], value }], adapter)).toThrow();
    }
  });

  test("leaves unchanged syntax byte-for-byte and validates unsupported originals", () => {
    const current = document();
    expect(applyInfographicOperations(current, [{ op: "set_data", path: ["title"], value: "Original" }], adapter)).toEqual({ document: current, changed: false });
    expect(() => applyInfographicOperations({ schemaVersion: 1, syntax: "invalid syntax" }, [{ op: "set_theme", theme: "dark" }], adapter)).toThrow();
  });
});
