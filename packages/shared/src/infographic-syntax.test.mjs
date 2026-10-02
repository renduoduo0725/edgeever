import { describe, expect, test } from "bun:test";
import { compileInfographicNote, infographicSyntaxTemplate, parseInfographicDocument, serializeInfographicDocument } from "./index.ts";

describe("infographic note syntax", () => {
  test("compiles a revenue share into a pie infographic", () => {
    const compiled = compileInfographicNote("chart-pie-donut-plain-text", {
      title: "腾讯 2025 年营收占比",
      desc: "图中比例为演示用估算，不代表腾讯官方披露数据。",
      values: [
        { label: "增值服务", value: 52 },
        { label: "金融科技与企业服务", value: 30 },
        { label: "网络广告", value: 16 },
        { label: "其他业务", value: 2 },
      ],
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.title).toBe("腾讯 2025 年营收占比");
    expect(compiled.syntax).toBe(`infographic chart-pie-donut-plain-text
data
  title 腾讯 2025 年营收占比
  desc 图中比例为演示用估算，不代表腾讯官方披露数据。
  values
    - label 增值服务
      value 52
    - label 金融科技与企业服务
      value 30
    - label 网络广告
      value 16
    - label 其他业务
      value 2`);
    expect(infographicSyntaxTemplate(compiled.syntax)).toBe("chart-pie-donut-plain-text");
    expect(parseInfographicDocument(serializeInfographicDocument({ schemaVersion: 1, syntax: compiled.syntax }))?.syntax).toBe(compiled.syntax);
  });

  test("rejects a share chart whose parts are not positive numbers", () => {
    expect(compileInfographicNote("chart-pie-donut-plain-text", {
      title: "占比",
      values: [{ label: "甲", value: -1 }, { label: "乙", value: 2 }],
    })).toMatchObject({ ok: false });
    expect(compileInfographicNote("chart-column-simple", {
      title: "趋势",
      values: [{ label: "甲" }],
    })).toMatchObject({ ok: false });
    expect(compileInfographicNote("not-a-template", { title: "占比", values: [{ label: "甲", value: 1 }] })).toMatchObject({ ok: false });
  });
});
