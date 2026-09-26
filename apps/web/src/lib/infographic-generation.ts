import { infographicRequestsTimeline } from "@edgeever/shared";

export const INFOGRAPHIC_TEMPLATES = [
  { id: "list-row-simple-horizontal-arrow", label: "simpleList", kind: "steps", hint: "short horizontal process" },
  { id: "sequence-steps-simple", label: "numberedSteps", kind: "steps", hint: "numbered steps" },
  { id: "sequence-horizontal-zigzag-simple", label: "zigzagSteps", kind: "steps", hint: "longer alternating process" },
  { id: "list-column-done-list", label: "verticalList", kind: "list", hint: "checklist" },
  { id: "list-grid-simple", label: "gridList", kind: "list", hint: "parallel ideas in a grid" },
  { id: "list-pyramid-compact-card", label: "pyramidList", kind: "list", hint: "ranked levels or priorities" },
  { id: "sequence-timeline-simple", label: "timeline", kind: "timeline", hint: "simple chronological events" },
  { id: "sequence-timeline-done-list", label: "timelineChecklist", kind: "timeline", hint: "chronological milestones" },
  { id: "sequence-roadmap-vertical-simple", label: "roadmap", kind: "timeline", hint: "vertical roadmap" },
  { id: "compare-binary-horizontal-badge-card-vs", label: "comparison", kind: "comparison", hint: "two subjects with matched aspects and VS divider" },
  { id: "compare-binary-horizontal-compact-card-vs", label: "compactComparison", kind: "comparison", hint: "dense two-sided comparison with VS divider" },
  { id: "compare-binary-horizontal-simple-arrow", label: "arrowComparison", kind: "comparison", hint: "before and after or directional comparison" },
  { id: "compare-quadrant-quarter-simple-card", label: "quadrant", kind: "quadrant", hint: "four labeled quadrants" },
  { id: "compare-quadrant-quarter-circular", label: "circularQuadrant", kind: "quadrant", hint: "four quadrants in a circular style" },
  { id: "quadrant-quarter-simple-card", label: "quadrant", kind: "quadrant", hint: "legacy four quadrants", selectable: false },
] as const;

export type InfographicKind = (typeof INFOGRAPHIC_TEMPLATES)[number]["kind"];
export type InfographicItem = { label: string; description?: string; children?: InfographicItem[] };
export type InfographicContent = {
  kind: InfographicKind;
  template: string;
  title: string;
  description?: string;
  items: InfographicItem[];
};

export const selectableInfographicTemplates = INFOGRAPHIC_TEMPLATES.filter((item) => !("selectable" in item && item.selectable === false));

export const infographicTemplatePrompt = () => selectableInfographicTemplates
  .map((item) => `${item.id} (${item.kind}: ${item.hint})`).join("; ");

export type OfficialTemplateFamily = "chart" | "comparison" | "hierarchy" | "list" | "quadrant" | "relation" | "sequence";
export const INFOGRAPHIC_FAMILIES: OfficialTemplateFamily[] = ["chart", "comparison", "hierarchy", "list", "quadrant", "relation", "sequence"];

export type InfographicFamilyDecision = {
  family: OfficialTemplateFamily;
  confidence: number;
  alternatives: OfficialTemplateFamily[];
  ambiguous: boolean;
};

export type InfographicEditDecision = InfographicFamilyDecision & { intent: "keep" | "layout" | "change" };

export const parseInfographicEditDecision = (output: string): InfographicEditDecision | null => {
  const family = parseInfographicFamilyDecision(output, false);
  if (!family) return null;
  const first = output.indexOf("{");
  const last = output.lastIndexOf("}");
  try {
    const value: unknown = JSON.parse(output.slice(first, last + 1));
    if (!isRecord(value) || !["keep", "layout", "change"].includes(String(value.intent))) return null;
    return { ...family, intent: value.intent as InfographicEditDecision["intent"] };
  } catch { return null; }
};

export const parseInfographicFamilyDecision = (output: string, requireAlternatives = true): InfographicFamilyDecision | null => {
  const first = output.indexOf("{");
  const last = output.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  try {
    const value: unknown = JSON.parse(output.slice(first, last + 1));
    if (!isRecord(value) || !INFOGRAPHIC_FAMILIES.includes(value.family as OfficialTemplateFamily)
      || typeof value.confidence !== "number" || !Number.isFinite(value.confidence)
      || value.confidence < 0 || value.confidence > 1 || typeof value.ambiguous !== "boolean"
      || !Array.isArray(value.alternatives)) return null;
    const alternatives = value.alternatives.filter((family): family is OfficialTemplateFamily =>
      INFOGRAPHIC_FAMILIES.includes(family as OfficialTemplateFamily) && family !== value.family);
    if (requireAlternatives && (value.ambiguous || value.confidence < 0.65) && alternatives.length === 0) return null;
    return { family: value.family as OfficialTemplateFamily, confidence: value.confidence,
      alternatives: [...new Set(alternatives)].slice(0, 2), ambiguous: value.ambiguous };
  } catch { return null; }
};

export const infographicFamilyChoices = (decision: InfographicFamilyDecision) =>
  decision.ambiguous || decision.confidence < 0.65
    ? [decision.family, ...decision.alternatives].slice(0, 3) : [];

export const officialTemplateFamily = (id: string): OfficialTemplateFamily => {
  if (/^(compare-)?quadrant-/.test(id) || id.startsWith("compare-quadrant-")) return "quadrant";
  if (id.startsWith("compare-")) return "comparison";
  if (id.startsWith("hierarchy-")) return "hierarchy";
  if (id.startsWith("relation-")) return "relation";
  if (id.startsWith("chart-")) return "chart";
  if (id.startsWith("sequence-")) return "sequence";
  return "list";
};

export const templateForRequest = (request: string): string | null => {
  if (/(饼图|环形图|pie|donut)/i.test(request)) return "chart-pie-donut-plain-text";
  if (/(柱状图|条形图|bar chart|column chart)/i.test(request)) return "chart-column-simple";
  if (/(折线图|趋势图|line chart)/i.test(request)) return "chart-line-plain-text";
  if (/(词云|word\s*cloud)/i.test(request)) return "chart-wordcloud";
  if (/(思维导图|脑图|mind\s*map)/i.test(request)) return "hierarchy-mindmap-branch-gradient-lined-palette";
  if (/(层级图|组织结构|树状图|hierarchy|org chart)/i.test(request)) return "hierarchy-tree-tech-style-capsule-item";
  if (/(关系图|网络图|relation|network)/i.test(request)) return "relation-network-simple-circle-node";
  return null;
};

export const sampleOfficialData = (template: string): Record<string, unknown> => {
  const family = officialTemplateFamily(template);
  const entry = (label: string, desc: string) => ({ label, desc });
  if (family === "chart") return { title: "示例图表", values: [{ label: "项目 A", value: 40 }, { label: "项目 B", value: 30 }, { label: "项目 C", value: 20 }] };
  if (family === "hierarchy") return { title: "示例层级", root: { label: "主题", children: [entry("分支 A", "说明"), entry("分支 B", "说明")] } };
  if (family === "relation") return { title: "示例关系", nodes: [{ id: "a", label: "节点 A" }, { id: "b", label: "节点 B" }], relations: [{ from: "a", to: "b", direction: "forward" }] };
  if (family === "comparison") {
    const labels = template === "compare-swot" ? ["优势", "劣势", "机会", "威胁"] : ["方案 A", "方案 B"];
    return { title: "示例对比", compares: labels.map((label) => ({ label, children: [entry("维度一", "简短说明"), entry("维度二", "简短说明")] })) };
  }
  if (family === "quadrant") return { title: "示例四象限", compares: ["第一象限", "第二象限", "第三象限", "第四象限"].map((label) => entry(label, "简短说明")) };
  if (family === "sequence") return { title: "示例流程", sequences: [entry("第一步", "简短说明"), entry("第二步", "简短说明"), entry("第三步", "简短说明")] };
  return { title: "示例列表", lists: [entry("项目 A", "简短说明"), entry("项目 B", "简短说明"), entry("项目 C", "简短说明")] };
};

const syntaxScalar = (value: string | number | boolean) => String(value).replace(/\s+/g, " ").trim();

const syntaxEntries = (value: Record<string, unknown>, indent: string): string[] => {
  const lines: string[] = [];
  for (const [key, entry] of Object.entries(value)) {
    if (!/^[a-zA-Z][\w-]*$/.test(key) || entry == null) continue;
    if (Array.isArray(entry)) {
      if (!entry.length) continue;
      lines.push(`${indent}${key}`);
      for (const item of entry) {
        if (!isRecord(item)) continue;
        const firstKey = ["label", "id", "from"].find((candidate) => typeof item[candidate] === "string" && item[candidate]);
        if (!firstKey) continue;
        lines.push(`${indent}  - ${firstKey} ${syntaxScalar(item[firstKey] as string)}`);
        const rest = Object.fromEntries(Object.entries(item).filter(([field]) => field !== firstKey));
        lines.push(...syntaxEntries(rest, `${indent}    `));
      }
    } else if (isRecord(entry)) {
      lines.push(`${indent}${key}`);
      lines.push(...syntaxEntries(entry, `${indent}  `));
    } else if (["string", "number", "boolean"].includes(typeof entry)) {
      lines.push(`${indent}${key} ${syntaxScalar(entry as string | number | boolean)}`);
    }
  }
  return lines;
};

export const buildOfficialInfographicSyntax = (template: string, data: Record<string, unknown>, dark = false) => [
  `infographic ${template}`,
  ...(dark ? ["theme dark"] : []),
  "data",
  ...syntaxEntries(data, "  "),
].join("\n");

const normalizedDatum = (value: unknown, depth = 0): Record<string, unknown> | null => {
  if (!isRecord(value) || depth > 5) return null;
  const result: Record<string, unknown> = {};
  for (const field of ["id", "from", "to", "group", "label", "desc", "direction", "category"]) {
    if (typeof value[field] === "string" && String(value[field]).trim()) result[field] = stringValue(value[field]);
  }
  if (!result.desc && typeof value.description === "string") result.desc = stringValue(value.description);
  if (typeof value.value === "number" && Number.isFinite(value.value)) result.value = value.value;
  if (Array.isArray(value.children)) result.children = value.children.slice(0, 12).map((child) => normalizedDatum(child, depth + 1)).filter(Boolean);
  return Object.keys(result).length ? result : null;
};

export const parseGeneratedOfficialData = (output: string, template: string): Record<string, unknown> | null => {
  const first = output.indexOf("{");
  const last = output.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(output.slice(first, last + 1)); } catch { return null; }
  if (!isRecord(parsed)) return null;
  const source = isRecord(parsed.data) ? parsed.data : parsed;
  const family = officialTemplateFamily(template);
  const field = { chart: "values", comparison: "compares", hierarchy: "root", list: "lists", quadrant: "compares", relation: "nodes", sequence: "sequences" }[family];
  const data: Record<string, unknown> = { title: stringValue(source.title) || "信息图" };
  if (typeof source.desc === "string" || typeof source.description === "string") data.desc = stringValue(source.desc ?? source.description);
  if (family === "hierarchy") {
    const root = normalizedDatum(source.root);
    if (!root?.label) return null;
    data.root = root;
  } else {
    const raw = source[field] ?? source.items;
    if (!Array.isArray(raw)) return null;
    const items = raw.slice(0, family === "quadrant" ? 4 : family === "comparison" ? 4 : 16).map((item) => normalizedDatum(item)).filter((item): item is Record<string, unknown> => Boolean(item));
    if (!items.length || (family === "quadrant" && items.length !== 4) || (template.startsWith("compare-binary-") && items.length !== 2) || (template === "compare-swot" && items.length !== 4)) return null;
    if (family !== "relation" && items.some((item) => !item.label)) return null;
    if (template.startsWith("compare-binary-") && (items.some((item) => !Array.isArray(item.children) || !item.children.length)
      || (items[0].children as unknown[]).length !== (items[1].children as unknown[]).length)) return null;
    if (family === "chart" && items.some((item) => typeof item.value !== "number" || !item.label)) return null;
    if (family === "relation" && (items.some((item) => !item.id || !item.label) || new Set(items.map((item) => item.id)).size !== items.length)) return null;
    data[field] = items;
    if (family === "relation") {
      const ids = new Set(items.map((item) => item.id));
      const relations = Array.isArray(source.relations) ? source.relations.slice(0, 24).map((item) => normalizedDatum(item)).filter((item): item is Record<string, unknown> => Boolean(item?.from && item?.to && ids.has(item.from) && ids.has(item.to))) : [];
      if (items.length > 1 && !relations.length) return null;
      data.relations = relations;
    }
  }
  return data;
};

export const parseGeneratedOfficialSelection = (output: string, templates: string[]) => {
  const first = output.indexOf("{");
  const last = output.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(output.slice(first, last + 1)); } catch { return null; }
  if (!isRecord(parsed) || typeof parsed.template !== "string" || !templates.includes(parsed.template)) return null;
  const data = parseGeneratedOfficialData(output, parsed.template);
  return data ? { template: parsed.template, data } : null;
};

export const shortlistOfficialTemplates = (request: string, templates: string[], currentTemplate?: string, family?: OfficialTemplateFamily) => {
  const requestedFamily: OfficialTemplateFamily = family ?? (templateForRequest(request)?.startsWith("chart-") ? "chart"
    : /(思维导图|脑图|树状图|组织结构|层级|mind\s*map|hierarchy|org chart)/i.test(request) ? "hierarchy"
    : /(关系图|网络图|network|relation)/i.test(request) ? "relation"
    : /(四象限|象限|quadrant)/i.test(request) ? "quadrant"
    : /(对比|比较|差异|swot|\bvs\b|comparison)/i.test(request) ? "comparison"
    : /(步骤|流程|时间线|时间轴|发展历程|发展史|历史沿革|成长历程|路线图|里程碑|step|process|timeline|roadmap)/i.test(request) ? "sequence"
    : /(饼图|柱状图|折线图|图表|chart|graph)/i.test(request) ? "chart"
    : currentTemplate ? officialTemplateFamily(currentTemplate) : "list");
  const words = request.toLowerCase().match(/[a-z]+/g) ?? [];
  const preferred = new Set([templateForRequest(request), ...(!requestsInfographicLayoutChange(request) ? [currentTemplate] : [])].filter(Boolean));
  const candidates = templates.filter((id) => officialTemplateFamily(id) === requestedFamily);
  const comparisonCandidates = requestedFamily === "comparison"
    ? /(swot|优劣势)/i.test(request) ? candidates.filter((id) => id === "compare-swot")
      : /(优缺点|利弊|pros|cons)/i.test(request) ? candidates.filter((id) => id.includes("pros-cons"))
      : /(前后|变化|before|after|箭头)/i.test(request) ? candidates.filter((id) => id.includes("arrow"))
      : candidates.filter((id) => id.endsWith("-vs"))
    : candidates;
  const familyCandidates = comparisonCandidates.length ? comparisonCandidates : candidates;
  const shapedCandidates = requestedFamily === "sequence" && /(时间线|时间轴|发展历程|发展史|历史沿革|成长历程|里程碑|timeline|chronolog)/i.test(request)
    ? familyCandidates.filter((id) => id.startsWith("sequence-timeline-"))
    : requestedFamily === "sequence" && /(路线图|roadmap)/i.test(request)
      ? familyCandidates.filter((id) => id.startsWith("sequence-roadmap-"))
      : familyCandidates;
  const alternatives = requestsInfographicLayoutChange(request)
    ? shapedCandidates.filter((id) => id !== currentTemplate) : shapedCandidates;
  return (alternatives.length ? alternatives : shapedCandidates)
    .map((id, index) => ({ id, score: (preferred.has(id) ? 100 : 0) + words.filter((word) => word.length > 2 && id.includes(word)).length * 8 - index * 0.01 }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 12)
    .map(({ id }) => id);
};

export const infographicAgentCandidates = (request: string, templates: string[], currentTemplate?: string) =>
  [...new Set([
    ...(infographicRequestsTimeline(request) ? shortlistOfficialTemplates(request, templates, currentTemplate, "sequence").slice(0, 6) : []),
    ...(currentTemplate && templates.includes(currentTemplate) ? [currentTemplate] : []),
    ...INFOGRAPHIC_FAMILIES.flatMap((family) => shortlistOfficialTemplates(request, templates, currentTemplate, family).slice(0, 6)),
  ])].slice(0, 50);

const plainLine = (value: string) => value.replace(/\s+/g, " ").trim();

export const buildInfographicSyntax = (input: {
  template: string;
  title: string;
  description?: string;
  items: InfographicItem[];
  dark?: boolean;
}) => {
  const lines = [`infographic ${input.template}`];
  if (input.dark) lines.push("theme dark");
  lines.push("data");
  if (input.title.trim()) lines.push(`  title ${plainLine(input.title)}`);
  if (input.description?.trim()) lines.push(`  desc ${plainLine(input.description)}`);
  if (input.items.length) {
    const comparison = input.template.startsWith("compare-binary-");
    lines.push(input.template.startsWith("sequence-") ? "  sequences" : comparison || /^(compare-)?quadrant-/.test(input.template) ? "  compares" : "  lists");
    for (const item of input.items) {
      lines.push(`    - label ${plainLine(item.label)}`);
      if (comparison) {
        lines.push("      children", `        - label ${plainLine(item.label)}`);
        if (item.description?.trim()) lines.push(`          desc ${plainLine(item.description)}`);
        for (const child of item.children ?? []) {
          lines.push(`        - label ${plainLine(child.label)}`);
          if (child.description?.trim()) lines.push(`          desc ${plainLine(child.description)}`);
        }
      } else if (item.description?.trim()) lines.push(`      desc ${plainLine(item.description)}`);
    }
  }
  return lines.join("\n");
};

export const inferInfographicKind = (request: string): InfographicKind | null => {
  if (/(四象限|象限|swot|quadrant|2\s*[×xX]\s*2)/i.test(request)) return "quadrant";
  if (/(对比|比较|差异|\bvs\.?\b|\bversus\b|compar(?:e|ison))/i.test(request)) return "comparison";
  if (/(时间线|时间轴|发展历程|发展史|历史沿革|成长历程|路线图|里程碑|timeline|chronolog|roadmap)/i.test(request)) return "timeline";
  if (/(步骤|流程|step|process)/i.test(request)) return "steps";
  if (/(清单|列表|金字塔|网格|list|pyramid|grid)/i.test(request)) return "list";
  return null;
};

export const inferInfographicFamily = (request: string): OfficialTemplateFamily | null => {
  const namedTemplate = templateForRequest(request);
  if (namedTemplate) return officialTemplateFamily(namedTemplate);
  const kind = inferInfographicKind(request);
  if (kind === "steps" || kind === "timeline") return "sequence";
  if (kind) return kind;
  if (/(数据可视化|图表|\bchart\b)/i.test(request)) return "chart";
  return null;
};

export const requestsInfographicLayoutChange = (request: string) =>
  /(模板|版式|风格|样式|布局|排版|紧凑|圆形|金字塔|网格|路线图|里程碑|编号|交错|template|layout|style|compact|circular|pyramid|grid|roadmap|milestone|numbered|zigzag)/i.test(request)
  || /(换个|另一种|其他|更合适).{0,8}(图|模板|版式)/i.test(request);

export const requestsInfographicFamilyChange = (request: string) =>
  /(图形类型|图表类型|换个图|另一种图|其他图|更合适的图|different (?:chart|diagram|type))/i.test(request);

const inferInfographicTemplate = (request: string, kind: InfographicKind): string | null => {
  if (kind === "quadrant" && /(圆形|圆环|circular)/i.test(request)) return "compare-quadrant-quarter-circular";
  if (kind === "comparison" && /(紧凑|密集|compact)/i.test(request)) return "compare-binary-horizontal-compact-card-vs";
  if (kind === "comparison" && /(前后|变化|方向|箭头|arrow)/i.test(request)) return "compare-binary-horizontal-simple-arrow";
  if (kind === "timeline" && /(路线图|roadmap)/i.test(request)) return "sequence-roadmap-vertical-simple";
  if (kind === "timeline" && /(里程碑|milestone)/i.test(request)) return "sequence-timeline-done-list";
  if (kind === "list" && /(金字塔|pyramid)/i.test(request)) return "list-pyramid-compact-card";
  if (kind === "list" && /(网格|grid)/i.test(request)) return "list-grid-simple";
  if (kind === "steps" && /(交错|zigzag)/i.test(request)) return "sequence-horizontal-zigzag-simple";
  if (kind === "steps" && /(编号|数字|numbered)/i.test(request)) return "sequence-steps-simple";
  return null;
};

export const resolveInfographicTemplateSelection = (request: string, templates: string[], currentTemplate?: string, family?: OfficialTemplateFamily) => {
  if (family) return { template: null, candidates: shortlistOfficialTemplates(request, templates, currentTemplate, family) };
  const namedTemplate = templates.find((id) => request.includes(id));
  const requestedKind = inferInfographicKind(request);
  const inferredTemplate = templateForRequest(request)
    ?? (requestsInfographicLayoutChange(request) && requestedKind ? inferInfographicTemplate(request, requestedKind) : null);
  const explicitTemplate = namedTemplate ?? (inferredTemplate && templates.includes(inferredTemplate) ? inferredTemplate : null);
  if (explicitTemplate) return { template: explicitTemplate, candidates: [] as string[] };
  const requestedFamily = requestedKind === "steps" || requestedKind === "timeline" ? "sequence" : requestedKind;
  if (currentTemplate && templates.includes(currentTemplate) && !requestsInfographicLayoutChange(request)
    && (!requestedFamily || officialTemplateFamily(currentTemplate) === requestedFamily)) {
    return { template: currentTemplate, candidates: [] as string[] };
  }
  return { template: null, candidates: shortlistOfficialTemplates(request, templates, currentTemplate) };
};

export const resolveInfographicEditSelection = (request: string, templates: string[], currentTemplate: string, decision: InfographicEditDecision) => {
  if (decision.intent === "keep") return { template: currentTemplate, candidates: [] as string[] };
  const family = decision.intent === "layout" ? officialTemplateFamily(currentTemplate) : decision.family;
  if (decision.intent === "layout") {
    const requested = resolveInfographicTemplateSelection(request, templates, currentTemplate);
    if (requested.template && requested.template !== currentTemplate && officialTemplateFamily(requested.template) === family) return requested;
  }
  const selection = resolveInfographicTemplateSelection(request, templates, currentTemplate, family);
  if (decision.intent !== "layout") return selection;
  const alternatives = selection.candidates.filter((id) => id !== currentTemplate);
  return { template: selection.template, candidates: alternatives.length ? alternatives : selection.candidates };
};

export const shouldReplaceExistingInfographic = (request: string, currentKind: InfographicKind | undefined) => {
  if (!currentKind) return /(生成|画|做|重做|重新|全新).{0,40}(图|信息图|对比|比较|时间线|流程)/i.test(request);
  const requestedKind = inferInfographicKind(request);
  if (requestedKind && requestedKind !== currentKind) return true;
  if (/(模板|版式|风格|样式|布局|紧凑|圆形|template|layout|style)/i.test(request) && !/(生成|画|做|重做|重新)/i.test(request)) return false;
  return /(生成|画|做|换成|改成|重做|重新).{0,40}(图|信息图|对比|比较|时间线|流程)/i.test(request);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringValue = (value: unknown) => typeof value === "string" ? plainLine(value).slice(0, 160) : "";
const briefValue = (value: unknown, length: number) => Array.from(stringValue(value)).slice(0, length).join("");

export const parseGeneratedInfographicContent = (output: string, request: string): InfographicContent | null => {
  const first = output.indexOf("{");
  const last = output.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  let root: unknown;
  try { root = JSON.parse(output.slice(first, last + 1)); } catch { return null; }
  if (!isRecord(root)) return null;
  const data = isRecord(root.data) ? root.data : root;
  const rawKind = stringValue(data.kind ?? data.type).toLowerCase();
  const kind = inferInfographicKind(request)
    ?? (INFOGRAPHIC_TEMPLATES.find((item) => item.kind === rawKind)?.kind ?? "steps");
  const requestedTemplate = stringValue(data.template);
  const template = inferInfographicTemplate(request, kind)
    ?? selectableInfographicTemplates.find((item) => item.id === requestedTemplate && item.kind === kind)?.id
    ?? selectableInfographicTemplates.find((item) => item.kind === kind)!.id;
  const rawItems = data.items ?? data.quadrants ?? data.compares ?? data.steps ?? data.lists ?? data.sequences;
  if (!Array.isArray(rawItems)) return null;
  const items = rawItems.slice(0, kind === "quadrant" ? 4 : kind === "comparison" ? 2 : 12).map((value): InfographicItem | null => {
    if (typeof value === "string") return { label: stringValue(value) };
    if (!isRecord(value)) return null;
    const label = kind === "comparison" ? briefValue(value.label ?? value.title ?? value.name, 16) : stringValue(value.label ?? value.title ?? value.name);
    const description = kind === "comparison" ? briefValue(value.description ?? value.desc ?? value.detail, 24) : stringValue(value.description ?? value.desc ?? value.detail);
    const children = kind === "comparison" && Array.isArray(value.children)
      ? value.children.slice(0, 3).map((child): InfographicItem | null => {
        if (!isRecord(child)) return null;
        const childLabel = briefValue(child.label ?? child.title ?? child.name, 12);
        const childDescription = briefValue(child.description ?? child.desc ?? child.detail, 24);
        return childLabel ? { label: childLabel, ...(childDescription ? { description: childDescription } : {}) } : null;
      }).filter((child): child is InfographicItem => Boolean(child))
      : [];
    return label ? { label, ...(description ? { description } : {}), ...(children.length ? { children } : {}) } : null;
  }).filter((value): value is InfographicItem => Boolean(value?.label));
  if (!items.length || (kind === "quadrant" && items.length !== 4) || (kind === "comparison" && items.length !== 2)) return null;
  return {
    kind,
    template,
    title: stringValue(data.title) || (kind === "quadrant" ? "四象限图" : stringValue(request).slice(0, 60)),
    description: stringValue(data.description ?? data.desc),
    items,
  };
};

export const generatedInfographicSyntax = (content: InfographicContent) =>
  buildInfographicSyntax({
    template: content.template,
    title: content.title,
    description: content.description,
    items: content.items,
  });
