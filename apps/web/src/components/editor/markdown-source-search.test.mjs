import { describe, expect, test } from "bun:test";
import { EditorState } from "@codemirror/state";
import { history, isolateHistory, undo, redo } from "@codemirror/commands";
import { getMarkdownSearchMatches, getMarkdownReplacementChanges } from "./markdown-source-search";

const replace = (source, query, replacement) => EditorState.create({ doc: source }).update({
  changes: getMarkdownReplacementChanges(source, query, replacement),
}).state.doc.toString();

describe("Markdown source search", () => {
  test("matches raw escape characters and Markdown syntax literally", () => {
    const source = String.raw`\\alpha \[link\](url) **bold** $& \\beta`;
    expect(getMarkdownSearchMatches(source, "\\\\")).toEqual([{ from: 0, to: 2 }, { from: 34, to: 36 }]);
    expect(replace(source, "\\", "")).toBe("alpha [link](url) **bold** $& beta");
    expect(replace("a\\nb\na\\nb", String.raw`\n`, "!")).toBe("a!b\na!b");
    expect(replace("**bold**", "**", "")).toBe("bold");
  });

  test("keeps query whitespace and replacement special characters", () => {
    expect(replace(" a  b ", " ", "")).toBe("ab");
    expect(replace(" a a ", " a ", "$&\\n")).toBe("$&\\na ");
    expect(replace("Aa aa", "aa", "$1\\")).toBe("$1\\ $1\\");
    expect(getMarkdownSearchMatches("anything", "")).toEqual([]);
    expect(replace("anything", "", "x")).toBe("anything");
  });

  test("uses non-overlapping matches and maintains source offsets after Unicode text", () => {
    expect(getMarkdownSearchMatches("😀aaaa", "aa")).toEqual([{ from: 2, to: 4 }, { from: 4, to: 6 }]);
    expect(replace("😀aaaa", "aa", "b")).toBe("😀bb");
  });

  test("undoes and redoes a whole replacement separately from adjacent typing", () => {
    let state = EditorState.create({ doc: "a\\b\\c", extensions: [history()] });
    const dispatch = (tr) => { state = tr.state; };
    state = state.update({ changes: { from: state.doc.length, insert: "!" }, userEvent: "input.type" }).state;
    state = state.update({
      changes: getMarkdownReplacementChanges(state.doc, "\\", ""),
      annotations: isolateHistory.of("full"),
      userEvent: "input.replace",
    }).state;
    expect(state.doc.toString()).toBe("abc!");
    expect(undo({ state, dispatch })).toBe(true);
    expect(state.doc.toString()).toBe("a\\b\\c!");
    expect(redo({ state, dispatch })).toBe(true);
    expect(state.doc.toString()).toBe("abc!");
    expect(undo({ state, dispatch })).toBe(true);
    expect(undo({ state, dispatch })).toBe(true);
    expect(state.doc.toString()).toBe("a\\b\\c");
  });
});
