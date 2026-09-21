import { buildGitHubFeedbackUrl } from "@edgeever/shared";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, MessageSquare } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getClientRuntimeDiagnostics } from "@/lib/system-diagnostics";
import { cn } from "@/lib/utils";
import { getShareableWebSystemInfoItems } from "./SystemInfoCard";

export const FeedbackLink = ({ className }: { className?: string }) => {
  const { t, i18n } = useTranslation();
  const clientRuntimeQuery = useQuery({
    queryKey: ["system-info-client-runtime"],
    queryFn: getClientRuntimeDiagnostics,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });
  const href = useMemo(
    () =>
      buildGitHubFeedbackUrl({
        contentHeading: t("feedback.issueContentHeading"),
        contentPrompt: t("feedback.issueContentPrompt"),
        privacyNotice: t("feedback.privacyNotice"),
        systemInfo: getShareableWebSystemInfoItems(t, i18n.language, {
          clientRuntime: clientRuntimeQuery.data,
        }),
        systemInfoHeading: t("feedback.systemInfoHeading"),
        systemInfoNotice: t("feedback.systemInfoNotice"),
        titlePrefix: t("feedback.issueTitlePrefix"),
      }),
    [clientRuntimeQuery.data, i18n.language, t]
  );

  return (
    <a
      className={cn(
        "flex min-h-16 w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200/50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
        className
      )}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="flex min-w-0 items-center gap-3 lg:gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 lg:h-4 lg:w-4 lg:rounded-none lg:bg-transparent">
          <MessageSquare className="h-4 w-4 text-slate-500" />
        </span>
        <span className="min-w-0">
          <span className="block truncate">{t("feedback.title")}</span>
          <span className="mt-0.5 block truncate text-xs font-normal text-slate-500">{t("feedback.description")}</span>
        </span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
    </a>
  );
};
