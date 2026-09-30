import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function SelectionAiActions({
  onExplain,
  onTranslate,
  onAsk,
}: {
  onExplain: () => void;
  onTranslate: () => void;
  onAsk: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="toolbar"
      aria-label={t("aiAssistant.sidebar.selection.actions")}
      className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-card p-1 shadow-lg"
      data-selection-ai-menu=""
      onMouseDown={(event) => event.preventDefault()}
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-slate-950"
        data-selection-ai-action="explain"
        onClick={onExplain}
      >
        {t("aiAssistant.sidebar.selection.explain")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-slate-950"
        data-selection-ai-action="translate"
        onClick={onTranslate}
      >
        {t("aiAssistant.sidebar.selection.translate")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="font-normal text-slate-500"
        data-selection-ai-action="ask"
        onClick={onAsk}
      >
        {t("aiAssistant.sidebar.selection.ask")}
      </Button>
    </div>
  );
}
