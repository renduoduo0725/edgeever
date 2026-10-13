import { buildOfficialInfographicSyntax } from "./infographic-syntax";
import type { InfographicDocument } from "./infographic";
import { StructuredNoteError } from "./structured-note-error";

/** Supplied by the host's existing AntV runtime, keeping the shared code portable. */
export interface InfographicSyntaxAdapter {
  parse(syntax: string): { options: { template?: string; theme?: string; data?: Record<string, unknown>; [key: string]: unknown }; errors: unknown[]; warnings: unknown[] };
  hasTemplate(template: string): boolean;
  hasTheme(theme: string): boolean;
}
const fail = (message: string): never => { throw new StructuredNoteError("invalid_params", message); };
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const unsafe = new Set(["__proto__", "constructor", "prototype"]);
const validateValue = (value: unknown, depth = 0): void => {
  if (depth > 20) fail("Infographic values exceed the nesting limit");
  if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value === "string" && value.length <= 8000) return;
  if (Array.isArray(value) && value.length <= 500) { value.forEach(item => validateValue(item, depth + 1)); return; }
  if (record(value) && Object.keys(value).length <= 100) {
    for (const [key, entry] of Object.entries(value)) {
      if (unsafe.has(key) || !/^[a-zA-Z][\w-]*$/.test(key)) fail("Unsupported infographic data key");
      validateValue(entry, depth + 1);
    }
    return;
  }
  fail("Infographic values must be finite JSON data within the size limits");
};
const pathInput = (value: unknown): Array<string | number> => {
  if (!Array.isArray(value) || !value.length || value.length > 20 || value.some(key =>
    typeof key === "string" ? unsafe.has(key) || !/^[a-zA-Z][\w-]*$/.test(key) : typeof key !== "number" || !Number.isSafeInteger(key) || key < 0)) fail("Invalid infographic data path");
  return value as Array<string | number>;
};
const member = (value: unknown, key: string | number, mustExist: boolean): Record<string | number, unknown> => {
  if (Array.isArray(value)) {
    if (typeof key !== "number" || key >= value.length) fail("Infographic array index does not exist");
    return value as unknown as Record<string | number, unknown>;
  }
  if (!record(value) || typeof key !== "string" || mustExist && !Object.hasOwn(value, key)) fail("Infographic data path does not exist");
  return value as Record<string | number, unknown>;
};
const stable = (value: unknown): string => JSON.stringify(value, (_key, item) => record(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const validParse = (syntax: string, adapter: InfographicSyntaxAdapter) => {
  const parsed = adapter.parse(syntax);
  if (parsed.errors.length || parsed.warnings.length || !parsed.options.template || !adapter.hasTemplate(parsed.options.template)) {
    fail("Infographic syntax contains unsupported or invalid content; repair it before detail editing");
  }
  return parsed;
};

export const applyInfographicOperations = (current: InfographicDocument, operations: unknown, adapter: InfographicSyntaxAdapter) => {
  if (!Array.isArray(operations) || !operations.length || operations.length > 100) fail("operations must include 1–100 changes");
  const parsed = validParse(current.syntax, adapter);
  if (!record(parsed.options.data)) fail("The infographic has no editable data");
  const data = structuredClone(parsed.options.data as Record<string, unknown>);
  let template = parsed.options.template!;
  let theme = parsed.options.theme;
  for (const value of operations as unknown[]) {
    if (!record(value)) fail("An infographic operation must be an object");
    const op = value as Record<string, unknown>;
    const allowed = op.op === "set_data" ? ["op", "path", "value"]
      : op.op === "remove_data" ? ["op", "path"]
      : op.op === "insert_data" ? ["op", "path", "index", "value"]
      : op.op === "set_template" ? ["op", "template"] : op.op === "set_theme" ? ["op", "theme"] : [];
    if (!allowed.length || Object.keys(op).some(key => !allowed.includes(key))) fail("Unsupported infographic operation or field");
    if (op.op === "set_template") {
      if (typeof op.template !== "string" || !adapter.hasTemplate(op.template)) fail("Unknown infographic template");
      template = op.template as string;
      continue;
    }
    if (op.op === "set_theme") {
      if (typeof op.theme !== "string" || !adapter.hasTheme(op.theme)) fail("Unknown infographic theme");
      theme = op.theme as string;
      continue;
    }
    const path = pathInput(op.path);
    let parent: unknown = data;
    for (const key of path.slice(0, -1)) parent = member(parent, key, true)[key];
    const key = path[path.length - 1];
    const container = member(parent, key, op.op !== "set_data");
    if (op.op === "remove_data") {
      if (Array.isArray(parent)) parent.splice(key as number, 1);
      else delete container[key];
    } else if (op.op === "set_data") {
      validateValue(op.value);
      container[key] = structuredClone(op.value);
    } else {
      const target = container[key];
      if (!Array.isArray(target) || !Number.isSafeInteger(op.index) || (op.index as number) < 0 || (op.index as number) > target.length || target.length >= 500) fail("Invalid infographic insertion index or array");
      validateValue(op.value);
      (target as unknown[]).splice(op.index as number, 0, structuredClone(op.value));
    }
  }
  const lines = current.syntax.split("\n");
  if (template !== parsed.options.template) {
    const index = lines.findIndex(line => /^infographic\s+/.test(line));
    if (index < 0) fail("Infographic template header is missing");
    lines[index] = `infographic ${template}`;
  }
  if (theme !== parsed.options.theme) {
    const index = lines.findIndex(line => /^theme(?:\s|$)/.test(line));
    if (index < 0) lines.push(`theme ${theme}`);
    else lines[index] = `theme ${theme}`; // Preserve all nested theme overrides.
  }
  if (stable(data) !== stable(parsed.options.data)) {
    const indexes = lines.flatMap((line, index) => /^data\s*$/.test(line) ? [index] : []);
    if (indexes.length !== 1) fail("The infographic needs one data section for detail editing");
    const start = indexes[0];
    let end = start + 1;
    while (end < lines.length && (!lines[end].trim() || /^\s/.test(lines[end]))) end++;
    const generated = buildOfficialInfographicSyntax(template, data).split("\n").slice(1);
    lines.splice(start, end - start, ...generated);
  }
  const syntax = lines.join("\n");
  if (syntax.length > 200_000) fail("Infographic syntax exceeds the size limit");
  const verified = validParse(syntax, adapter);
  // The existing builder is intentionally conservative. Never silently drop values
  // it cannot represent (including custom arrays, multiline text or null values).
  const expected = { ...parsed.options, template, ...(theme !== undefined ? { theme } : {}), data };
  if (stable(verified.options) !== stable(expected)) fail("These changes cannot round-trip without losing infographic data or styles");
  return { document: { ...structuredClone(current), syntax }, changed: syntax !== current.syntax };
};
