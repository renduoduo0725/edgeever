import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { readAiSidebarAdapter, readAiSidebarSource, type AiSidebarSource } from "@/lib/desktop-acp";
import { BuiltinAgentStatus } from "./BuiltinAgentStatus";

const chipClassName = "ml-auto min-w-0 max-w-[46%] shrink-0 truncate rounded-sm text-right text-[11px] leading-4 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";

export function SidebarAgentModeStatus() {
  const { t } = useTranslation();
  const [source, setSource] = useState<AiSidebarSource>(readAiSidebarSource);
  const [adapterId, setAdapterId] = useState(() => readAiSidebarAdapter()?.id ?? null);

  useEffect(() => {
    const sync = () => {
      setSource(readAiSidebarSource());
      setAdapterId(readAiSidebarAdapter()?.id ?? null);
    };
    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  if (source !== "local") return <BuiltinAgentStatus />;

  const label = adapterId ? t(`aiAssistant.agentSource.${adapterId}`) : t("aiAssistant.sidebar.localStatus");
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={chipClassName} data-ai-local-agent="" tabIndex={0} aria-label={label}>
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs" side="bottom">
          <p>{label}</p>
          <p className="mt-1">{t("aiAssistant.agentSource.localHint")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
