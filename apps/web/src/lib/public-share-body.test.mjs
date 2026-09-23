import { describe, expect, test } from "bun:test";
import {
  createDefaultDiagramDocument,
  createDefaultTableDocument,
  diagramFallbackMarkdown,
  markdownToDoc,
  serializeDiagramDocument,
  serializeTableDocument,
  tableFallbackMarkdown,
} from "@edgeever/shared";
import { resolvePublicShareBody } from "./public-share-body";

const shareOf = (contentMarkdown, contentJson = markdownToDoc(contentMarkdown)) => ({
  title: "Shared",
  contentJson,
  contentMarkdown,
  tags: [],
  updatedAt: "2026-01-01T00:00:00.000Z",
  memoShareTokens: {},
});

describe("public share body", () => {
  test.each(["mind-map", "flowchart", "architecture"])("renders a %s visual diagram note from IR, not the Mermaid envelope", (kind) => {
    const document = createDefaultDiagramDocument(kind);
    const markdown = serializeDiagramDocument(document);
    const body = resolvePublicShareBody(
      shareOf(markdown, markdownToDoc(diagramFallbackMarkdown(document))),
      "share-token",
    );
    expect(body.type).toBe("diagram");
    if (body.type === "diagram") expect(body.diagram.kind).toBe(kind);
  });

  test("keeps embedded Mermaid in ordinary rich-text notes on the TipTap path", () => {
    const markdown = "# Note\n\n```mermaid\nflowchart LR\n  A-->B\n```\n";
    const body = resolvePublicShareBody(shareOf(markdown), "share-token");
    expect(body.type).toBe("rich-text");
    if (body.type === "rich-text") {
      expect(body.content.content?.some((node) => node.type === "codeBlock" && node.attrs?.language === "mermaid")).toBe(true);
    }
  });

  test("renders a structured table note as the readable markdown table", () => {
    const document = createDefaultTableDocument();
    const body = resolvePublicShareBody(shareOf(serializeTableDocument(document)), "share-token");
    expect(body.type).toBe("rich-text");
    if (body.type === "rich-text") {
      expect(JSON.stringify(body.content)).not.toContain("edgeever-table-v1");
      expect(body.content.content?.some((node) => node.type === "table")).toBe(true);
    }
  });

  test("falls back to the readable table when the structured-table envelope cannot be parsed", () => {
    const markdown = `${tableFallbackMarkdown(createDefaultTableDocument())}\n\n<!-- edgeever-table-v1:not-json -->`;
    const body = resolvePublicShareBody(shareOf(markdown), "share-token");
    expect(body.type).toBe("rich-text");
    if (body.type === "rich-text") {
      expect(JSON.stringify(body.content)).not.toContain("edgeever-table-v1");
      expect(body.content.content?.some((node) => node.type === "table")).toBe(true);
    }
  });

  test("falls back to the Mermaid fence when the visual-diagram IR cannot be parsed", () => {
    const markdown = `${diagramFallbackMarkdown(createDefaultDiagramDocument("mind-map"))}\n\n<!-- edgeever-diagram-v1:not-json -->`;
    const body = resolvePublicShareBody(shareOf(markdown), "share-token");
    expect(body.type).toBe("rich-text");
    if (body.type === "rich-text") {
      expect(JSON.stringify(body.content)).not.toContain("edgeever-diagram-v1");
      expect(body.content.content?.some((node) => node.type === "codeBlock" && node.attrs?.language === "mermaid")).toBe(true);
    }
  });
});
