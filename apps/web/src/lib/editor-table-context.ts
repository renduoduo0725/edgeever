import type { EditorView } from "@tiptap/pm/view";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";

/** Right-click inside a selection preserves it; elsewhere it targets the clicked cell. */
export const selectTableContextTarget = (view: EditorView, cell: HTMLElement, coordinates?: { left: number; top: number }) => {
  if (!view.dom.contains(cell) || !view.editable) return false;
  const cellContentPos = view.posAtDOM(cell, 0);
  if (cellContentPos < 1 || cellContentPos > view.state.doc.content.size) return false;
  const cellNode = view.state.doc.nodeAt(cellContentPos - 1);
  if (!cellNode || !["cell", "header_cell"].includes(cellNode.type.spec.tableRole)) return false;
  const cellEnd = cellContentPos + cellNode.content.size;
  const { selection } = view.state;
  const hit = coordinates ? view.posAtCoords(coordinates)?.pos : selection.from;
  const pos = hit != null && hit >= cellContentPos && hit <= cellEnd
    ? hit : cellContentPos;
  let insideSelection = !selection.empty && pos >= selection.from && pos <= selection.to;
  if (selection instanceof CellSelection) {
    insideSelection = false;
    selection.forEachCell((_node, cellPos) => {
      if (cellPos + 1 === cellContentPos) insideSelection = true;
    });
  }
  if (!insideSelection) {
    // Searching forward from the content-end boundary would select the next
    // cell. Search back into this cell and reject unusable node-view targets.
    const next = TextSelection.near(view.state.doc.resolve(pos), pos === cellEnd ? -1 : 1);
    if (next.from < cellContentPos || next.to > cellEnd) return false;
    view.dispatch(view.state.tr.setSelection(next));
  }
  return true;
};

/** Legacy mouse contextmenu events may omit pointerType; remember the initiating pointer. */
export const isMouseTableContextEvent = (
  event: { shiftKey: boolean; pointerType?: string; sourceCapabilities?: { firesTouchEvents?: boolean } | null },
  lastPointerType: string | null,
) => !event.shiftKey && !event.sourceCapabilities?.firesTouchEvents
  && (event.pointerType || lastPointerType) === "mouse";
