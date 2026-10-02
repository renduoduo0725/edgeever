// AntV infographic syntax shared by the editor and the companion.
// The editor's generation tests accept this exact text shape.

export type OfficialTemplateFamily = "chart" | "comparison" | "hierarchy" | "list" | "quadrant" | "relation" | "sequence";

export const INFOGRAPHIC_NOTE_TEMPLATES = [
  "chart-pie-donut-plain-text",
  "chart-column-simple",
  "chart-line-plain-text",
  "compare-binary-horizontal-badge-card-vs",
  "compare-quadrant-quarter-simple-card",
  "sequence-timeline-rounded-rect-node",
  "sequence-steps-simple",
  "list-grid-simple",
  "hierarchy-tree-tech-style-capsule-item",
  "relation-network-simple-circle-node",
] as const;

export type InfographicNoteTemplate = (typeof INFOGRAPHIC_NOTE_TEMPLATES)[number];

export const isInfographicNoteTemplate = (value: string): value is InfographicNoteTemplate =>
  (INFOGRAPHIC_NOTE_TEMPLATES as readonly string[]).includes(value);

export const officialTemplateFamily = (id: string): OfficialTemplateFamily => {
  if (/^(compare-)?quadrant-/.test(id) || id.startsWith("compare-quadrant-")) return "quadrant";
  if (id.startsWith("compare-")) return "comparison";
  if (id.startsWith("hierarchy-")) return "hierarchy";
  if (id.startsWith("relation-")) return "relation";
  if (id.startsWith("chart-")) return "chart";
  if (id.startsWith("sequence-")) return "sequence";
  return "list";
};

export const infographicSyntaxTemplate = (syntax: string) =>
  /^infographic\s+([a-z0-9-]+)/.exec(syntax)?.[1] ?? "";

const plainLine = (value: string) => value.replace(/\s+/g, " ").trim();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringValue = (value: unknown) => typeof value === "string" ? plainLine(value).slice(0, 160) : "";

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
  if (Array.isArray(value.children)) {
    result.children = value.children.slice(0, 12).map((child) => normalizedDatum(child, depth + 1)).filter((child): child is Record<string, unknown> => Boolean(child));
  }
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

const FAMILY_REQUIREMENTS: Record<OfficialTemplateFamily, string> = {
  chart: "Chart infographics need data.values: 1–12 items with a label and a finite number value.",
  comparison: "Comparison infographics need data.compares: exactly 2 items, each with a label and the same number of labeled children.",
  quadrant: "Quadrant infographics need data.compares: exactly 4 items with labels.",
  sequence: "Sequence infographics need data.sequences: 1–12 items with labels.",
  list: "List infographics need data.lists: 1–12 items with labels.",
  hierarchy: "Hierarchy infographics need data.root with a label.",
  relation: "Relation infographics need data.nodes with unique ids and labels, plus data.relations connecting them when there is more than one node.",
};

export type CompiledInfographicNote = { ok: true; syntax: string; title: string } | { ok: false; message: string };

export const compileInfographicNote = (template: string, data: unknown): CompiledInfographicNote => {
  if (!isInfographicNoteTemplate(template)) {
    return { ok: false, message: "Choose a template from the create_infographic_memo list." };
  }
  if (!isRecord(data)) return { ok: false, message: FAMILY_REQUIREMENTS[officialTemplateFamily(template)] };
  const parsed = parseGeneratedOfficialData(JSON.stringify({ data }), template);
  if (!parsed) return { ok: false, message: FAMILY_REQUIREMENTS[officialTemplateFamily(template)] };
  if (template.startsWith("chart-pie-")) {
    const values = parsed.values as Array<{ value: number }>;
    if (values.some((item) => item.value < 0) || values.reduce((sum, item) => sum + item.value, 0) <= 0) {
      return { ok: false, message: "A share infographic needs data.values with positive numbers." };
    }
  }
  return { ok: true, syntax: buildOfficialInfographicSyntax(template, parsed), title: String(parsed.title) };
};
