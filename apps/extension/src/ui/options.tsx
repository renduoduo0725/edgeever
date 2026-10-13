import { useEffect, useState, type FormEvent } from "react";
import { ChevronRight } from "lucide-react";
import { DEFAULT_SETTINGS, getSettings, saveSettings, testConnection, type ExtensionSettings, type Notebook } from "../extension";
import { getDiagnosticInfo, diagnosticText, type DiagnosticInfo } from "../diagnostics";
import { t } from "../i18n";
import { Button, Input, Status, type Feedback } from "./primitives";
import { platformGroups } from "./platforms";

const diagnosticFields = [
  ["extensionVersion", "extensionVersion"], ["manifestVersion", "manifestVersion"], ["browserVersion", "browser"],
  ["systemVersion", "system"], ["extensionId", "extensionId"], ["instanceOrigin", "instanceOrigin"], ["instancePermission", "instancePermission"],
] as const;
const selectStyle = "h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:opacity-50";
export function Options() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({ message: "" });
  const [copyFeedback, setCopyFeedback] = useState<Feedback>({ message: "" });
  useEffect(() => {
    let active = true;
    void getSettings().then(async value => {
      if (!active) return;
      setSettings(value); setReady(true);
      const info = await getDiagnosticInfo(value);
      if (active) setDiagnostics(info);
    }).catch(error => { if (active) setFeedback({ message: error instanceof Error ? error.message : t("settingsSaveFailed"), kind: "error" }); });
    return () => { active = false; };
  }, []);
  const readSettings = () => ({ ...settings, instanceUrl: settings.instanceUrl.trim(), token: settings.token.trim() });
  async function test() {
    if (busy || !ready) return;
    setBusy(true); setFeedback({ message: t("connecting") });
    try {
      const value = readSettings();
      const found = await testConnection(value);
      setNotebooks(found);
      // Preserve the saved choice even when the current response omits it.
      setFeedback({ message: t(found.length === 1 ? "connectionSuccessOne" : "connectionSuccessMany", String(found.length)), kind: "success" });
      setDiagnostics(await getDiagnosticInfo(value));
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : t("connectionFailed"), kind: "error" }); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    try {
      const value = readSettings();
      await saveSettings(value);
      setFeedback({ message: t("settingsSaved"), kind: "success" });
      setDiagnostics(await getDiagnosticInfo(value));
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : t("settingsSaveFailed"), kind: "error" }); }
    finally { setBusy(false); }
  }
  async function copy() {
    setCopyBusy(true);
    try {
      const info = await getDiagnosticInfo(readSettings());
      await navigator.clipboard.writeText(diagnosticText(info));
      setDiagnostics(info); setCopyFeedback({ message: t("diagnosticsCopied"), kind: "success" });
    } catch { setCopyFeedback({ message: t("diagnosticsCopyFailed"), kind: "error" }); }
    finally { setCopyBusy(false); }
  }
  const field = (key: keyof ExtensionSettings, value: string) => setSettings(current => ({ ...current, [key]: value }));
  return <main className="mx-auto max-w-[640px] px-6 py-8">
    <h1 className="text-[22px] font-semibold">{t("extensionName")}</h1>
    <form id="settings-form" onSubmit={event => void save(event)} className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-[22px]">
      <fieldset disabled={!ready || busy} className="space-y-4">
        <label className="grid gap-2 text-[13px] font-semibold" htmlFor="instance-url">{t("instanceAddress")}<Input id="instance-url" type="url" placeholder="https://notes.example.com" required value={settings.instanceUrl} onChange={event => field("instanceUrl", event.target.value)} /></label>
        <label className="grid gap-2 text-[13px] font-semibold" htmlFor="token">API Token<Input id="token" type="password" placeholder={t("tokenPlaceholder")} required value={settings.token} onChange={event => field("token", event.target.value)} /></label>
        <label className="grid gap-2 text-[13px] font-semibold" htmlFor="notebook-id">{t("defaultNotebook")}<select id="notebook-id" className={selectStyle} value={settings.notebookId} onChange={event => field("notebookId", event.target.value)}>
          <option value="">{t("autoFirstNotebook")}</option>
          {settings.notebookId && !notebooks.some(book => book.id === settings.notebookId) && <option value={settings.notebookId}>{t("defaultNotebook")}</option>}
          {notebooks.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}
        </select></label>
        <div className="grid grid-cols-2 gap-2 pt-1 min-[400px]:flex min-[400px]:justify-end"><Button id="test" type="button" className="h-auto min-h-9 whitespace-normal" variant="outline" onClick={() => void test()}>{t("testConnection")}</Button><Button id="save" type="submit" className="h-auto min-h-9 whitespace-normal">{t("saveSettings")}</Button></div>
      </fieldset>
      <Status {...feedback} busy={busy} />
    </form>
    <section aria-labelledby="platforms-title" className="mt-6">
      <h2 id="platforms-title" className="text-base font-semibold">{t("adaptedPlatformsTitle")}</h2>
      {platformGroups.map(group => <section key={group.title} aria-labelledby={group.title} className="mt-[18px]">
        <h3 id={group.title} className="mb-2 text-[13px] font-semibold">{t(group.title)}</h3>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-2.5 min-[400px]:grid-cols-3 min-[540px]:grid-cols-4">
          {group.platforms.map(platform => <li key={platform.icon} className="flex min-h-7 min-w-0 items-center gap-2 text-xs"><img src={platform.icon} width={18} height={18} alt="" className="size-[18px] shrink-0 object-contain" /><span className="break-words">{"key" in platform ? t(platform.key) : platform.name}</span></li>)}
        </ul>
      </section>)}
    </section>
    <section aria-labelledby="diagnostics-title" className="mt-6 border-t border-border pt-5">
      <h2 id="diagnostics-title" className="text-base font-semibold">{t("diagnosticsTitle")}</h2>
      <p className="mt-2 mb-3 text-xs text-muted-foreground">{t("extensionVersion")} <span id="extension-version-summary" className="ms-2 font-mono text-neutral-700">{diagnostics?.extensionVersion ?? "—"}</span></p>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-[13px] hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden"><span>{t("viewDiagnostics")}</span><ChevronRight aria-hidden="true" className="size-4 group-open:rotate-90" /></summary>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("diagnosticsDescription")}</p>
        <dl className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
          {diagnosticFields.map(([label, key]) => <div key={key} className="grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-3 border-b border-neutral-100 px-3 py-2 text-xs last:border-0"><dt className="text-muted-foreground">{t(label)}</dt><dd className="break-all font-mono">{diagnostics?.[key] ?? "—"}</dd></div>)}
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-2"><Button id="copy-diagnostics" type="button" variant="outline" disabled={copyBusy || !ready} onClick={() => void copy()}>{t("copyDiagnostics")}</Button><Status {...copyFeedback} id="copy-status" /></div>
      </details>
    </section>
    <footer className="mt-5 flex flex-wrap gap-1.5 text-xs text-neutral-600">
      {[["projectAndSource", "https://github.com/tianma-if/edgeever"], ["reportIssue", "https://github.com/tianma-if/edgeever/issues"], ["privacyPolicy", "https://edgeever.org/privacy"]].map(([label, url], index) => <span key={label} className="flex gap-1.5">{index > 0 && <span aria-hidden="true">·</span>}<a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2">{t(label)}</a></span>)}
    </footer>
  </main>;
}
