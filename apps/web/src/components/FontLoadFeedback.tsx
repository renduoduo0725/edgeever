import { CircleAlert, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { FontLoadStatus } from "@/lib/font-load-state";

export const FontLoadIcon = ({ status }: { status: FontLoadStatus }) => {
  if (status === "loading") return <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none" />;
  if (status === "error") return <CircleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-red-600" />;
  return null;
};

/** Kept outside SelectTrigger/SelectItem so retry is a real keyboard-accessible button. */
export const FontLoadFeedback = ({ status, onRetry }: { status: FontLoadStatus; onRetry: () => void }) => {
  const { t } = useTranslation();
  if (status === "idle" || status === "ready") return null;
  return <div className="flex min-h-6 items-center gap-1.5 text-xs text-slate-500">
    <span role="status" aria-live="polite" className="flex items-center gap-1.5">
      <FontLoadIcon status={status} />
      {t(`fontLoad.${status}`)}
    </span>
    {status === "error" ? <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onRetry}>{t("fontLoad.retry")}</Button> : null}
  </div>;
};
