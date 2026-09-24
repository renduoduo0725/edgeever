import { describe, expect, test } from "bun:test";
import { markdownToDoc } from "./content.ts";
import {
  addTableField,
  addTableRecord,
  applyTableView,
  createDefaultTableDocument,
  listTableAttachmentResourceIds,
  tableAttachmentUrl,
  hasTableDocumentMarker,
  parseTableDocument,
  removeTableField,
  replaceTableView,
  serializeTableDocument,
  stripTableDocumentMarker,
  tableDocumentToCsv,
  tableFallbackMarkdown,
  updateTableCell,
  updateTableField,
  getTableSummary,
} from "./table.ts";

describe("structured table documents", () => {
  test("round-trips fields, records, filters, and sort through the markdown envelope", () => {
    const seeded = createDefaultTableDocument();
    const withView = replaceTableView(updateTableCell(seeded, "rec_sample", "fld_name", "阅读清单"), {
      filters: [{ fieldId: "fld_status", operator: "eq", value: "未开始" }],
      sort: { fieldId: "fld_name", direction: "asc" },
    });
    const markdown = serializeTableDocument(withView);
    expect(hasTableDocumentMarker(markdown)).toBe(true);
    expect(stripTableDocumentMarker(markdown)).toBe(tableFallbackMarkdown(withView));
    expect(parseTableDocument(markdown)).toEqual(withView);
    expect(markdownToDoc(tableFallbackMarkdown(withView)).content?.some((node) => node.type === "table")).toBe(true);
    expect(JSON.stringify(markdownToDoc(stripTableDocumentMarker(markdown)))).not.toContain("edgeever-table-v1");
  });

  test("rejects a broken envelope without dropping the readable table", () => {
    const markdown = `${tableFallbackMarkdown(createDefaultTableDocument())}\n\n<!-- edgeever-table-v1:not-json -->`;
    expect(parseTableDocument(markdown)).toBeNull();
    expect(hasTableDocumentMarker(markdown)).toBe(true);
    expect(stripTableDocumentMarker(markdown)).toContain("| 名称 |");
    expect(getTableSummary(markdown)).toEqual({ structuredTable: false });
  });

  test("filters, sorts, and keeps an ordinary markdown table untouched", () => {
    let document = createDefaultTableDocument();
    document = addTableRecord(document, "rec_next");
    document = updateTableCell(document, "rec_next", "fld_name", "已完成的书");
    document = updateTableCell(document, "rec_next", "fld_status", "完成");
    document = updateTableCell(document, "rec_next", "fld_date", "2026-09-01");
    document = replaceTableView(document, {
      filters: [{ fieldId: "fld_name", operator: "contains", value: "书" }],
      sort: { fieldId: "fld_date", direction: "desc" },
    });
    expect(applyTableView(document).map((record) => record.id)).toEqual(["rec_next"]);
    expect(parseTableDocument("| 名称 |\n| --- |\n| 普通表格 |")).toBeNull();
  });

  test("coerces cells when a field type changes and refuses to remove the last field", () => {
    const document = updateTableField(createDefaultTableDocument(), "fld_name", { type: "number" });
    expect(document.records[0]?.cells.fld_name).toBeNull();
    const onlyName = removeTableField(removeTableField(document, "fld_status"), "fld_date");
    expect(removeTableField(onlyName, "fld_name").fields.map((field) => field.id)).toEqual(["fld_name"]);
  });

  test("exports csv for the rows currently in view and escapes commas", () => {
    const document = updateTableCell(createDefaultTableDocument(), "rec_sample", "fld_name", "甲,乙");
    expect(tableDocumentToCsv(document)).toContain('"甲,乙"');
    expect(tableDocumentToCsv(document).charCodeAt(0)).toBe(0xfeff);
  });

  test("summarizes a table note for the memo list", () => {
    expect(getTableSummary(serializeTableDocument(createDefaultTableDocument()))).toEqual({
      structuredTable: true,
      tablePreview: { fieldCount: 3, recordCount: 1, fieldNames: ["名称", "状态", "日期"] },
    });
  });

  test("adds a field onto every existing record", () => {
    const document = addTableField(createDefaultTableDocument(), { id: "fld_url", name: "链接", type: "url" });
    expect(document.records[0]?.cells.fld_url).toBe("");
    expect(document.fields.at(-1)?.name).toBe("链接");
  });

  test("stores attachment references and writes filename links into the readable table", () => {
    const files = [
      { resourceId: "res_brief", filename: "brief.pdf", mimeType: "application/pdf", byteSize: 12 },
      { resourceId: "res_shot", filename: "shot.png", mimeType: "image/png", byteSize: 34 },
    ];
    let document = addTableField(createDefaultTableDocument(), { id: "fld_files", name: "附件", type: "attachment" });
    document = updateTableCell(document, "rec_sample", "fld_files", files);
    expect(document.records[0]?.cells.fld_files).toEqual(files);
    expect(listTableAttachmentResourceIds(document)).toEqual(new Set(["res_brief", "res_shot"]));
    const markdown = tableFallbackMarkdown(document);
    expect(markdown).toContain(`[brief.pdf](${tableAttachmentUrl("res_brief")})`);
    expect(markdown).toContain(`[shot.png](${tableAttachmentUrl("res_shot")})`);
    expect(parseTableDocument(serializeTableDocument(document))?.records[0]?.cells.fld_files).toEqual(files);
    expect(tableDocumentToCsv(document)).toContain("brief.pdf; shot.png");
    const filled = replaceTableView(document, { filters: [{ fieldId: "fld_files", operator: "notEmpty" }], sort: null });
    expect(applyTableView(filled)).toHaveLength(1);
    const empty = updateTableCell(document, "rec_sample", "fld_files", []);
    expect(applyTableView(replaceTableView(empty, { filters: [{ fieldId: "fld_files", operator: "empty" }], sort: null }))).toHaveLength(1);
  });

  test("keeps ten unique attachments and turns a removed attachment field back into text", () => {
    const files = Array.from({ length: 12 }, (_, index) => ({
      resourceId: `res_${index}`,
      filename: `file-${index}.txt`,
      mimeType: "text/plain",
      byteSize: index,
    }));
    files.push({ resourceId: "res_0", filename: "duplicate.txt", mimeType: "text/plain", byteSize: 1 });
    let document = addTableField(createDefaultTableDocument(), { id: "fld_files", name: "附件", type: "attachment" });
    document = updateTableCell(document, "rec_sample", "fld_files", files);
    expect(document.records[0]?.cells.fld_files).toHaveLength(10);
    document = updateTableField(document, "fld_files", { type: "text" });
    expect(document.records[0]?.cells.fld_files).toContain("file-0.txt");
    expect(listTableAttachmentResourceIds(document).size).toBe(0);
  });
});
