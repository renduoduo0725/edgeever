import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("phone preview mermaid", () => {
  test("replaces mermaid source blocks with rendered diagrams", () => {
    const source = readFileSync(new URL("./phone-preview-mermaid.ts", import.meta.url), "utf8");
    expect(source).toContain("pre > code.language-mermaid");
    expect(source).toContain("edgeever-phone-mermaid");
    expect(source).toContain(".edgeever-mermaid-code-block .edgeever-mermaid-svg svg");
  });
});
