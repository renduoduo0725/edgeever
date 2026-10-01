import { CollapsibleContent } from "@/components/ui/collapsible";
import { Reasoning, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AiSidebarMessage } from "./AiSidebarMessage";

type ToolRow = { id: string; name: string; status: string; title?: string };

const opaqueToolName = /^(?:exec|call)[-_][a-z0-9-]+$|^tool[-_][a-z0-9-]{8,}$/i;

function toolSummary(tool: ToolRow, t: (key: string) => string) {
  const title = tool.title?.trim() ?? "";
  if (/^web search(?::|$)/i.test(title)) {
    return { label: t("aiAssistant.sidebar.processTools.webSearch"), detail: title.replace(/^web search\s*:?\s*/i, "") };
  }
  if (/^image generation$/i.test(title)) return { label: t("aiAssistant.sidebar.processTools.imageGeneration"), detail: "" };
  if (tool.name === "exec_command" || /^exec[-_]/i.test(title) || /^exec[-_]/i.test(tool.name)) {
    return { label: t("aiAssistant.sidebar.processTools.command"), detail: "" };
  }
  if (title && !opaqueToolName.test(title)) return { label: title, detail: "" };
  if (tool.name && !opaqueToolName.test(tool.name)) return { label: tool.name.replaceAll("_", " "), detail: "" };
  return { label: t("aiAssistant.sidebar.processTools.other"), detail: "" };
}

function statusKey(status: string) {
  if (status === "completed" || status === "done") return "completed";
  if (status === "failed" || status === "error") return "failed";
  if (status === "in_progress" || status === "running") return "running";
  return "pending";
}

export function AiSidebarLocalProcess({ reasoning, tools, running }: { reasoning: string; tools: ToolRow[]; running: boolean }) {
  const { t } = useTranslation();
  if (!reasoning.trim() && !tools.length) return null;
  return (
    <Reasoning isStreaming={running} defaultOpen={false} className="mb-2">
      <ReasoningTrigger
        className="-ml-1 min-h-7 w-fit gap-1.5 rounded-sm px-1 py-1 text-xs leading-4 text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 [&_svg]:size-3"
        getThinkingMessage={() => (
          <span className="flex items-center gap-1.5">
            {t("companion.process")}
            {running ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
          </span>
        )}
      />
      <CollapsibleContent className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs leading-5 text-slate-600">
        {reasoning.trim() ? (
          <div className="[&_p]:my-1 [&_h1]:my-1 [&_h2]:my-1 [&_h3]:my-1 [&_li]:my-0">
            <AiSidebarMessage className="text-xs leading-5">{reasoning}</AiSidebarMessage>
          </div>
        ) : null}
        {tools.length ? (
          <div className={reasoning.trim() ? "mt-3 border-t border-slate-200 pt-2" : ""}>
            <p className="mb-1.5 text-[11px] font-medium text-slate-500">{t("aiAssistant.sidebar.processTools.activity")}</p>
            <ul className="space-y-1.5">
              {tools.slice(-5).map((tool) => {
                const { label, detail } = toolSummary(tool, t);
                const state = statusKey(tool.status);
                return (
                  <li key={tool.id} className="flex min-w-0 items-center gap-2">
                    <span className={`size-1.5 shrink-0 rounded-full ${state === "running" ? "bg-sky-500" : state === "failed" ? "bg-rose-500" : "bg-slate-400"}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">
                      {label}{detail ? <span className="text-slate-400"> · {detail}</span> : null}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">{t(`aiAssistant.sidebar.processTools.${state}`)}</span>
                  </li>
                );
              })}
            </ul>
            <details className="mt-2 text-[11px] text-slate-500">
              <summary className="w-fit cursor-pointer rounded-sm hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
                {t("aiAssistant.sidebar.processTools.raw")}
              </summary>
              <ul className="mt-1.5 space-y-1 border-l border-slate-200 pl-2 font-mono leading-4">
                {tools.map((tool) => (
                  <li key={tool.id} className="break-all">{tool.title || tool.name} · {tool.status}</li>
                ))}
              </ul>
            </details>
          </div>
        ) : null}
      </CollapsibleContent>
    </Reasoning>
  );
}
