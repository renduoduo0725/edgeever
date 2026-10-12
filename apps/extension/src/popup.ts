import "./styles.css";
import { getSettings, requestInstancePermission, type ExtensionSettings } from "./extension";
import { localizeDocument, t } from "./i18n";

localizeDocument();

const saveButton = document.querySelector<HTMLButtonElement>("#save");
const settingsButton = document.querySelector<HTMLButtonElement>("#settings");
const status = document.querySelector<HTMLParagraphElement>("#status");
const captureMode = document.querySelector<HTMLElement>("#capture-mode");
const captureContext = document.querySelector<HTMLElement>("#capture-context");
let settings: ExtensionSettings | null = null;
let pageUnavailable = false;

const setStatus = (message: string, kind: "normal" | "error" | "success" = "normal") => {
  if (status) {
    status.textContent = message;
    status.dataset.kind = kind;
  }
};

if (saveButton) saveButton.disabled = true;
void chrome.runtime.sendMessage({ type:"getCurrentPageCaptureMode" }).then((mode: { kind?: string; platform?: string } | undefined) => {
  pageUnavailable = mode?.kind === 'unavailable';
  if (pageUnavailable && saveButton) saveButton.disabled=true;
  if (captureContext) captureContext.dataset.kind=mode?.platform ? 'adapted' : 'generic';
  if (!captureMode) return;
  captureMode.textContent = !mode || mode.kind === 'unknown' ? t('pageCaptureUnknown')
    : mode.kind === 'unavailable' ? t('pageCaptureUnavailable')
    : mode?.kind === 'social-feed' ? t('pageCaptureSelectPost')
    : mode?.platform ? t('pageCaptureAdapted',mode.platform) : t('pageCaptureGeneric');
  if (captureContext && mode?.platform) {
    captureContext.setAttribute('aria-label', `${mode.platform} · ${captureMode.textContent}`);
  }
}).catch(() => {
  if (captureMode) captureMode.textContent=t('pageCaptureUnknown');
});
void getSettings().then((loadedSettings) => {
  settings = loadedSettings;
  if (saveButton) saveButton.disabled = pageUnavailable;
}).catch((error: unknown) => {
  setStatus(error instanceof Error ? error.message : t("saveFailed"), "error");
});

saveButton?.addEventListener("click", async () => {
  if (!settings) return;
  saveButton.disabled = true;
  setStatus(t("readingAndSaving"));

  try {
    if (!settings.instanceUrl || !settings.token) {
      throw new Error(t("completePluginConfiguration"));
    }

    await requestInstancePermission(settings.instanceUrl);
    const response = await chrome.runtime.sendMessage({ type: "captureCurrentPage" });
    if (!response?.ok) {
      throw new Error(response?.message || t("saveFailed"));
    }

    setStatus(typeof response.message === "string" && response.message ? response.message : t("savedToEdgeEver"), "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : t("saveFailed"), "error");
  } finally {
    saveButton.disabled = pageUnavailable;
  }
});

settingsButton?.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});
