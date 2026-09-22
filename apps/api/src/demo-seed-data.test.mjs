import { describe, expect, test } from "bun:test";
import { parseDiagramDocument } from "@edgeever/shared";
import { computeDiagramLayoutResult } from "../../../packages/shared/src/diagram-layout.ts";
import {
  decodeDemoAttachment,
  DEMO_SEED_ATTACHMENT_RESOURCES,
  DEMO_SEED_MEMOS,
  DEMO_SEED_NOTEBOOKS,
  DEMO_SEED_REVISIONS,
} from "./demo-seed-data.ts";

describe("demo seed catalog", () => {
  test("keeps bilingual memos attached to valid notebooks", () => {
    const notebookIds = new Set(DEMO_SEED_NOTEBOOKS.map((notebook) => notebook.id));
    const memoIds = new Set(DEMO_SEED_MEMOS.map((memo) => memo.id));

    expect(notebookIds.size).toBe(DEMO_SEED_NOTEBOOKS.length);
    expect(memoIds.size).toBe(DEMO_SEED_MEMOS.length);
    expect(memoIds.has("memo_demo_overview")).toBe(true);
    expect(memoIds.has("memo_demo_overview_en")).toBe(true);
    expect(memoIds.has("memo_demo_architecture")).toBe(true);
    expect(memoIds.has("memo_demo_architecture_en")).toBe(true);
    expect(memoIds.has("memo_demo_flowchart")).toBe(true);
    expect(memoIds.has("memo_demo_flowchart_en")).toBe(true);
    expect(memoIds.has("memo_demo_mind_map")).toBe(true);
    expect(memoIds.has("memo_demo_mind_map_en")).toBe(true);
    for (const memo of DEMO_SEED_MEMOS) {
      expect(notebookIds.has(memo.notebookId)).toBe(true);
    }
    for (const revision of DEMO_SEED_REVISIONS) {
      expect(memoIds.has(revision.memoId)).toBe(true);
    }
  });

  test("seeds one editable example for every native diagram kind in each language", () => {
    for (const suffix of ["", "_en"]) {
      const examples = [
        ["architecture", `memo_demo_architecture${suffix}`],
        ["flowchart", `memo_demo_flowchart${suffix}`],
        ["mind-map", `memo_demo_mind_map${suffix}`],
      ];

      for (const [kind, memoId] of examples) {
        const memo = DEMO_SEED_MEMOS.find((candidate) => candidate.id === memoId);
        expect(memo).toBeDefined();
        const diagram = parseDiagramDocument(memo?.markdown);
        expect(diagram).toMatchObject({ kind });
        const cellIds = [...(diagram?.nodes ?? []), ...(diagram?.edges ?? [])].map((cell) => cell.id);
        expect(new Set(cellIds).size).toBe(cellIds.length);
      }
    }
  });

  test("keeps every architecture component inside its labeled system boundary", () => {
    for (const memoId of ["memo_demo_architecture", "memo_demo_architecture_en"]) {
      const memo = DEMO_SEED_MEMOS.find((candidate) => candidate.id === memoId);
      const diagram = parseDiagramDocument(memo?.markdown);
      expect(diagram).toMatchObject({ kind: "architecture" });
      expect(diagram?.nodes).toHaveLength(20);
      expect(diagram?.edges).toHaveLength(9);

      const boundaries = new Map(
        diagram?.nodes.filter((node) => node.shape === "boundary").map((node) => [node.id, node]),
      );
      for (const node of diagram?.nodes.filter((candidate) => candidate.parentId) ?? []) {
        const boundary = boundaries.get(node.parentId);
        expect(boundary).toBeDefined();
        expect(node.x).toBeGreaterThanOrEqual(boundary.x);
        expect(node.y).toBeGreaterThanOrEqual(boundary.y);
        expect(node.x + node.width).toBeLessThanOrEqual(boundary.x + boundary.width);
        expect(node.y + node.height).toBeLessThanOrEqual(boundary.y + boundary.height);
      }
    }
  });

  test("persists the architecture examples in their automatic layout", () => {
    for (const memoId of ["memo_demo_architecture", "memo_demo_architecture_en"]) {
      const memo = DEMO_SEED_MEMOS.find((candidate) => candidate.id === memoId);
      const diagram = parseDiagramDocument(memo?.markdown);
      expect(diagram).toMatchObject({ kind: "architecture" });
      if (!diagram) continue;

      const layout = computeDiagramLayoutResult(diagram);
      for (const node of diagram.nodes) {
        expect({ x: node.x, y: node.y, width: node.width, height: node.height }).toEqual(layout.nodes[node.id]);
      }
    }
  });

  test("keeps every seeded resource decodable and owned by a seeded memo", () => {
    const memoIds = new Set(DEMO_SEED_MEMOS.map((memo) => memo.id));
    const resourceIds = new Set();

    for (const resource of DEMO_SEED_ATTACHMENT_RESOURCES) {
      expect(resourceIds.has(resource.id)).toBe(false);
      resourceIds.add(resource.id);
      expect(memoIds.has(resource.memoId)).toBe(true);
      const bytes = "svg" in resource
        ? new TextEncoder().encode(resource.svg)
        : decodeDemoAttachment(resource);
      expect(bytes.byteLength).toBeGreaterThan(0);
    }
  });
});
