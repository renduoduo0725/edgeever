import { Fragment } from "react";
import { getEditorTableActions } from "@/lib/editor-table-actions";
import { useEditorState, type Editor } from "@tiptap/react";
import { Table } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type EditorTableMenuProps = {
  editor: Editor | null;
  readOnly: boolean;
};

export const EditorTableMenu = ({ editor, readOnly }: EditorTableMenuProps) => {
  const { t } = useTranslation();
  const ready = Boolean(editor && !editor.isDestroyed);
  const tableActiveState = useEditorState({
    editor,
    selector: ({ editor: activeEditor }) => ({
      inTable: activeEditor?.isActive("table") ?? false,
      disabled: getEditorTableActions(activeEditor, readOnly).map((action) => action.disabled),
    }),
  });
  const inTable = Boolean(tableActiveState?.inTable);
  const disabled = readOnly || !ready;

  const run = (command: (activeEditor: Editor) => void) => {
    if (!editor || editor.isDestroyed || readOnly) {
      return;
    }

    command(editor);
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition disabled:pointer-events-none disabled:opacity-40",
                inTable
                  ? "bg-slate-200/80 text-slate-900"
                  : "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              )}
              type="button"
              aria-label={t("editorToolbar.table")}
              aria-pressed={inTable || undefined}
              disabled={disabled}
            >
              <Table aria-hidden="true" className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("editorToolbar.table")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start">
        <DropdownMenuItem disabled={inTable} onSelect={() => run((activeEditor) => activeEditor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}>
          {t("editorToolbar.insertTable")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {getEditorTableActions(editor, readOnly).map((action) => (
          <Fragment key={action.key}>
            {action.destructive ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem disabled={action.disabled} className={action.destructive ? "text-rose-700 focus:text-rose-800" : undefined} onSelect={() => action.run()}>
              {t(action.key)}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
