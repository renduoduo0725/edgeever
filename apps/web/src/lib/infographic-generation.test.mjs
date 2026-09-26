import { describe, expect, test } from "bun:test";
import { parseSyntax, getTemplate, getTemplates } from "@antv/infographic";
import {
  buildInfographicSyntax,
  buildOfficialInfographicSyntax,
  generatedInfographicSyntax,
  infographicAgentCandidates,
  inferInfographicFamily,
  inferInfographicKind,
  infographicFamilyChoices,
  officialTemplateFamily,
  parseGeneratedInfographicContent,
  parseGeneratedOfficialData,
  parseGeneratedOfficialSelection,
  parseInfographicEditDecision,
  parseInfographicFamilyDecision,
  resolveInfographicEditSelection,
  resolveInfographicTemplateSelection,
  requestsInfographicLayoutChange,
  requestsInfographicFamilyChange,
  sampleOfficialData,
  selectableInfographicTemplates,
  shortlistOfficialTemplates,
  shouldReplaceExistingInfographic,
  templateForRequest,
} from "./infographic-generation.ts";

describe("infographic generation", () => {
  test("a four-quadrant request produces AntV's compares array", () => {
    const output = '```json\n{"kind":"steps","title":"优先级四象限","items":[{"label":"立即做","description":"重要且紧急"},{"label":"计划做","description":"重要不紧急"},{"label":"委派","description":"紧急不重要"},{"label":"不做","description":"不重要不紧急"}]}\n```';
    const content = parseGeneratedInfographicContent(output, "给我生成一个四象限图");
    expect(inferInfographicKind("给我生成一个四象限图")).toBe("quadrant");
    expect(content?.kind).toBe("quadrant");
    const syntax = generatedInfographicSyntax(content);
    expect(syntax).toContain("infographic compare-quadrant-quarter-simple-card\ndata\n");
    expect(syntax).toContain("  compares\n    - label 立即做");
    const parsed = parseSyntax(syntax);
    expect(parsed.errors).toEqual([]);
    expect(getTemplate(parsed.options.template)).toBeTruthy();
  });

  test("offered styles are real AntV templates and match their data family", () => {
    const official = new Set(getTemplates());
    for (const { id: template, kind } of selectableInfographicTemplates) {
      expect(official.has(template)).toBe(true);
      const items = kind === "quadrant" ? Array.from({ length: 4 }, (_, index) => ({ label: `第${index + 1}项`, description: "说明" }))
        : kind === "comparison" ? [{ label: "A", children: [{ label: "维度", description: "说明" }] }, { label: "B", children: [{ label: "维度", description: "说明" }] }]
        : [{ label: "第一项", description: "说明" }];
      const syntax = buildInfographicSyntax({ template, title: "测试", items });
      expect(parseSyntax(syntax).errors).toEqual([]);
    }
  });

  test("the model can choose a compatible official style but cannot cross data families", () => {
    const request = "生成一个字节和腾讯的对比图";
    const data = { kind: "comparison", template: "compare-binary-horizontal-compact-card-vs", title: "对比", items: [{ label: "字节" }, { label: "腾讯" }] };
    expect(parseGeneratedInfographicContent(JSON.stringify(data), request)?.template).toBe(data.template);
    expect(parseGeneratedInfographicContent(JSON.stringify({ ...data, template: "sequence-steps-simple" }), request)?.template).toBe("compare-binary-horizontal-badge-card-vs");
    expect(parseGeneratedInfographicContent(JSON.stringify({ ...data, items: ["A", "B", "C", "D"] }), "换成圆形四象限图")?.template).toBe("compare-quadrant-quarter-circular");
    expect(parseGeneratedInfographicContent(JSON.stringify({ ...data, kind: "list" }), "生成金字塔清单")?.template).toBe("list-pyramid-compact-card");
  });

  test("a new comparison request replaces an existing quadrant with a side-by-side template", () => {
    const request = "生成一个字节和腾讯的对比图";
    expect(inferInfographicKind(request)).toBe("comparison");
    expect(shouldReplaceExistingInfographic(request, "quadrant")).toBe(true);
    expect(shouldReplaceExistingInfographic("把第二象限标题改短一点", "quadrant")).toBe(false);
    expect(shouldReplaceExistingInfographic("换成紧凑对比图版式", "comparison")).toBe(false);
    const output = JSON.stringify({ kind: "quadrant", title: "字节与腾讯", items: [
      { label: "字节跳动", description: "内容平台与推荐技术", children: [{ label: "主要产品", description: "抖音与今日头条" }, { label: "业务侧重", description: "短视频与广告" }] },
      { label: "腾讯", description: "社交平台与游戏业务", children: [{ label: "主要产品", description: "微信与QQ" }, { label: "业务侧重", description: "社交与游戏" }] },
    ] });
    const content = parseGeneratedInfographicContent(output, request);
    expect(content?.kind).toBe("comparison");
    const syntax = generatedInfographicSyntax(content);
    expect(syntax).toContain("infographic compare-binary-horizontal-badge-card-vs");
    expect(syntax).toContain("  compares\n    - label 字节跳动\n      children\n        - label 字节跳动");
    expect(syntax).toContain("        - label 主要产品\n          desc 抖音与今日头条");
    const parsed = parseSyntax(syntax);
    expect(parsed.errors).toEqual([]);
    expect(getTemplate(parsed.options.template)).toBeTruthy();
  });

  test("malformed model content is rejected before reaching AntV", () => {
    expect(parseGeneratedInfographicContent("Expected array value.", "四象限图")).toBeNull();
    expect(parseGeneratedInfographicContent('{"kind":"quadrant","items":"wrong"}', "四象限图")).toBeNull();
    expect(parseGeneratedInfographicContent('{"kind":"quadrant","items":[{"label":"A"}]}', "四象限图")).toBeNull();
  });

  test("all 276 installed AntV templates accept the shared family data format", () => {
    const templates = getTemplates();
    expect(templates).toHaveLength(276);
    for (const template of templates) {
      const sample = sampleOfficialData(template);
      const syntax = buildOfficialInfographicSyntax(template, sample);
      const parsed = parseSyntax(syntax);
      expect(parsed.errors).toEqual([]);
      expect(parsed.options.template).toBe(template);
      expect(parsed.options.data).toEqual(sample);
      expect(getTemplate(template)).toBeTruthy();
      expect(["chart", "comparison", "hierarchy", "list", "quadrant", "relation", "sequence"]).toContain(officialTemplateFamily(template));
    }
  });

  test("explicit chart and diagram requests resolve to installed templates", () => {
    for (const request of ["饼图", "柱状图", "折线图", "词云", "思维导图", "组织结构", "网络图"]) {
      expect(getTemplates()).toContain(templateForRequest(request));
    }
  });

  test("AI data is checked for the chosen official template before rendering", () => {
    const quadrant = "compare-quadrant-quarter-simple-card";
    const data = sampleOfficialData(quadrant);
    expect(parseGeneratedOfficialData(JSON.stringify({ data }), quadrant)).toEqual(data);
    expect(parseGeneratedOfficialData(JSON.stringify({ data: { ...data, compares: data.compares.slice(0, 3) } }), quadrant)).toBeNull();
    expect(parseGeneratedOfficialData(JSON.stringify({ data: { title: "坏图", values: [{ label: "A", value: "abc" }] } }), "chart-column-simple")).toBeNull();
    expect(parseGeneratedOfficialData(JSON.stringify({ data: { title: "重复节点", nodes: [{ id: "a", label: "A" }, { id: "a", label: "B" }] } }), "relation-network-simple-circle-node")).toBeNull();
    expect(parseGeneratedOfficialData(JSON.stringify({ data: { title: "空关系", nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], relations: [] } }), "relation-network-simple-circle-node")).toBeNull();
    expect(parseGeneratedOfficialData(JSON.stringify({ data: { title: "单侧对比", compares: [{ label: "A", children: [{ label: "业务" }] }, { label: "B" }] } }), "compare-binary-horizontal-badge-card-vs")).toBeNull();
  });

  test("AI can select any installed template while an unknown ID is rejected", () => {
    const templates = getTemplates();
    const selected = templates.find((id) => id.startsWith("hierarchy-mindmap-"));
    const data = sampleOfficialData(selected);
    expect(parseGeneratedOfficialSelection(JSON.stringify({ template: selected, data }), templates)).toEqual({ template: selected, data });
    expect(parseGeneratedOfficialSelection(JSON.stringify({ template: "made-up-template", data }), templates)).toBeNull();
  });

  test("AI shortlist uses the relevant family while every official ID remains directly selectable", () => {
    const templates = getTemplates();
    const comparison = shortlistOfficialTemplates("比较字节和腾讯的产品", templates);
    expect(comparison.length).toBeLessThanOrEqual(12);
    expect(comparison.every((id) => officialTemplateFamily(id) === "comparison")).toBe(true);
    expect(comparison.every((id) => id.endsWith("-vs"))).toBe(true);
    const mindmap = shortlistOfficialTemplates("画思维导图", templates);
    expect(mindmap.every((id) => officialTemplateFamily(id) === "hierarchy")).toBe(true);
    expect(templates).toContain("compare-quadrant-quarter-simple-card");
  });

  test("replacing a comparison subject keeps the existing two-sided template", () => {
    const templates = getTemplates();
    const current = "compare-binary-horizontal-badge-card-vs";
    for (const request of ["把字节给我换成阿里巴巴", "把对比从字节换成阿里巴巴", "把字节改成阿里巴巴，其余不变"]) {
      expect(requestsInfographicLayoutChange(request)).toBe(false);
      expect(shouldReplaceExistingInfographic(request, undefined)).toBe(false);
      expect(resolveInfographicTemplateSelection(request, templates, current)).toEqual({ template: current, candidates: [] });
    }
    const currentData = {
      title: "腾讯 vs 字节跳动 对比",
      compares: [
        { label: "腾讯", children: [{ label: "核心业务", desc: "社交与游戏" }] },
        { label: "字节跳动", children: [{ label: "核心业务", desc: "短视频与推荐" }] },
      ],
    };
    const revisedData = {
      ...currentData,
      title: "腾讯 vs 阿里巴巴 对比",
      compares: [currentData.compares[0], { label: "阿里巴巴", children: [{ label: "核心业务", desc: "电商与云计算" }] }],
    };
    const parsed = parseGeneratedOfficialData(JSON.stringify({ data: revisedData }), current);
    expect(parsed?.compares).toEqual(revisedData.compares);
    const syntax = buildOfficialInfographicSyntax(current, parsed);
    expect(parseSyntax(syntax).options.template).toBe(current);
  });

  test("explicit layout changes can select a new style within the current family", () => {
    const templates = getTemplates();
    const current = "compare-binary-horizontal-badge-card-vs";
    expect(resolveInfographicTemplateSelection("换成紧凑对比图版式", templates, current).template).toBe("compare-binary-horizontal-compact-card-vs");
    const alternative = resolveInfographicTemplateSelection("换个版式", templates, current);
    expect(alternative.template).toBeNull();
    expect(alternative.candidates.length).toBeGreaterThan(0);
    expect(alternative.candidates.every((id) => officialTemplateFamily(id) === "comparison")).toBe(true);
    expect(alternative.candidates).not.toContain(current);
    expect(resolveInfographicTemplateSelection("换个版式，数据保留", templates, current).candidates.every((id) => officialTemplateFamily(id) === "comparison")).toBe(true);
    expect(resolveInfographicTemplateSelection("改成四象限图", templates, current).candidates.every((id) => officialTemplateFamily(id) === "quadrant")).toBe(true);
  });

  test("a chosen semantic family limits template selection before generation", () => {
    const templates = getTemplates();
    expect(inferInfographicFamily("比较腾讯和阿里巴巴")).toBe("comparison");
    expect(inferInfographicFamily("展示季度收入趋势")).toBeNull();
    expect(requestsInfographicFamilyChange("换成更合适的图")).toBe(true);
    expect(resolveInfographicTemplateSelection("展示季度收入趋势", templates, undefined, "chart").candidates.every((id) => officialTemplateFamily(id) === "chart")).toBe(true);
    expect(resolveInfographicTemplateSelection("产品发布的时间线", templates, undefined, "sequence").candidates.every((id) => id.startsWith("sequence-timeline-"))).toBe(true);
  });

  test("AI family decisions are validated and uncertain choices are offered to the user", () => {
    const confident = parseInfographicFamilyDecision('{"family":"comparison","confidence":0.91,"ambiguous":false,"alternatives":["list"]}');
    expect(confident?.family).toBe("comparison");
    expect(infographicFamilyChoices(confident)).toEqual([]);
    const uncertain = parseInfographicFamilyDecision('```json\n{"family":"hierarchy","confidence":0.54,"ambiguous":true,"alternatives":["relation","list","invalid"]}\n```');
    expect(infographicFamilyChoices(uncertain)).toEqual(["hierarchy", "relation", "list"]);
    expect(parseInfographicFamilyDecision('{"family":"made-up","confidence":1,"ambiguous":false,"alternatives":[]}')).toBeNull();
    expect(parseInfographicFamilyDecision('{"family":"list","confidence":1.4,"ambiguous":false,"alternatives":[]}')).toBeNull();
    expect(parseInfographicFamilyDecision('{"family":"list","confidence":0.4,"ambiguous":true,"alternatives":[]}')).toBeNull();
  });

  test("semantic edit decisions preserve a comparison subject edit and switch a timeline request", () => {
    const templates = getTemplates();
    const current = "compare-binary-horizontal-badge-card-vs";
    const keep = parseInfographicEditDecision('{"intent":"keep","family":"comparison","confidence":0.97,"ambiguous":false,"alternatives":[]}');
    expect(keep?.intent).toBe("keep");
    expect(resolveInfographicEditSelection("把字节跳动换成阿里巴巴", templates, current, keep).template).toBe(current);
    const change = parseInfographicEditDecision('{"intent":"change","family":"sequence","confidence":0.93,"ambiguous":false,"alternatives":[]}');
    expect(resolveInfographicEditSelection("按时间顺序展示发展历程", templates, current, change).candidates.every((id) => officialTemplateFamily(id) === "sequence")).toBe(true);
    const layout = parseInfographicEditDecision('{"intent":"layout","family":"list","confidence":0.82,"ambiguous":false,"alternatives":[]}');
    expect(resolveInfographicEditSelection("让画面更紧凑", templates, current, layout).candidates.every((id) => officialTemplateFamily(id) === "comparison")).toBe(true);
    expect(resolveInfographicEditSelection("让画面更紧凑", templates, current, layout).candidates).not.toContain(current);
    expect(resolveInfographicEditSelection("换成紧凑对比图版式", templates, current, layout).template).toBe("compare-binary-horizontal-compact-card-vs");
    expect(parseInfographicEditDecision('{"intent":"unknown","family":"sequence","confidence":1,"ambiguous":false,"alternatives":[]}')).toBeNull();
  });

  test("agent shortlist includes the current template and each semantic family", () => {
    const current = "compare-binary-horizontal-badge-card-vs";
    const candidates = infographicAgentCandidates("把字节跳动换成阿里巴巴", getTemplates(), current);
    expect(candidates[0]).toBe(current);
    expect(candidates.length).toBeLessThanOrEqual(50);
    expect(new Set(candidates.map(officialTemplateFamily))).toEqual(new Set(["chart", "comparison", "hierarchy", "list", "quadrant", "relation", "sequence"]));
  });

  test("development history prioritizes timeline templates over the current comparison", () => {
    const current = "compare-binary-horizontal-badge-card-vs";
    expect(inferInfographicFamily("给我换成字节的发展历程")).toBe("sequence");
    const candidates = infographicAgentCandidates("给我换成字节的发展历程", getTemplates(), current);
    expect(candidates[0].startsWith("sequence-timeline-")).toBe(true);
    expect(candidates).toContain(current);
    expect(shortlistOfficialTemplates("给我换成字节的发展历程", getTemplates(), current, "sequence").every((id) => id.startsWith("sequence-timeline-"))).toBe(true);
  });
});
