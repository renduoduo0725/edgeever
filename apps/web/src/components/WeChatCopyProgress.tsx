import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { LoaderCircle } from "lucide-react";

export const WeChatCopyProgress = () => {
  const { t } = useTranslation();
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex cursor-progress items-center justify-center bg-slate-950/25 px-4">
      <div
        className="flex max-w-full items-center gap-3 rounded-xl bg-card px-5 py-4 text-sm font-medium text-slate-900 shadow-xl"
        role="status"
        aria-live="polite"
      >
        <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-[var(--brand-green)]" aria-hidden="true" />
        <span>{t("editor.copyingToWeChat")}</span>
      </div>
    </div>,
    document.body,
  );
};
