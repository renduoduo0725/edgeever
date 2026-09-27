import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import katex from "katex";
import { Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MathFormulaDraft, MathFormulaKind } from "@/components/editor/math-formula";

const renderPreviewHtml = (latex: string, kind: MathFormulaKind) => {
  const trimmed = latex.trim();
  if (!trimmed) return "";
  try {
    return katex.renderToString(trimmed, {
      displayMode: kind === "block",
      throwOnError: false,
      strict: "warn",
      trust: false,
    });
  } catch {
    return "";
  }
};

export const MathFormulaDialog = ({
  open,
  draft,
  onOpenChange,
  onApply,
  onRemove,
}: {
  open: boolean;
  draft: MathFormulaDraft | null;
  onOpenChange: (open: boolean) => void;
  onApply: (draft: MathFormulaDraft) => void;
  onRemove?: () => void;
}) => {
  const { t } = useTranslation();
  const latexId = useId();
  const previewId = useId();
  const latexInputRef = useRef<HTMLTextAreaElement>(null);
  const [kind, setKind] = useState<MathFormulaKind>(draft?.kind ?? "inline");
  const [latex, setLatex] = useState(draft?.latex ?? "");
  const [error, setError] = useState<string | null>(null);
  const editing = typeof draft?.pos === "number";

  useEffect(() => {
    if (!open) return;
    setKind(draft?.kind ?? "inline");
    setLatex(draft?.latex ?? "");
    setError(null);
    const timer = window.setTimeout(() => {
      latexInputRef.current?.focus();
      latexInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draft, open]);

  const previewHtml = useMemo(() => renderPreviewHtml(latex, kind), [kind, latex]);

  const submit = () => {
    if (!latex.trim()) {
      setError(t("mathFormulaDialog.errorEmpty"));
      return;
    }
    onApply({
      kind,
      latex,
      pos: draft?.pos,
      from: draft?.from,
      to: draft?.to,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 px-5 py-5 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2 text-sm leading-6">
            <Sigma className="h-5 w-5 text-slate-700" />
            {editing ? t("mathFormulaDialog.editTitle") : t("mathFormulaDialog.title")}
          </DialogTitle>
          <DialogDescription className="pt-1 leading-5">
            {t("mathFormulaDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {!editing && (
            <div className="flex rounded-md border border-slate-200 p-0.5">
              {(["inline", "block"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    kind === value
                      ? "flex-1 rounded-sm bg-workspace-selection px-3 py-1.5 text-xs font-semibold text-slate-950"
                      : "flex-1 rounded-sm px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  }
                  aria-pressed={kind === value}
                  onClick={() => setKind(value)}
                >
                  {value === "inline" ? t("mathFormulaDialog.inline") : t("mathFormulaDialog.block")}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor={latexId} className="text-xs font-medium text-slate-600">
              {t("mathFormulaDialog.latexLabel")}
            </label>
            <textarea
              ref={latexInputRef}
              id={latexId}
              value={latex}
              rows={3}
              spellCheck={false}
              className="w-full resize-y rounded-md border border-slate-200 bg-card px-3 py-2 font-mono text-sm text-slate-900 outline-none ring-slate-900/15 placeholder:text-slate-400 focus:border-slate-900 focus:ring-2"
              placeholder={t("mathFormulaDialog.latexPlaceholder")}
              aria-invalid={Boolean(error) || undefined}
              onChange={(event) => {
                setLatex(event.target.value);
                if (error) setError(null);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <p id={previewId} className="text-xs font-medium text-slate-600">
              {t("mathFormulaDialog.preview")}
            </p>
            <div
              aria-labelledby={previewId}
              className={
                kind === "block"
                  ? "min-h-16 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-center"
                  : "min-h-12 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-3"
              }
            >
              {latex.trim() ? (
                previewHtml ? (
                  <span dangerouslySetInnerHTML={{ __html: previewHtml }} />
                ) : (
                  <p className="text-xs leading-5 text-rose-700">{t("mathFormulaDialog.previewError")}</p>
                )
              ) : (
                <p className="text-xs leading-5 text-slate-400">{t("mathFormulaDialog.previewEmpty")}</p>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-600" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 border-t border-slate-100 pt-4 sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              {editing && onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  onClick={() => {
                    onRemove();
                    onOpenChange(false);
                  }}
                >
                  {t("mathFormulaDialog.remove")}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="solid">
                {t("mathFormulaDialog.apply")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
