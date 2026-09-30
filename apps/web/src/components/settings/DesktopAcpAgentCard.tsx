import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AI_SIDEBAR_ADAPTER_KEY,
  AI_SIDEBAR_ADAPTER_PATH_KEY,
  AI_SIDEBAR_SOURCE_KEY,
  listDesktopAcpAdapters,
  installDesktopAcpAdapter,
  authenticateDesktopAcpAdapter,
  probeDesktopAcpAdapter,
  type AiSidebarSource,
  type DesktopAcpAdapter,
  type DesktopAcpAdapterId,
} from "@/lib/desktop-acp";
import { cn } from "@/lib/utils";
import {
  SETTINGS_CARD_DESCRIPTION_CLASSNAME,
  SETTINGS_CARD_HEADER_CLASSNAME,
  SETTINGS_CARD_ICON_CLASSNAME,
  SETTINGS_CARD_TITLE_CLASSNAME,
  SETTINGS_ITEM_DESCRIPTION_CLASSNAME,
  SETTINGS_ITEM_TITLE_CLASSNAME,
} from "./settings-ui";

const adapterIds: DesktopAcpAdapterId[] = ["codex", "antigravity", "grokBuild", "deepseekHarness", "piAgent", "workbuddyCn", "workbuddyIntl"];

const agentCatalog = [
  { id: "codex", connectable: true },
  { id: "antigravity", connectable: true },
  { id: "claudeCode", connectable: false },
  { id: "workbuddyCn", connectable: true },
  { id: "workbuddyIntl", connectable: true },
  { id: "grokBuild", connectable: true },
  { id: "deepseekHarness", connectable: true },
  { id: "piAgent", connectable: true },
] as const;

const readSource = (): AiSidebarSource => (
  localStorage.getItem(AI_SIDEBAR_SOURCE_KEY) === "local" ? "local" : "builtin"
);

const readAdapterId = (): DesktopAcpAdapterId => {
  const stored = localStorage.getItem(AI_SIDEBAR_ADAPTER_KEY);
  return adapterIds.find((id) => id === stored) ?? "codex";
};

const statusKey = (adapter: DesktopAcpAdapter | undefined, probing: boolean) => {
  if (probing) return "aiAssistant.agentSource.probing";
  if (!adapter || adapter.detail === "not_probed") return "aiAssistant.agentSource.notProbed";
  if (adapter.detail === "invalid_path") return "aiAssistant.agentSource.invalidPath";
  if (adapter.detail === "desktop_unavailable") return "aiAssistant.agentSource.localDisabled";
  if (adapter.id === "grokBuild" && adapter.state === "not_installed") return "aiAssistant.agentSource.grokBuildNotFound";
  if (adapter.id === "deepseekHarness" && adapter.state === "not_installed") return "aiAssistant.agentSource.deepseekHarnessNotFound";
  if (adapter.id === "piAgent" && adapter.state === "not_installed") return adapter.detail === "adapter_missing" ? "aiAssistant.agentSource.piAgentAdapterMissing" : "aiAssistant.agentSource.piAgentNotFound";
  if ((adapter.id === "workbuddyCn" || adapter.id === "workbuddyIntl") && adapter.state === "not_installed") return "aiAssistant.agentSource.workbuddyNotFound";
  return `aiAssistant.agentSource.states.${adapter.state}`;
};

const desktopBridgeAvailable = () => (
  typeof window !== "undefined" && typeof window.edgeeverDesktop?.listAcpAdapters === "function"
);

const DesktopAcpAgentCardBody = ({ bridge }: { bridge: boolean }) => {
  const { t } = useTranslation();
  const [source, setSource] = useState<AiSidebarSource>("builtin");
  const [adapterId, setAdapterId] = useState<DesktopAcpAdapterId>("codex");
  const [adapterPath, setAdapterPath] = useState("");
  const [ready, setReady] = useState(false);
  const [listed, setListed] = useState<DesktopAcpAdapter[]>([]);
  const [probed, setProbed] = useState<DesktopAcpAdapter | null>(null);
  const [probing, setProbing] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    const stored = readSource();
    setSource(bridge && stored === "local" ? "local" : "builtin");
    setAdapterId(readAdapterId());
    setAdapterPath(localStorage.getItem(AI_SIDEBAR_ADAPTER_PATH_KEY) ?? "");
    setReady(true);
  }, [bridge]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(AI_SIDEBAR_SOURCE_KEY, source);
    localStorage.setItem(AI_SIDEBAR_ADAPTER_KEY, adapterId);
    localStorage.setItem(AI_SIDEBAR_ADAPTER_PATH_KEY, adapterPath);
  }, [adapterId, adapterPath, ready, source]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => void listDesktopAcpAdapters().then((adapters) => {
      if (!cancelled) setListed(adapters);
    }).catch(() => {});
    refresh();
    const interval = window.setInterval(refresh, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const listedCurrent = listed.find((adapter) => adapter.id === adapterId);
  const shown = listedCurrent?.state === "installing" || (listedCurrent?.managed && (!probed?.managed || listedCurrent.version !== probed.version))
    ? listedCurrent
    : probed?.id === adapterId ? probed : listedCurrent;
  const status = t(statusKey(shown, probing));
  const authMethods = shown?.authMethods?.filter((method) => (
    adapterId === "workbuddyCn" ? method.id !== "external" : adapterId === "workbuddyIntl" ? method.id !== "internal" : true
  )) ?? [];

  const selectAdapter = (id: DesktopAcpAdapterId) => {
    setAdapterId(id);
    setProbed(null);
    setInstallError(false);
  };

  const install = async () => {
    if (adapterId !== "codex" && adapterId !== "antigravity" && adapterId !== "piAgent") return;
    setInstalling(true);
    setInstallError(false);
    try {
      const result = await installDesktopAcpAdapter(adapterId);
      if (result.updated) {
        if (adapterId === "antigravity") setAdapterPath("");
        setListed(await listDesktopAcpAdapters());
        if (result.adapter) setProbed({ ...result.adapter, version: result.version, managed: true });
      } else {
        setInstallError(true);
      }
    } catch {
      setInstallError(true);
    } finally {
      setInstalling(false);
    }
  };

  const authenticate = async (methodId: string) => {
    setAuthenticating(true);
    setInstallError(false);
    try {
      const result = await authenticateDesktopAcpAdapter({
        id: adapterId,
        methodId,
        ...(adapterId === "antigravity" && adapterPath.trim() ? { path: adapterPath.trim() } : {}),
      });
      setProbed(result);
    } catch {
      setProbed({ id: adapterId, label: t(`aiAssistant.agentSource.${adapterId}`), state: "failed" });
    } finally {
      setAuthenticating(false);
    }
  };

  const probe = async () => {
    setProbing(true);
    setInstallError(false);
    try {
      const result = await probeDesktopAcpAdapter({
        id: adapterId,
        ...(adapterId === "antigravity" ? { path: adapterPath.trim() } : {}),
      });
      setProbed(result);
    } catch {
      setProbed({ id: adapterId, label: t(`aiAssistant.agentSource.${adapterId}`), state: "failed" });
    } finally {
      setProbing(false);
    }
  };

  return (
    <Card className="w-full min-w-0 overflow-hidden shadow-none">
      <CardHeader className={SETTINGS_CARD_HEADER_CLASSNAME}>
        <CardTitle className={SETTINGS_CARD_TITLE_CLASSNAME}>
          <Bot className={SETTINGS_CARD_ICON_CLASSNAME} />
          {t("aiAssistant.agentSource.title")}
        </CardTitle>
        <CardDescription className={SETTINGS_CARD_DESCRIPTION_CLASSNAME}>
          {t("aiAssistant.agentSource.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 pt-0">
        <div role="radiogroup" aria-label={t("aiAssistant.agentSource.title")} className="overflow-hidden rounded-lg border border-slate-200/70 divide-y divide-slate-200/70">
          {(["builtin", "local"] as const).map((option) => {
            const disabled = option === "local" && !bridge;
            const checked = source === option;
            return (
              <div key={option} className={cn(disabled && "opacity-60", checked && "bg-slate-50/80")}>
                <label className={cn("flex items-start gap-3 px-3.5 py-2.5", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
                  <input
                    className="mt-0.5"
                    type="radio"
                    name="edgeever-acp-source"
                    value={option}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => { if (!disabled) setSource(option); }}
                  />
                  <span className="min-w-0">
                    <span className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t(`aiAssistant.agentSource.${option}`)}</span>
                    <span className={cn(SETTINGS_ITEM_DESCRIPTION_CLASSNAME, "block")}>
                      {disabled ? t("aiAssistant.agentSource.localDisabled") : t(`aiAssistant.agentSource.${option}Hint`)}
                    </span>
                  </span>
                </label>
                {disabled ? (
                  <div role="group" className="flex flex-wrap gap-2 px-3.5 pb-3 pl-9" aria-label={t("aiAssistant.agentSource.adapter")}>
                    {agentCatalog.map((agent) => (
                      <span key={agent.id} className="flex h-8 items-center gap-2 rounded-md border border-slate-200 px-2.5 text-xs text-slate-500">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        {t(`aiAssistant.agentSource.${agent.id}`)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {source === "local" ? (
          <div className="grid gap-3">
            <div role="radiogroup" aria-label={t("aiAssistant.agentSource.adapter")} className="flex flex-wrap gap-2">
              {adapterIds.map((id) => {
                const checked = adapterId === id;
                return (
                  <label
                    key={id}
                    className={cn(
                      "flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-xs",
                      checked ? "border-slate-900 bg-card text-slate-950" : "border-slate-200 text-slate-600"
                    )}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="edgeever-acp-adapter"
                      value={id}
                      checked={checked}
                      onChange={() => selectAdapter(id)}
                    />
                    <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", checked ? "bg-slate-950" : "bg-slate-400")} />
                    {t(`aiAssistant.agentSource.${id}`)}
                  </label>
                );
              })}
              {agentCatalog.filter((agent) => !agent.connectable).map((agent) => (
                <span key={agent.id} className="flex h-8 cursor-not-allowed items-center gap-2 rounded-md border border-slate-200 px-2.5 text-xs text-slate-400">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  {t(`aiAssistant.agentSource.${agent.id}`)}
                </span>
              ))}
            </div>

            {adapterId === "antigravity" ? (
              <label className="grid gap-1.5 text-xs font-normal leading-5 text-slate-700">
                <span className="flex items-center gap-1.5">
                  {t("aiAssistant.agentSource.pathLabel")}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-slate-400" aria-label={t("aiAssistant.agentSource.pathHint")}>
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-72">{t("aiAssistant.agentSource.pathHint")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <Input
                  className="h-8 text-xs"
                  value={adapterPath}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  placeholder={t("aiAssistant.agentSource.pathPlaceholder")}
                  onChange={(event) => {
                    setAdapterPath(event.target.value);
                    setProbed(null);
                  }}
                />
              </label>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs leading-5 text-slate-600" role="status">
                {installing ? t("aiAssistant.agentSource.installing") : installError ? t("aiAssistant.agentSource.installFailed") : status}
                {shown?.managed && shown.version ? ` · v${shown.version} · ${t("aiAssistant.agentSource.autoUpdated")}` : ""}
              </p>
              <div className="flex shrink-0 gap-2">
                {shown?.state === "not_installed" && (adapterId === "codex" || adapterId === "antigravity" || (adapterId === "piAgent" && shown?.detail === "adapter_missing")) ? (
                  <Button type="button" variant="outline" size="sm" className="h-8 bg-card text-xs font-normal" disabled={installing || probing} onClick={() => void install()}>
                    {installing ? t("aiAssistant.agentSource.installing") : t("aiAssistant.agentSource.install")}
                  </Button>
                ) : null}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span><Button type="button" variant="outline" size="sm" className="h-8 bg-card text-xs font-normal" disabled={probing || installing} onClick={() => void probe()}>
                        {probing ? t("aiAssistant.agentSource.probing") : t("aiAssistant.agentSource.probe")}
                      </Button></span>
                    </TooltipTrigger>
                    <TooltipContent>{t("aiAssistant.agentSource.probeHint")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            {shown?.state === "not_installed" ? <p className="text-xs text-slate-500">{t(adapterId === "grokBuild" ? "aiAssistant.agentSource.grokBuildMissingHint" : adapterId === "deepseekHarness" ? "aiAssistant.agentSource.deepseekHarnessMissingHint" : adapterId === "piAgent" ? shown.detail === "adapter_missing" ? "aiAssistant.agentSource.piAgentAdapterMissingHint" : "aiAssistant.agentSource.piAgentMissingHint" : adapterId === "workbuddyCn" || adapterId === "workbuddyIntl" ? "aiAssistant.agentSource.workbuddyMissingHint" : "aiAssistant.agentSource.installHint")}</p> : null}
            {shown?.state === "needs_login" && adapterId === "piAgent" ? <p className="text-xs text-slate-600">{t("aiAssistant.agentSource.piAgentLoginHint")}</p> : null}
            {shown?.state === "needs_login" && (adapterId === "workbuddyCn" || adapterId === "workbuddyIntl") ? (
              <p className="text-xs text-slate-600">{t(adapterId === "workbuddyCn" ? "aiAssistant.agentSource.workbuddyCnLoginHint" : "aiAssistant.agentSource.workbuddyIntlLoginHint")}</p>
            ) : null}
            {shown?.state === "needs_login" && authMethods.length ? (
              <div className="flex flex-wrap gap-2">
                {authMethods.map((method) => (
                  <Button key={method.id} type="button" variant="outline" size="sm" className="h-8 bg-card text-xs font-normal" disabled={authenticating} onClick={() => void authenticate(method.id)}>
                    {authenticating ? t("aiAssistant.agentSource.authenticating") : t("aiAssistant.agentSource.authenticateWith", { method: method.name })}
                  </Button>
                ))}
              </div>
            ) : null}
            {shown?.state === "needs_login" && !authMethods.length && adapterId !== "piAgent" ? (
              <p className="text-xs text-amber-700" role="status">{t("aiAssistant.agentSource.loginUnavailable")}</p>
            ) : null}
            {shown?.updateError ? <p className="text-xs text-amber-700" role="status">{t("aiAssistant.agentSource.updateFailed")}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export const DesktopAcpAgentCard = () => (
  <DesktopAcpAgentCardBody bridge={desktopBridgeAvailable()} />
);
