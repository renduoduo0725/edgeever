import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { Button, Status, type Feedback } from "./primitives";

const socialPermissions = {
  "tweet-save": { title: "tweetSaveWindowTitle", intro: "tweetPermissionIntro", allow: "allowTweetAccess", denied: "tweetPermissionDenied", ready: "tweetPermissionReady", message: "activateTweetTarget", origins: ["https://x.com/*", "https://twitter.com/*", "https://mobile.twitter.com/*", "https://www.x.com/*", "https://www.twitter.com/*"] },
  "xhs-save": { title: "xhsSaveWindowTitle", intro: "xhsPermissionIntro", allow: "allowXhsAccess", denied: "xhsPermissionDenied", ready: "xhsPermissionReady", message: "activateXhsTarget", origins: ["https://www.xiaohongshu.com/*", "https://xiaohongshu.com/*"] },
  "zhihu-save": { title: "zhihuSaveWindowTitle", intro: "zhihuPermissionIntro", allow: "allowZhihuAccess", denied: "zhihuPermissionDenied", ready: "zhihuPermissionReady", message: "activateZhihuTarget", origins: ["https://www.zhihu.com/*", "https://zhihu.com/*", "https://zhuanlan.zhihu.com/*", "https://www.zhuanlan.zhihu.com/*"] },
} as const;
export type PermissionPage = keyof typeof socialPermissions | "image-save";
type PendingImage = { originPattern: string; host?: string };
export function Permission({ page }: { page: PermissionPage }) {
  const config = page === "image-save" ? null : socialPermissions[page];
  const [pending, setPending] = useState<PendingImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({ message: "" });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let active = true;
    if (!config) void chrome.runtime.sendMessage({ type: "getPendingImageSave" }).then((value: PendingImage | null) => {
      if (!active) return;
      if (value?.originPattern) setPending(value);
      else setFeedback({ message: t("imageSaveExpired"), kind: "error" });
    }).catch(() => { if (active) setFeedback({ message: t("imageSaveExpired"), kind: "error" }); });
    return () => { active = false; if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, [config]);
  async function grant(allSites = false) {
    if (busy || completed || (!config && !pending)) return;
    setBusy(true); setFeedback({ message: "" });
    let granted = false;
    try {
      // Must execute in this click's user gesture, before any asynchronous work.
      granted = await chrome.permissions.request({ origins: config ? [...config.origins] : allSites ? ["https://*/*", "http://*/*"] : [pending!.originPattern] });
    } catch { /* A rejected browser prompt is equivalent to denied access. */ }
    if (!granted) {
      setFeedback({ message: t(config?.denied ?? "imagePermissionDenied"), kind: "error" }); setBusy(false); return;
    }
    if (config) {
      try { await chrome.runtime.sendMessage({ type: config.message }); }
      catch { /* Reload/right-click can still activate the listener after granting. */ }
      setFeedback({ message: t(config.ready), kind: "success" });
    } else {
      setFeedback({ message: t("savingImage") });
      try {
        const result = await chrome.runtime.sendMessage({ type: "completePendingImageSave" }) as { ok?: boolean; message?: string } | undefined;
        if (!result?.ok) throw new Error(result?.message || t("saveFailed"));
        setFeedback({ message: t("imageSaved"), kind: "success" });
      } catch (error) {
        setFeedback({ message: error instanceof Error ? error.message : t("saveFailed"), kind: "error" }); setBusy(false); return;
      }
    }
    setCompleted(true); setBusy(false);
    closeTimer.current = setTimeout(() => window.close(), config ? 1600 : 700);
  }
  const disabled = busy || completed || (!config && !pending);
  return <main className="mx-auto w-full max-w-[420px] p-[22px]">
    <h1 className="mb-3 text-lg font-semibold">{t(config?.title ?? "imageSaveWindowTitle")}</h1>
    <p className="text-[13px] leading-relaxed text-muted-foreground">{t(config?.intro ?? "imagePermissionIntro")}</p>
    {pending?.host && <p id="host" className="mt-3 text-xs text-muted-foreground">{t("imagePermissionHost", pending.host)}</p>}
    <div className="mt-[18px] grid gap-2">
      <Button id="allow" disabled={disabled} className="h-auto min-h-10 whitespace-normal py-2" onClick={() => void grant()}>{t(config?.allow ?? "allowAndSaveImage")}</Button>
      {!config && <Button id="allow-all" variant="outline" disabled={disabled} className="h-auto min-h-10 whitespace-normal py-2" onClick={() => void grant(true)}>{t("allowAllSitesAndSave")}</Button>}
    </div>
    <Status {...feedback} busy={busy} />
  </main>;
}
