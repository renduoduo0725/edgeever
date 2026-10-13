import { describe, expect, test } from "bun:test";
import { AppError } from "./app-error";
import { applyDiagramOperations, parseDiagramMemoIr } from "./mcp-diagram-tools";
import { applyTableSchemaOperations, tableCellPatch } from "./mcp-table-tools";

const diagram = () => ({ schemaVersion: 1, kind: "mind-map", theme: "marine", structure: "tree", nodes: [
  { id: "root", label: "Root", shape: "topic", x: 10, y: 20, width: 100, height: 40 },
  { id: "child", label: "Child", shape: "topic", parentId: "root", x: 210, y: 20, width: 100, height: 40 },
], edges: [{ id: "edge", source: "root", target: "child" }] });
const table = () => ({ schemaVersion: 1, fields: [{ id: "name", name: "Name", type: "text" }], records: [{ id: "row", cells: { name: "Keep" } }], view: { filters: [], sort: null } });

describe("MCP adapters for shared structured operations", () => {
  test("keeps existing diagrams editable with current catalog themes and preserves visual identity", async () => {
    const current = diagram();
    const mutation = await applyDiagramOperations({ operations: [
      { op: "add_node", node: { id: "second", label: "Second", parentId: "root" } },
      { op: "update_node", nodeId: "child", changes: { label: "Edited" } },
      { op: "update_edge", edgeId: "edge", changes: { label: "Connection" } },
    ] }, current);
    expect(mutation.document).toMatchObject({ theme: "marine", structure: "tree" });
    expect(mutation.document.nodes.find(node => node.id === "root")).toMatchObject({ x: 10, y: 20, width: 100, height: 40 });
    expect(mutation.document.edges.find(edge => edge.id === "edge").label).toBe("Connection");
    expect(current).toEqual(diagram());
  });

  test("retains MCP AppError semantics and validates hierarchy cycles and cascades", async () => {
    expect(() => parseDiagramMemoIr({ kind: "architecture", nodes: [{ id: "a", label: "A", parentId: "a", type: "boundary" }] })).toThrow(AppError);
    await expect(applyDiagramOperations({ operations: [{ op: "remove_node", nodeId: "root" }] }, diagram())).rejects.toMatchObject({ code: "invalid_params", status: 400 });
    const current = diagram();
    const result = await applyDiagramOperations({ operations: [
      { op: "add_node", node: { id: "replacement", label: "Replacement" } },
      { op: "remove_node", nodeId: "root", cascade: true },
    ] }, current);
    expect(result.document.nodes.map(node => node.id)).toEqual(["replacement"]);
    expect(result.document.edges).toHaveLength(0);
  });

  test("shares schema validation without mutating the old table", () => {
    const current = table();
    const result = applyTableSchemaOperations(current, [
      { op: "add_field", field: { name: "Status", type: "select", options: ["Open", "Done"] } },
      { op: "update_field", fieldId: "name", changes: { name: "Title" } },
    ]);
    expect(result.fields.map(field => field.name)).toEqual(["Title", "Status"]);
    expect(current).toEqual(table());
    expect(() => applyTableSchemaOperations(current, [{ op: "remove_field", fieldId: "name" }])).toThrow(AppError);
    expect(() => applyTableSchemaOperations(current, [{ op: "add_field", field: { name: "name", type: "text" } }])).toThrow(AppError);
  });

  test("uses the database ownership check for attachment cells and rejects invalid cell types", async () => {
    const current = table();
    current.fields.push({ id: "attachment", name: "File", type: "attachment" });
    const bindings = [];
    const db = { prepare: () => ({ bind: (...args) => { bindings.push(args); return { first: async () => ({ id: "res", filename: "file.pdf", mime_type: "application/pdf", byte_size: 12 }) }; } }) };
    const cells = await tableCellPatch(db, "memo", current, { attachment: ["res"] }, false);
    expect(bindings).toEqual([["res", "memo"]]);
    expect(cells.attachment).toEqual([{ resourceId: "res", filename: "file.pdf", mimeType: "application/pdf", byteSize: 12 }]);
    await expect(tableCellPatch(db, "memo", current, { name: 12 }, false)).rejects.toBeInstanceOf(AppError);
    await expect(tableCellPatch(db, "memo", current, { attachment: ["res", "res"] }, false)).rejects.toMatchObject({ code: "invalid_params" });
  });
});
