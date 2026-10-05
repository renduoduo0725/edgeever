import {
  docToMarkdown,
  markdownToDoc,
  type TiptapDoc,
} from "@edgeever/shared";

export type MarkdownModeSnapshot = {
  memoId: string;
  contentJson: TiptapDoc;
  markdownSource: string;
  hasRichOnlyTableCells: boolean;
};

const normalizeMarkdownSource = (value: string) => value.replace(/\r\n?/g, "\n");

/** Keep harmless punctuation readable in the source editor without changing the shared export codec. */
export const docToEditableMarkdown = (contentJson: TiptapDoc): string => {
  const serialized = docToMarkdown(contentJson);
  const readable = serialized
    .replaceAll("\\[", "[")
    .replaceAll("\\]", "]")
    .replaceAll("&amp;", "&");

  return readable !== serialized
    && JSON.stringify(markdownToDoc(readable)) === JSON.stringify(markdownToDoc(serialized))
    ? readable
    : serialized;
};

const cloneContentJson = (contentJson: TiptapDoc): TiptapDoc =>
  JSON.parse(JSON.stringify(contentJson)) as TiptapDoc;

type ContentNode = {
  type?: string;
  content?: ContentNode[];
  [key: string]: unknown;
};

const isTableCell = (node: ContentNode) =>
  node.type === "tableCell" || node.type === "tableHeader";

const collectTables = (value: unknown): ContentNode[] => {
  const tables: ContentNode[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const contentNode = node as ContentNode;
    if (contentNode.type === "table") {
      tables.push(contentNode);
      return;
    }
    contentNode.content?.forEach(visit);
  };
  visit(value);
  return tables;
};

const collectCells = (table: ContentNode): ContentNode[] => {
  const cells: ContentNode[] = [];
  const visit = (node: ContentNode) => {
    if (isTableCell(node)) {
      cells.push(node);
      return;
    }
    node.content?.forEach(visit);
  };
  visit(table);
  return cells;
};

const nodesEqual = (left: ContentNode, right: ContentNode) =>
  JSON.stringify(left) === JSON.stringify(right);

const hasRichOnlyTableCells = (original: TiptapDoc, projection: TiptapDoc): boolean => {
  const originalTables = collectTables(original);
  const projectedTables = collectTables(projection);
  return originalTables.some((table, tableIndex) => {
    const originalCells = collectCells(table);
    const projectedCells = collectCells(projectedTables[tableIndex] ?? {});
    return originalCells.length !== projectedCells.length
      || originalCells.some((cell, cellIndex) => !nodesEqual(cell, projectedCells[cellIndex] ?? {}));
  });
};

const RICH_CELL_MARKER = "\uE000EDGEEVERRICHCELL\uE001";

const cellText = (cell: ContentNode): string | null => {
  if (cell.content?.length !== 1 || cell.content[0]?.type !== "paragraph") return null;
  const inline = cell.content[0].content ?? [];
  return inline.every((node) => node.type === "text" && typeof node.text === "string")
    ? inline.map((node) => node.text).join("")
    : null;
};

const textNodePaths = (node: ContentNode, path: number[] = []): number[][] => {
  if (node.type === "text" && typeof node.text === "string") return [path];
  return node.content?.flatMap((child, index) => textNodePaths(child, [...path, index])) ?? [];
};

const taskItemPaths = (node: ContentNode, path: number[] = []): number[][] => [
  ...(node.type === "taskItem" && typeof (node.attrs as { checked?: unknown } | undefined)?.checked === "boolean"
    ? [path]
    : []),
  ...(node.content?.flatMap((child, index) => taskItemPaths(child, [...path, index])) ?? []),
];

const nodeAtPath = (node: ContentNode, path: number[]): ContentNode | null =>
  path.reduce<ContentNode | null>((current, index) => current?.content?.[index] ?? null, node);

const projectedCell = (doc: TiptapDoc, tableIndex: number, cellIndex: number): ContentNode | null => {
  const parsed = markdownToDoc(docToMarkdown(doc));
  const table = collectTables(parsed)[tableIndex];
  return table ? collectCells(table)[cellIndex] ?? null : null;
};

/** Change one rich text leaf only when its Markdown projection exactly matches the edited cell. */
const restoreEditedRichCell = (
  original: TiptapDoc,
  originalCell: ContentNode,
  originalProjectionCell: ContentNode,
  editedCell: ContentNode,
  tableIndex: number,
  cellIndex: number,
): ContentNode | null => {
  const before = cellText(originalProjectionCell);
  const after = cellText(editedCell);
  if (before === null || after === null) return null;

  for (const path of textNodePaths(originalCell)) {
    const marked = cloneContentJson(original);
    const markedCell = collectCells(collectTables(marked)[tableIndex]!)[cellIndex]!;
    const markedTextNode = nodeAtPath(markedCell, path);
    const oldText = markedTextNode?.text;
    if (typeof oldText !== "string") continue;
    markedTextNode!.text = RICH_CELL_MARKER;
    const markedText = cellText(projectedCell(marked, tableIndex, cellIndex) ?? {});
    const markerAt = markedText?.indexOf(RICH_CELL_MARKER) ?? -1;
    if (
      markerAt < 0
      || markedText!.indexOf(RICH_CELL_MARKER, markerAt + RICH_CELL_MARKER.length) !== -1
      || markedText!.replace(RICH_CELL_MARKER, oldText) !== before
    ) continue;

    const prefix = markedText!.slice(0, markerAt);
    const suffix = markedText!.slice(markerAt + RICH_CELL_MARKER.length);
    if (!after.startsWith(prefix) || !after.endsWith(suffix)) continue;
    const replacement = after.slice(prefix.length, after.length - suffix.length);
    if (!replacement) continue;

    const candidate = cloneContentJson(original);
    const candidateCell = collectCells(collectTables(candidate)[tableIndex]!)[cellIndex]!;
    nodeAtPath(candidateCell, path)!.text = replacement;
    const projection = projectedCell(candidate, tableIndex, cellIndex);
    if (projection && nodesEqual(projection, editedCell)) return candidateCell;
  }

  for (const path of taskItemPaths(originalCell)) {
    const candidate = cloneContentJson(original);
    const candidateCell = collectCells(collectTables(candidate)[tableIndex]!)[cellIndex]!;
    const taskItem = nodeAtPath(candidateCell, path);
    const attrs = taskItem?.attrs as { checked: boolean } | undefined;
    if (!attrs) continue;
    attrs.checked = !attrs.checked;
    const projection = projectedCell(candidate, tableIndex, cellIndex);
    if (projection && nodesEqual(projection, editedCell)) return candidateCell;
  }

  return null;
};

export type MarkdownModeContentResult = {
  contentJson: TiptapDoc;
  hasUnsafeRichTableEdit: boolean;
};

/**
 * GFM flattens rich table cells. Restore untouched cells and edits that map to
 * exactly one rich text leaf or task checkbox; report every other change so
 * the source editor can reject it before autosave or mode switching.
 */
const restoreRichTableCells = (
  original: TiptapDoc,
  originalProjection: TiptapDoc,
  editedProjection: TiptapDoc,
): MarkdownModeContentResult => {
  const restored = cloneContentJson(editedProjection);
  const originalTables = collectTables(original);
  const projectedTables = collectTables(originalProjection);
  const editedTables = collectTables(restored);

  let hasUnsafeRichTableEdit = false;

  if (originalTables.length !== projectedTables.length || originalTables.length !== editedTables.length) {
    return { contentJson: restored, hasUnsafeRichTableEdit: hasRichOnlyTableCells(original, originalProjection) };
  }

  originalTables.forEach((originalTable, tableIndex) => {
    const projectedTable = projectedTables[tableIndex];
    const editedTable = editedTables[tableIndex];
    if (!projectedTable || !editedTable) return;

    const originalCells = collectCells(originalTable);
    const projectedCells = collectCells(projectedTable);
    const editedCells = collectCells(editedTable);
    if (
      originalCells.length !== projectedCells.length
      || projectedCells.length !== editedCells.length
    ) {
      if (originalCells.some((cell, index) => !nodesEqual(cell, projectedCells[index] ?? {}))) {
        hasUnsafeRichTableEdit = true;
      }
      return;
    }

    originalCells.forEach((originalCell, cellIndex) => {
      if (!nodesEqual(originalCell, projectedCells[cellIndex]!)) {
        const replacement = nodesEqual(projectedCells[cellIndex]!, editedCells[cellIndex]!)
          ? originalCell
          : restoreEditedRichCell(
              original,
              originalCell,
              projectedCells[cellIndex]!,
              editedCells[cellIndex]!,
              tableIndex,
              cellIndex,
            );
        if (!replacement) {
          hasUnsafeRichTableEdit = true;
          return;
        }
        Object.keys(editedCells[cellIndex]!).forEach((key) => {
          delete editedCells[cellIndex]![key];
        });
        Object.assign(
          editedCells[cellIndex]!,
          JSON.parse(JSON.stringify(replacement)) as ContentNode,
        );
      }
    });
  });

  return { contentJson: restored, hasUnsafeRichTableEdit };
};

/**
 * Captures the lossless rich document before exposing its Markdown projection.
 * Markdown cannot represent every valid TipTap tree, so the JSON snapshot must
 * remain authoritative until the user actually changes the source.
 */
export const createMarkdownModeSnapshot = (
  memoId: string,
  contentJson: TiptapDoc,
  markdownSource = docToEditableMarkdown(contentJson),
): MarkdownModeSnapshot => ({
  memoId,
  contentJson: cloneContentJson(contentJson),
  markdownSource,
  hasRichOnlyTableCells: hasRichOnlyTableCells(contentJson, markdownToDoc(markdownSource)),
});

export const isMarkdownSourceUnchanged = (
  snapshot: MarkdownModeSnapshot | null,
  memoId: string | null | undefined,
  markdownSource: string,
) => Boolean(
  snapshot
  && memoId
  && snapshot.memoId === memoId
  && normalizeMarkdownSource(snapshot.markdownSource) === normalizeMarkdownSource(markdownSource)
);

/** Resolve the document used by mode switching, drafts, autosave, and recovery. */
export const analyzeMarkdownModeContent = (
  snapshot: MarkdownModeSnapshot | null,
  memoId: string | null | undefined,
  markdownSource: string,
): MarkdownModeContentResult => {
  if (isMarkdownSourceUnchanged(snapshot, memoId, markdownSource)) {
    return { contentJson: snapshot!.contentJson, hasUnsafeRichTableEdit: false };
  }

  const editedProjection = markdownToDoc(markdownSource);
  if (!snapshot || !memoId || snapshot.memoId !== memoId) {
    return { contentJson: editedProjection, hasUnsafeRichTableEdit: false };
  }

  if (!snapshot.hasRichOnlyTableCells) {
    return { contentJson: editedProjection, hasUnsafeRichTableEdit: false };
  }

  return restoreRichTableCells(
    snapshot.contentJson,
    markdownToDoc(snapshot.markdownSource),
    editedProjection,
  );
};

export const resolveMarkdownModeContent = (
  snapshot: MarkdownModeSnapshot | null,
  memoId: string | null | undefined,
  markdownSource: string,
): TiptapDoc => analyzeMarkdownModeContent(snapshot, memoId, markdownSource).contentJson;

/**
 * After autosave the editor hydrates from JSON. Serialization is lossy (extra
 * blank lines, `&nbsp;` markers). If the incoming document is only a projection
 * of the live buffer, keep the buffer so the caret and keystrokes stay put.
 */
export const shouldKeepLiveMarkdownSource = ({
  snapshot,
  memoId,
  liveMarkdownSource,
  incomingMarkdown,
  incomingContent,
}: {
  snapshot: MarkdownModeSnapshot | null;
  memoId: string | null | undefined;
  liveMarkdownSource: string;
  incomingMarkdown: string;
  incomingContent: TiptapDoc;
}) => {
  if (!snapshot || !memoId || snapshot.memoId !== memoId) {
    return false;
  }

  const live = normalizeMarkdownSource(liveMarkdownSource);
  const incoming = normalizeMarkdownSource(incomingMarkdown);
  if (live === incoming) {
    return true;
  }

  if (nodesEqual(resolveMarkdownModeContent(snapshot, memoId, liveMarkdownSource), incomingContent)) {
    return true;
  }

  // Regenerated Markdown (JSON → Markdown) of equivalent prose must not replace
  // the author's buffer. A real remote/history body has different parsed text.
  return incoming === normalizeMarkdownSource(docToMarkdown(incomingContent))
    && nodesEqual(markdownToDoc(live), markdownToDoc(incoming));
};

/** Restore the exact source the user last had when the rich document was not edited. */
export const selectMarkdownSourceForDocument = (
  snapshot: MarkdownModeSnapshot | null,
  memoId: string | null | undefined,
  contentJson: TiptapDoc,
  serializedMarkdown: string,
) => {
  if (!snapshot || !memoId || snapshot.memoId !== memoId) {
    return serializedMarkdown;
  }

  if (
    nodesEqual(snapshot.contentJson, contentJson)
    || docToMarkdown(snapshot.contentJson) === docToMarkdown(contentJson)
  ) {
    return snapshot.markdownSource;
  }

  return serializedMarkdown;
};
