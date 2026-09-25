import { describe, expect, test } from "bun:test";
import { resourceToMarkdown } from "./markdown-resource-paste.ts";

describe("resourceToMarkdown", () => {
  test("formats uploaded images and attachments without breaking Markdown syntax", () => {
    expect(resourceToMarkdown({ kind: "image", filename: "a[b].png", url: "/api/v1/resources/res_1/blob" }, "fallback.png"))
      .toBe("![a\\[b\\].png](/api/v1/resources/res_1/blob)");
    expect(resourceToMarkdown({ kind: "attachment", filename: null, url: "https://example.com/a(b).pdf" }, "report.pdf"))
      .toBe("[report.pdf](https://example.com/a%28b%29.pdf)");
  });
});
