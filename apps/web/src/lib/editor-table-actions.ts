import type { Editor } from "@tiptap/react";
import { isInTable, selectedRect } from "@tiptap/pm/tables";

const targetsHeaderRow = (editor: Editor) => {
  // CellSelection.from/to describe the head cell, so isActive("tableHeader")
  // misses header rows included elsewhere in a rectangular cell selection.
  const { table, top, bottom } = selectedRect(editor.state);
  for (let rowIndex = top; rowIndex < bottom; rowIndex++) {
    const row = table.child(rowIndex);
    for (let cellIndex = 0; cellIndex < row.childCount; cellIndex++) {
      if (row.child(cellIndex).type.spec.tableRole === "header_cell") return true;
    }
  }
  return false;
};

/** Both menus share commands and the existing header-row protection. */
export const getEditorTableActions = (editor: Editor | null, readOnly: boolean) => {
  const inTable = Boolean(editor && !editor.isDestroyed && editor.isActive("table") && isInTable(editor.state));
  const headerRow = inTable && editor ? targetsHeaderRow(editor) : false;
  const actions = [
    { key: "editorToolbar.addTableRow", command: "addRowAfter" },
    { key: "editorToolbar.deleteTableRow", command: "deleteRow", protectHeader: true },
    { key: "editorToolbar.addTableColumn", command: "addColumnAfter" },
    { key: "editorToolbar.deleteTableColumn", command: "deleteColumn" },
    { key: "editorToolbar.toggleTableHeader", command: "toggleHeaderRow" },
    { key: "editorToolbar.deleteTable", command: "deleteTable", destructive: true },
  ] as const;
  return actions.map((action) => ({
    key: action.key,
    destructive: "destructive" in action,
    disabled: readOnly || !inTable || !editor?.isEditable || ("protectHeader" in action && headerRow),
    run: ({ focus = true }: { focus?: boolean } = {}) => {
      if (!editor || editor.isDestroyed || !editor.isEditable || readOnly || !editor.isActive("table") || !isInTable(editor.state)) return;
      if ("protectHeader" in action && targetsHeaderRow(editor)) return;
      const chain = editor.chain();
      if (focus) chain.focus();
      chain[action.command]().run();
    },
  }));
};
