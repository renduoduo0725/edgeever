import { describe, expect, test } from "bun:test";
import { formatSystemInfoClipboard } from "./system-info-clipboard.ts";

describe("formatSystemInfoClipboard", () => {
  test("builds structured Markdown and HTML tables", () => {
    const formatted = formatSystemInfoClipboard({
      title: "系统信息",
      fieldLabel: "项目",
      valueLabel: "信息",
      groups: [{
        title: "云端实例",
        items: [
          { label: "实例版本", value: "v1.81.0" },
          { label: "实例地址", value: "https://example.com" },
        ],
      }],
    });

    expect(formatted.plainText).toBe([
      "# 系统信息",
      "",
      "## 云端实例",
      "| 项目 | 信息 |",
      "| --- | --- |",
      "| 实例版本 | v1.81.0 |",
      "| 实例地址 | https://example.com |",
    ].join("\n"));
    expect(formatted.html).toContain("<h1>系统信息</h1>");
    expect(formatted.html).toContain("<h2>云端实例</h2>");
    expect(formatted.html).toContain("<table>");
    expect(formatted.html).toContain('<th scope="row">实例版本</th><td>v1.81.0</td>');
  });

  test("escapes clipboard values for both formats", () => {
    const formatted = formatSystemInfoClipboard({
      title: "System info",
      fieldLabel: "Field",
      valueLabel: "Value",
      groups: [{
        title: "Client",
        items: [{ label: "Build | channel", value: "<script>alert('x')</script>\\next" }],
      }],
    });

    expect(formatted.plainText).toContain("Build \\| channel");
    expect(formatted.plainText).toContain("&lt;script&gt;alert('x')&lt;/script&gt;");
    expect(formatted.plainText).toContain("\\\\next");
    expect(formatted.html).not.toContain("<script>");
    expect(formatted.html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;\\next");
  });
});
