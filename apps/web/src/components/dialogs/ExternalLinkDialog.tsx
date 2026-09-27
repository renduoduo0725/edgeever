import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { normalizeExternalLinkHref } from "@/lib/editor-external-link";

export type ExternalLinkDialogValues = {
  href: string;
  text: string;
};

export const ExternalLinkDialog = ({
  open,
  onOpenChange,
  initialHref = "",
  initialText = "",
  canRemove = false,
  showTextField = true,
  onApply,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialHref?: string;
  initialText?: string;
  canRemove?: boolean;
  /** When false, only the URL field is shown (selection already has text). */
  showTextField?: boolean;
  onApply: (values: ExternalLinkDialogValues) => void;
  onRemove?: () => void;
}) => {
  const { t } = useTranslation();
  const hrefId = useId();
  const textId = useId();
  const hrefInputRef = useRef<HTMLInputElement>(null);
  const [href, setHref] = useState(initialHref);
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setHref(initialHref);
    setText(initialText);
    setError(null);
    const timer = window.setTimeout(() => {
      hrefInputRef.current?.focus();
      hrefInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, initialHref, initialText]);

  const submit = () => {
    const normalized = normalizeExternalLinkHref(href);
    if (!normalized.ok) {
      setError(
        normalized.reason === "empty"
          ? t("externalLinkDialog.errorEmpty")
          : normalized.reason === "unsupported"
            ? t("externalLinkDialog.errorUnsupported")
            : t("externalLinkDialog.errorInvalid")
      );
      return;
    }
    onApply({
      href: normalized.href,
      text: text.trim() || normalized.href,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 px-5 py-5 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2 text-sm leading-6">
            <LinkIcon className="h-5 w-5 text-slate-700" />
            {canRemove ? t("externalLinkDialog.editTitle") : t("externalLinkDialog.title")}
          </DialogTitle>
          <DialogDescription className="pt-1 leading-5">
            {t("externalLinkDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor={hrefId} className="text-xs font-medium text-slate-600">
              {t("externalLinkDialog.urlLabel")}
            </label>
            <Input
              ref={hrefInputRef}
              id={hrefId}
              value={href}
              onChange={(event) => {
                setHref(event.target.value);
                if (error) setError(null);
              }}
              placeholder={t("externalLinkDialog.urlPlaceholder")}
              inputMode="url"
              autoComplete="url"
              aria-invalid={Boolean(error) || undefined}
            />
          </div>

          {showTextField && (
            <div className="space-y-1.5">
              <label htmlFor={textId} className="text-xs font-medium text-slate-600">
                {t("externalLinkDialog.textLabel")}
              </label>
              <Input
                id={textId}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={t("externalLinkDialog.textPlaceholder")}
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-600" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 border-t border-slate-100 pt-4 sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              {canRemove && onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  onClick={() => {
                    onRemove();
                    onOpenChange(false);
                  }}
                >
                  {t("externalLinkDialog.remove")}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="solid">
                {t("externalLinkDialog.apply")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
