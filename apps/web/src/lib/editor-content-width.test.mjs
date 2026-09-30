import { describe, expect, test } from "bun:test";
import { editorContentColumnMaxWidth, editorContentWidthFromStored } from "./editor-content-width.ts";

describe("editor content width", () => {
  test("keeps an explicit width and treats only the old left alignment as wider", () => {
    expect(editorContentWidthFromStored(null, null)).toBe("standard");
    expect(editorContentWidthFromStored(null, "center")).toBe("standard");
    expect(editorContentWidthFromStored(undefined, "start")).toBe("wide");
    expect(editorContentWidthFromStored("wide", "center")).toBe("wide");
    expect(editorContentWidthFromStored("standard", "start")).toBe("standard");
  });

  test("uses the two centered column widths", () => {
    expect(editorContentColumnMaxWidth("standard", "reading")).toBe("880px");
    expect(editorContentColumnMaxWidth("standard", "collapsed")).toBe("1200px");
    expect(editorContentColumnMaxWidth("standard", "focus")).toBe("960px");
    expect(editorContentColumnMaxWidth("wide", "reading")).toBe("1040px");
    expect(editorContentColumnMaxWidth("wide", "collapsed")).toBe("1280px");
    expect(editorContentColumnMaxWidth("wide", "focus")).toBe("1120px");
  });
});
