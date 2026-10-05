import { buildGitHubFeedbackUrl } from "@edgeever/shared";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, LoaderCircle, MessageSquare } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { api, getConfiguredDesktopApiBaseUrl } from "@/lib/api";
import { getClientRuntimeDiagnostics } from "@/lib/system-diagnostics";
import { cn } from "@/lib/utils";
import { getShareableWebSystemInfoItems } from "./SystemInfoCard";

export const FeedbackLink = ({ className }: { className?: string }) => {
  const { t, i18n } = useTranslation();
  const instanceUrl = window.edgeeverDesktop?.isAvailable === true
    ? getConfiguredDesktopApiBaseUrl()
    : window.location.origin;
  const healthQuery = useQuery({
    queryKey: ["instance-health", instanceUrl],
    queryFn: async () => {
      const startedAt = performance.now();
      const health = await api.getInstanceHealth();
      return { health, latencyMs: Math.max(0, Math.round(performance.now() - startedAt)) };
    },
    enabled: Boolean(instanceUrl),
    staleTime: 60 * 1000,
    retry: 1,
  });
  const releaseQuery = useQuery({
    queryKey: ["instance-release", instanceUrl],
    queryFn: () => api.getInstanceRelease(),
    enabled: Boolean(instanceUrl),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
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
          instance: healthQuery.data?.health,
          instanceVersion: releaseQuery.data?.version,
        }),
        systemInfoHeading: t("feedback.systemInfoHeading"),
        systemInfoNotice: t("feedback.systemInfoNotice"),
        titlePrefix: t("feedback.issueTitlePrefix"),
      }),
    [clientRuntimeQuery.data, healthQuery.data, i18n.language, releaseQuery.data, t]
  );
  const collectingSystemInfo = clientRuntimeQuery.isFetching || healthQuery.isFetching || releaseQuery.isFetching;

  return (
    <a
      className={cn(
        "flex min-h-16 w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left text-xs font-normal leading-5 text-slate-600 transition-colors hover:bg-slate-200/50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
        className
      )}
      href={collectingSystemInfo ? undefined : href}
      aria-busy={collectingSystemInfo}
      aria-disabled={collectingSystemInfo}
      tabIndex={0}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="flex min-w-0 items-center gap-3 lg:gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 lg:h-4 lg:w-4 lg:rounded-none lg:bg-transparent">
          <MessageSquare className="h-4 w-4 text-slate-500" />
        </span>
        <span className="min-w-0">
          <span className="block truncate">{t("feedback.title")}</span>
          <span className="mt-0.5 block truncate text-xs font-normal text-slate-500">
            {collectingSystemInfo ? t("systemInfo.connectionChecking") : t("feedback.description")}
          </span>
        </span>
      </span>
      {collectingSystemInfo
        ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
        : <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />}
    </a>
  );
};
