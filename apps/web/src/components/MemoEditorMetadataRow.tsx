import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Notebook as NotebookIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NotebookMoveOption } from "@/lib/app-helpers";
import type { EdgeEverRepository } from "@/lib/repository";
import { EditorTagPicker } from "@/components/EditorTagPicker";
import { IconTooltip, MobileNotebookSelectSheet } from "@/components/editor/EditorPaneChrome";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type MemoEditorMetadataRowProps = {
  contentMarkdown: string;
  disabled: boolean;
  mobileNotebookPickerOpen: boolean;
  notebookOptions: NotebookMoveOption[];
  notebookUpdatePending: boolean;
  repository: Pick<EdgeEverRepository, "listTags">;
  selectedNotebookId: string;
  tagsText: string;
  title: string;
  trailingActions?: ReactNode;
  rowClassName?: string;
  includeMobileSheet?: boolean;
  onMobileNotebookPickerOpenChange: (open: boolean) => void;
  onNotebookChange: (notebookId: string) => void;
  onTagsChange: (tagsText: string) => void;
};

export const MemoEditorMetadataRow = ({
  contentMarkdown,
  disabled,
  mobileNotebookPickerOpen,
  notebookOptions,
  notebookUpdatePending,
  repository,
  selectedNotebookId,
  tagsText,
  title,
  trailingActions,
  rowClassName,
  includeMobileSheet = true,
  onMobileNotebookPickerOpenChange,
  onNotebookChange,
  onTagsChange,
}: MemoEditorMetadataRowProps) => {
  const { t } = useTranslation();
  const currentNotebookLabel = notebookOptions.find((notebook) => notebook.id === selectedNotebookId)?.name
    ?? t("editor.notebookFallback");
  const rowRef = useRef<HTMLDivElement>(null);
  const [density, setDensity] = useState("full");

  useLayoutEffect(() => {
    const row = rowRef.current;
    const slot = row?.parentElement;
    const input = slot?.querySelector("input");
    if (!row || !slot || !input) return;
    let frame = 0;
    let disposed = false;
    const measure = () => {
      if (!window.matchMedia("(min-width: 640px)").matches) {
        setDensity("full");
        return;
      }
      const style = getComputedStyle(input);
      const context = document.createElement("canvas").getContext("2d");
      if (!context) return;
      context.font = style.font;
      const titleWidth = context.measureText(input.value || input.placeholder).width
        + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 2;
      const leading = input.closest<HTMLElement>("[data-editor-top-row-leading]");
      const titleSlot = input.closest<HTMLElement>("[data-editor-title-slot]");
      const leadingControlsWidth = leading && titleSlot
        ? Math.max(0, leading.getBoundingClientRect().width - titleSlot.getBoundingClientRect().width)
        : 0;
      const slotStyle = getComputedStyle(slot);
      const available = slot.clientWidth - parseFloat(slotStyle.paddingLeft)
        - parseFloat(slotStyle.paddingRight) - (parseFloat(slotStyle.columnGap) || 0);
      // Measure an inert copy at intrinsic width, independent of the current
      // collapsed state, so expanding the pane always restores text.
      const probe = row.cloneNode(true) as HTMLDivElement;
      probe.inert = true;
      probe.setAttribute("aria-hidden", "true");
      probe.removeAttribute("id");
      probe.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
      probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;width:max-content;max-width:none;min-width:0;left:0;top:0";
      slot.appendChild(probe);
      let next = "compact";
      for (const candidate of ["full", "tags", "compact"]) {
        probe.dataset.metadataDensity = candidate;
        if (leadingControlsWidth + titleWidth + probe.getBoundingClientRect().width <= available) {
          next = candidate;
          break;
        }
      }
      probe.remove();
      setDensity(next);
    };
    const schedule = () => {
      if (disposed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(slot);
    observer.observe(slot.parentElement ?? slot);
    document.fonts.ready.then(schedule);
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [title, tagsText, currentNotebookLabel, disabled]);

  return (
    <>
      <div ref={rowRef} data-metadata-density={density} className={cn("flex flex-wrap items-center gap-1.5 sm:gap-2", rowClassName)}>
        <button
          className="flex h-7 min-w-0 max-w-full items-center gap-1 rounded-md border border-transparent bg-transparent px-1.5 text-xs font-medium text-slate-600 outline-none transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-900/10 disabled:opacity-50 sm:hidden"
          type="button"
          disabled={disabled || notebookUpdatePending}
          aria-label={t("editor.currentNotebookAria", { name: currentNotebookLabel })}
          onClick={() => onMobileNotebookPickerOpenChange(true)}
        >
          <span className="min-w-0 truncate">{currentNotebookLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
        <div className="edgeever-editor-notebook-select hidden min-w-7 max-w-[18rem] shrink overflow-hidden sm:block">
          <Select
            value={selectedNotebookId}
            disabled={disabled || notebookUpdatePending}
            onValueChange={onNotebookChange}
          >
            <IconTooltip label={t("editor.currentNotebookAria", { name: currentNotebookLabel })}>
              <SelectTrigger aria-label={t("editor.currentNotebookAria", { name: currentNotebookLabel })} className="edgeever-editor-notebook-trigger h-7 w-auto max-w-full min-w-7 gap-1 overflow-hidden border-transparent bg-transparent px-2 text-xs font-medium text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 [&_svg]:shrink-0 [&>span]:min-w-0 [&>span]:truncate">
                <NotebookIcon className="edgeever-editor-metadata-icon h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <SelectValue placeholder={t("editor.notebookPlaceholder")}>
                  <span className="edgeever-editor-notebook-label min-w-0 truncate">{currentNotebookLabel}</span>
                </SelectValue>
              </SelectTrigger>
            </IconTooltip>
            <SelectContent className="max-h-60 rounded-md border border-slate-200 bg-card py-1 shadow-md">
              {notebookOptions.map((notebook) => (
                <SelectItem key={notebook.id} value={notebook.id}>
                  {notebook.selectLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <EditorTagPicker
          contentMarkdown={contentMarkdown}
          disabled={disabled}
          loadTags={() => repository.listTags()}
          title={title}
          value={tagsText}
          onChange={onTagsChange}
        />
        {trailingActions}
      </div>

      {includeMobileSheet && mobileNotebookPickerOpen ? (
        <MobileNotebookSelectSheet
          isUpdating={notebookUpdatePending}
          options={notebookOptions}
          selectedNotebookId={selectedNotebookId}
          onClose={() => onMobileNotebookPickerOpenChange(false)}
          onSelect={onNotebookChange}
        />
      ) : null}
    </>
  );
};
