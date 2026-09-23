import { Base64 } from "js-base64";

export const TABLE_SCHEMA_VERSION = 1 as const;
export const TABLE_FIELD_LIMIT = 40;
export const TABLE_RECORD_LIMIT = 2000;
export const TABLE_FIELD_TYPES = ["text", "number", "checkbox", "date", "select", "url"] as const;
export const TABLE_FILTER_OPERATORS = ["contains", "eq", "empty", "notEmpty"] as const;

export type TableFieldType = (typeof TABLE_FIELD_TYPES)[number];
export type TableFilterOperator = (typeof TABLE_FILTER_OPERATORS)[number];
export type TableCellValue = string | number | boolean | null;

export type TableField = {
  id: string;
  name: string;
  type: TableFieldType;
  options?: string[];
};

export type TableRecord = {
  id: string;
  cells: Record<string, TableCellValue>;
};

export type TableFilter = {
  fieldId: string;
  operator: TableFilterOperator;
  value?: string;
};

export type TableSort = {
  fieldId: string;
  direction: "asc" | "desc";
};

export type TableView = {
  filters: TableFilter[];
  sort: TableSort | null;
};

export type TableDocument = {
  schemaVersion: typeof TABLE_SCHEMA_VERSION;
  fields: TableField[];
  records: TableRecord[];
  view: TableView;
};

export type TableSeedLabels = {
  name?: string;
  status?: string;
  date?: string;
  sample?: string;
  notStarted?: string;
  inProgress?: string;
  done?: string;
};

export type TableSummaryPreview = {
  fieldCount: number;
  recordCount: number;
  fieldNames: string[];
};

const TABLE_MARKER = "edgeever-table-v1";
const TABLE_COMMENT = new RegExp(`<!--\\s*${TABLE_MARKER}:([\\s\\S]*?)\\s*-->`);
const FIELD_NAME_LIMIT = 80;
const OPTION_LIMIT = 40;
const CELL_TEXT_LIMIT = 2000;

const encodeBase64Url = (value: string) => Base64.encodeURI(value);
const decodeBase64Url = (value: string) => Base64.decode(value);

export const createTableId = (prefix: "fld" | "rec") => {
  const uuid = globalThis.crypto?.randomUUID?.();
  const suffix = uuid ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${suffix}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const cleanName = (value: unknown, fallback: string) => {
  const name = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (name || fallback).slice(0, FIELD_NAME_LIMIT);
};

const cleanOptions = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const options: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const option = item.replace(/\s+/g, " ").trim().slice(0, FIELD_NAME_LIMIT);
    if (!option || options.includes(option)) continue;
    options.push(option);
    if (options.length >= OPTION_LIMIT) break;
  }
  return options;
};

export const coerceTableCell = (field: TableField, value: unknown): TableCellValue => {
  if (field.type === "checkbox") {
    return value === true || value === "true" || value === 1 || value === "1";
  }
  if (field.type === "number") {
    if (value === null || value === undefined || value === "") return null;
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
  }
  if (value === null || value === undefined) return "";
  return String(value).slice(0, CELL_TEXT_LIMIT);
};

const emptyCell = (field: TableField): TableCellValue => coerceTableCell(field, field.type === "checkbox" ? false : null);

const parseField = (value: unknown): TableField | null => {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id || value.id.length > 80) return null;
  if (!TABLE_FIELD_TYPES.includes(value.type as TableFieldType)) return null;
  const type = value.type as TableFieldType;
  const field: TableField = { id: value.id, name: cleanName(value.name, "字段"), type };
  if (type === "select") field.options = cleanOptions(value.options);
  return field;
};

const parseView = (value: unknown, fieldIds: Set<string>): TableView => {
  if (!isRecord(value)) return { filters: [], sort: null };
  const filters: TableFilter[] = [];
  if (Array.isArray(value.filters)) {
    for (const item of value.filters) {
      if (!isRecord(item) || typeof item.fieldId !== "string" || !fieldIds.has(item.fieldId)) continue;
      if (!TABLE_FILTER_OPERATORS.includes(item.operator as TableFilterOperator)) continue;
      const filter: TableFilter = { fieldId: item.fieldId, operator: item.operator as TableFilterOperator };
      if (typeof item.value === "string") filter.value = item.value.slice(0, CELL_TEXT_LIMIT);
      filters.push(filter);
      if (filters.length >= 8) break;
    }
  }
  const sort = isRecord(value.sort)
    && typeof value.sort.fieldId === "string"
    && fieldIds.has(value.sort.fieldId)
    && (value.sort.direction === "asc" || value.sort.direction === "desc")
    ? { fieldId: value.sort.fieldId, direction: value.sort.direction as "asc" | "desc" }
    : null;
  return { filters, sort };
};

export const parseTableDocument = (markdown: string | null | undefined): TableDocument | null => {
  const encoded = markdown?.match(TABLE_COMMENT)?.[1]?.replace(/\s+/g, "");
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const value = JSON.parse(decodeBase64Url(encoded)) as Record<string, unknown>;
    if (value.schemaVersion !== TABLE_SCHEMA_VERSION || !Array.isArray(value.fields) || value.fields.length < 1) return null;
    const fields: TableField[] = [];
    for (const item of value.fields) {
      const field = parseField(item);
      if (!field || fields.some((current) => current.id === field.id)) return null;
      fields.push(field);
    }
    if (!Array.isArray(value.records)) return null;
    const fieldIds = new Set(fields.map((field) => field.id));
    const records: TableRecord[] = [];
    const recordIds = new Set<string>();
    for (const item of value.records) {
      if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 80 || recordIds.has(item.id)) return null;
      recordIds.add(item.id);
      const rawCells = isRecord(item.cells) ? item.cells : {};
      const cells: Record<string, TableCellValue> = {};
      for (const field of fields) cells[field.id] = coerceTableCell(field, rawCells[field.id]);
      records.push({ id: item.id, cells });
    }
    return { schemaVersion: TABLE_SCHEMA_VERSION, fields, records, view: parseView(value.view, fieldIds) };
  } catch {
    return null;
  }
};

export const hasTableDocumentMarker = (markdown: string | null | undefined) =>
  Boolean(markdown?.match(TABLE_COMMENT));

export const stripTableDocumentMarker = (markdown: string | null | undefined) =>
  (markdown ?? "").replace(TABLE_COMMENT, "").trimEnd();

const markdownCell = (field: TableField, value: TableCellValue) => {
  if (value === null || value === undefined || value === "") return "";
  const text = field.type === "checkbox" ? (value === true ? "true" : "false") : String(value);
  return text.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
};

export const tableFallbackMarkdown = (document: TableDocument) => {
  const header = document.fields.map((field) => markdownCell({ ...field, type: "text" }, field.name) || "字段");
  const divider = header.map(() => "---");
  const rows = document.records.map((record) => document.fields.map((field) => markdownCell(field, record.cells[field.id] ?? null)));
  return [header, divider, ...rows].map((row) => `| ${row.join(" | ")} |`).join("\n");
};

export const serializeTableDocument = (document: TableDocument) =>
  `${tableFallbackMarkdown(document)}\n\n<!-- ${TABLE_MARKER}:${encodeBase64Url(JSON.stringify(document))} -->`;

export const createDefaultTableDocument = (labels: TableSeedLabels = {}): TableDocument => {
  const nameId = "fld_name";
  const statusId = "fld_status";
  const dateId = "fld_date";
  const notStarted = labels.notStarted ?? "未开始";
  const inProgress = labels.inProgress ?? "进行中";
  const done = labels.done ?? "完成";
  return {
    schemaVersion: TABLE_SCHEMA_VERSION,
    fields: [
      { id: nameId, name: labels.name ?? "名称", type: "text" },
      { id: statusId, name: labels.status ?? "状态", type: "select", options: [notStarted, inProgress, done] },
      { id: dateId, name: labels.date ?? "日期", type: "date" },
    ],
    records: [{
      id: "rec_sample",
      cells: {
        [nameId]: labels.sample ?? "示例记录",
        [statusId]: notStarted,
        [dateId]: "",
      },
    }],
    view: { filters: [], sort: null },
  };
};

const csvCell = (value: TableCellValue) => {
  const text = value === null || value === undefined ? "" : value === true ? "true" : value === false ? "false" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
};

export const tableDocumentToCsv = (document: TableDocument, records: TableRecord[] = document.records) => {
  const lines = [
    document.fields.map((field) => csvCell(field.name)),
    ...records.map((record) => document.fields.map((field) => csvCell(record.cells[field.id] ?? null))),
  ];
  return `\uFEFF${lines.map((line) => line.join(",")).join("\n")}`;
};

const cellSortText = (field: TableField, value: TableCellValue) => {
  if (value === null || value === undefined || value === "") return null;
  if (field.type === "number") return typeof value === "number" ? value : null;
  if (field.type === "checkbox") return value === true ? 1 : 0;
  return String(value);
};

const matchesFilter = (field: TableField, value: TableCellValue, filter: TableFilter) => {
  const empty = field.type === "checkbox" ? value !== true : value === null || value === "";
  if (filter.operator === "empty") return empty;
  if (filter.operator === "notEmpty") return !empty;
  if (filter.operator === "eq") {
    if (field.type === "number") {
      const expected = Number(filter.value);
      return Number.isFinite(expected) && value === expected;
    }
    if (field.type === "checkbox") return (filter.value === "true") === (value === true);
    return String(value ?? "") === (filter.value ?? "");
  }
  return String(value ?? "").toLocaleLowerCase().includes((filter.value ?? "").trim().toLocaleLowerCase());
};

export const applyTableView = (document: TableDocument, records = document.records) => {
  const fields = new Map(document.fields.map((field) => [field.id, field]));
  const filtered = records.filter((record) => document.view.filters.every((filter) => {
    const field = fields.get(filter.fieldId);
    return field ? matchesFilter(field, record.cells[field.id] ?? null, filter) : true;
  }));
  const sort = document.view.sort ? fields.get(document.view.sort.fieldId) : undefined;
  if (!sort || !document.view.sort) return filtered;
  const direction = document.view.sort.direction === "desc" ? -1 : 1;
  return [...filtered].sort((left, right) => {
    const a = cellSortText(sort, left.cells[sort.id] ?? null);
    const b = cellSortText(sort, right.cells[sort.id] ?? null);
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    if (typeof a === "number" && typeof b === "number") return (a - b) * direction;
    return String(a).localeCompare(String(b)) * direction;
  });
};

export const addTableField = (document: TableDocument, field: TableField): TableDocument => {
  if (document.fields.length >= TABLE_FIELD_LIMIT || document.fields.some((item) => item.id === field.id)) return document;
  const nextField = field.type === "select" ? { ...field, options: field.options ?? [] } : { ...field, options: undefined };
  return {
    ...document,
    fields: [...document.fields, nextField],
    records: document.records.map((record) => ({ ...record, cells: { ...record.cells, [nextField.id]: emptyCell(nextField) } })),
  };
};

export const updateTableField = (document: TableDocument, fieldId: string, patch: Partial<Pick<TableField, "name" | "type" | "options">>): TableDocument => {
  const current = document.fields.find((field) => field.id === fieldId);
  if (!current) return document;
  const next: TableField = {
    ...current,
    name: patch.name === undefined ? current.name : cleanName(patch.name, current.name),
    type: patch.type ?? current.type,
  };
  if (next.type === "select") next.options = cleanOptions(patch.options ?? current.options ?? []);
  return {
    ...document,
    fields: document.fields.map((field) => field.id === fieldId ? next : field),
    records: document.records.map((record) => ({
      ...record,
      cells: { ...record.cells, [fieldId]: coerceTableCell(next, record.cells[fieldId]) },
    })),
  };
};

export const removeTableField = (document: TableDocument, fieldId: string): TableDocument => {
  if (document.fields.length <= 1 || !document.fields.some((field) => field.id === fieldId)) return document;
  const fields = document.fields.filter((field) => field.id !== fieldId);
  const fieldIds = new Set(fields.map((field) => field.id));
  return {
    ...document,
    fields,
    records: document.records.map((record) => ({
      ...record,
      cells: Object.fromEntries(Object.entries(record.cells).filter(([id]) => fieldIds.has(id))),
    })),
    view: {
      filters: document.view.filters.filter((filter) => filter.fieldId !== fieldId),
      sort: document.view.sort?.fieldId === fieldId ? null : document.view.sort,
    },
  };
};

export const addTableRecord = (document: TableDocument, id = createTableId("rec")): TableDocument => {
  if (document.records.length >= TABLE_RECORD_LIMIT || document.records.some((record) => record.id === id)) return document;
  const cells: Record<string, TableCellValue> = {};
  for (const field of document.fields) cells[field.id] = emptyCell(field);
  return { ...document, records: [...document.records, { id, cells }] };
};

export const updateTableCell = (document: TableDocument, recordId: string, fieldId: string, value: unknown): TableDocument => {
  const field = document.fields.find((item) => item.id === fieldId);
  if (!field) return document;
  return {
    ...document,
    records: document.records.map((record) => record.id === recordId
      ? { ...record, cells: { ...record.cells, [fieldId]: coerceTableCell(field, value) } }
      : record),
  };
};

export const removeTableRecord = (document: TableDocument, recordId: string): TableDocument => ({
  ...document,
  records: document.records.filter((record) => record.id !== recordId),
});

export const replaceTableView = (document: TableDocument, view: TableView): TableDocument => ({
  ...document,
  view: parseView(view, new Set(document.fields.map((field) => field.id))),
});

export const getTableSummary = (markdown: string | null | undefined): {
  structuredTable: boolean;
  tablePreview?: TableSummaryPreview;
} => {
  const document = parseTableDocument(markdown);
  if (!document) return { structuredTable: false };
  return {
    structuredTable: true,
    tablePreview: {
      fieldCount: document.fields.length,
      recordCount: document.records.length,
      fieldNames: document.fields.map((field) => field.name).filter(Boolean).slice(0, 4),
    },
  };
};
