import { Check, Copy, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SHARE_DIALOG_PRIMARY_BUTTON_CLASS_NAME } from "./share-dialog-layout";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copyTextToClipboard } from "@/lib/clipboard";

export const SharePasswordControls = ({
  passwordProtected,
  password,
  busy,
  shareUrl,
  onChange,
  hideCopyBoth = false,
}: {
  passwordProtected: boolean;
  password: string;
  busy: boolean;
  shareUrl: string;
  onChange: (enabled: boolean) => void;
  hideCopyBoth?: boolean;
}) => {
  const { t } = useTranslation();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [copyTarget, setCopyTarget] = useState<"password" | "both">("password");
  const resetTimer = useRef<number | null>(null);
  useEffect(() => () => { if (resetTimer.current !== null) window.clearTimeout(resetTimer.current); }, []);
  const copyValue = async (target: "password" | "both", value: string) => {
    const copied = await copyTextToClipboard(value);
    setCopyTarget(target);
    setCopyState(copied ? "copied" : "error");
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopyState("idle"), 3000);
  };
  const copiedLabel = (target: "password" | "both", idleKey: string) =>
    copyTarget === target && copyState === "copied" ? "sharing.copied" : copyTarget === target && copyState === "error" ? "sharing.copyFailed" : idleKey;
  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium leading-5 text-slate-800">{t("sharing.passwordToggle")}</div>
        <Switch
          checked={passwordProtected}
          disabled={busy}
          onCheckedChange={(enabled) => onChange(enabled)}
          aria-label={t("sharing.passwordToggle")}
        />
      </div>
      {passwordProtected ? (
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center gap-1.5">
            <Input
              value={password}
              readOnly
              placeholder={t("sharing.passwordSet")}
              aria-label={t("sharing.passwordLabel")}
              className="min-w-0 font-mono text-xs tracking-wider"
            />
            {password ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={copyState === "copied" && copyTarget === "password" ? "solid" : "outline"}
                    size="icon"
                    className={`h-9 w-9 shrink-0 ${copyState === "copied" && copyTarget === "password" ? SHARE_DIALOG_PRIMARY_BUTTON_CLASS_NAME : ""}`}
                    disabled={!password}
                    aria-label={t("sharing.passwordCopy")}
                    onClick={() => void copyValue("password", password)}
                  >
                    {copyState === "copied" && copyTarget === "password" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("sharing.passwordCopy")}</TooltipContent>
              </Tooltip>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={busy}
                  aria-label={t("sharing.regeneratePassword")}
                  onClick={() => onChange(true)}
                >
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("sharing.regeneratePassword")}</TooltipContent>
            </Tooltip>
          </div>
          {!password ? (
            <p className="text-xs leading-5 text-slate-500">
              {t("sharing.passwordUnavailableHint")}
            </p>
          ) : null}
          {!hideCopyBoth && password ? (
            <Button
              variant="ghost"
              className="h-7 px-0 text-xs text-slate-600 hover:bg-transparent hover:text-slate-900"
              onClick={() => void copyValue("both", `${shareUrl}\n${t("sharing.passwordPrefix")}${password}`)}
            >
              {copyState === "copied" && copyTarget === "both" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {t(copiedLabel("both", "sharing.copyLinkAndPassword"))}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
