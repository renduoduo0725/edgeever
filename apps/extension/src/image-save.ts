import "./styles.css";
import { localizeDocument, t } from "./i18n";

localizeDocument();
document.title = t("imageSaveWindowTitle");

const hostLine = document.querySelector<HTMLParagraphElement>("#host");
const status = document.querySelector<HTMLParagraphElement>("#status");
const allowButton = document.querySelector<HTMLButtonElement>("#allow");
const allowAllButton = document.querySelector<HTMLButtonElement>("#allow-all");

const setStatus = (message: string, kind: "normal" | "error" | "success" = "normal") => {
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
};

const grant = async (origins: string[]) => {
  if (!allowButton || !allowAllButton) return;
  allowButton.disabled = true;
  allowAllButton.disabled = true;
  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins });
  } catch {
    granted = false;
  }
  if (!granted) {
    setStatus(t("imagePermissionDenied"), "error");
    allowButton.disabled = false;
    allowAllButton.disabled = false;
    return;
  }

  setStatus(t("savingImage"));
  try {
    const response = await chrome.runtime.sendMessage({ type: "completePendingImageSave" }) as { ok?: boolean; message?: string } | undefined;
    if (!response?.ok) {
      setStatus(response?.message || t("saveFailed"), "error");
      allowButton.disabled = false;
      allowAllButton.disabled = false;
      return;
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : t("saveFailed"), "error");
    allowButton.disabled = false;
    allowAllButton.disabled = false;
    return;
  }

  setStatus(t("imageSaved"), "success");
  window.setTimeout(() => window.close(), 700);
};

void chrome.runtime.sendMessage({ type: "getPendingImageSave" }).then((pending: { originPattern?: string; host?: string } | null) => {
  if (!pending?.originPattern || !allowButton || !allowAllButton) {
    setStatus(t("imageSaveExpired"), "error");
    return;
  }
  if (hostLine && pending.host) hostLine.textContent = t("imagePermissionHost", pending.host);
  allowButton.disabled = false;
  allowAllButton.disabled = false;
  allowButton.addEventListener("click", () => {
    void grant([pending.originPattern as string]);
  });
  allowAllButton.addEventListener("click", () => {
    void grant(["https://*/*", "http://*/*"]);
  });
}).catch(() => {
  setStatus(t("imageSaveExpired"), "error");
});
