import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { resolveBuiltinAgentModel } from "./builtin-agent-model";

export function BuiltinAgentStatus() {
  const { i18n, t } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const settingsQuery = useQuery({
    queryKey: ["ai-settings", locale],
    queryFn: () => api.getAiSettings(locale),
    staleTime: 30_000,
  });
  const mode = t("aiAssistant.agentSource.builtin");
  const model = settingsQuery.isSuccess ? resolveBuiltinAgentModel(settingsQuery.data) : null;
  const modelText = model?.label ?? (settingsQuery.isSuccess ? t("aiModel.noDefaultModel") : null);
  const label = modelText ? `${mode} · ${modelText}` : mode;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="ml-auto min-w-0 max-w-[46%] shrink-0 truncate rounded-sm text-right text-[11px] leading-4 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            data-ai-builtin-agent=""
            tabIndex={0}
            aria-label={label}
          >
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs" side="bottom">
          <p>{mode}</p>
          <p className="mt-1">{t("aiAssistant.agentSource.builtinHint")}</p>
          {model ? <p className="mt-1">{model.label}</p> : null}
          {model && model.modelId !== model.label ? <p className="mt-1">{model.modelId}</p> : null}
          {model?.unavailable ? <p className="mt-1">{t("aiModel.defaultUnavailable")}</p> : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
