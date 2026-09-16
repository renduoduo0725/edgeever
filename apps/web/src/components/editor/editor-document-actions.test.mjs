import { describe, expect, test } from "bun:test";
import { dispatchMemoDocumentAction, resolveEditorExportContent } from "./editor-document-actions.ts";

const richDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
};

const readyEditor = {
  isDestroyed: false,
  extensionManager: {},
  getJSON: () => richDoc,
};

describe("resolveEditorExportContent", () => {
  test("uses the live TipTap document in rich-text mode", () => {
    expect(resolveEditorExportContent({
      editor: readyEditor,
      getMobilePlainTextValue: () => "plain",
      markdownSource: "source",
      useMarkdownSourceEditor: false,
      useMobilePlainTextEditor: false,
    })).toEqual({
      document: richDoc,
      markdown: "hello",
    });
  });

  test("parses Markdown source when the Markdown editor is active", () => {
    const content = resolveEditorExportContent({
      editor: readyEditor,
      getMobilePlainTextValue: () => "plain",
      markdownSource: "from-source",
      useMarkdownSourceEditor: true,
      useMobilePlainTextEditor: false,
    });
    expect(content?.markdown).toBe("from-source");
    expect(content?.document.content[0].content[0].text).toBe("from-source");
  });

  test("prefers the mobile plain-text buffer over Markdown source", () => {
    const content = resolveEditorExportContent({
      editor: readyEditor,
      getMobilePlainTextValue: () => "from-plain",
      markdownSource: "from-source",
      useMarkdownSourceEditor: true,
      useMobilePlainTextEditor: true,
    });
    expect(content?.markdown).toBe("from-plain");
  });

  test("returns null when the editor is not ready", () => {
    expect(resolveEditorExportContent({
      editor: null,
      getMobilePlainTextValue: () => "plain",
      markdownSource: "source",
      useMarkdownSourceEditor: false,
      useMobilePlainTextEditor: false,
    })).toBeNull();
  });
});

describe("dispatchMemoDocumentAction", () => {
  test("routes each document action to a single handler", () => {
    const calls = [];
    const handlers = {
      exportHtml: () => calls.push("html"),
      exportMarkdown: () => calls.push("markdown"),
      exportPdf: (printWindow) => calls.push(["pdf", printWindow]),
      saveAsTemplate: () => calls.push("template"),
      share: () => calls.push("share"),
      shareImage: () => calls.push("image"),
    };

    dispatchMemoDocumentAction("share", handlers);
    dispatchMemoDocumentAction("export-markdown", handlers);
    dispatchMemoDocumentAction("export-html", handlers);
    dispatchMemoDocumentAction("export-pdf", handlers, null);
    dispatchMemoDocumentAction("share-image", handlers);
    dispatchMemoDocumentAction("save-as-template", handlers);

    expect(calls).toEqual(["share", "markdown", "html", ["pdf", null], "image", "template"]);
  });
});
