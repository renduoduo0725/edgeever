import "./styles.css";
import { localizeDocument, t } from "./i18n";

localizeDocument();
document.title = t("tweetSaveWindowTitle");

const status = document.querySelector<HTMLParagraphElement>("#status");
const allowButton = document.querySelector<HTMLButtonElement>("#allow");

const setStatus = (message: string, kind: "normal" | "error" | "success" = "normal") => {
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
};

allowButton?.addEventListener("click", () => {
  if (!allowButton) return;
  allowButton.disabled = true;
  void (async () => {
    let granted = false;
    try {
      granted = await chrome.permissions.request({
        origins: ["https://x.com/*", "https://twitter.com/*", "https://mobile.twitter.com/*", "https://www.x.com/*", "https://www.twitter.com/*"],
      });
    } catch {
      granted = false;
    }
    if (!granted) {
      setStatus(t("tweetPermissionDenied"), "error");
      allowButton.disabled = false;
      return;
    }
    try {
      await chrome.runtime.sendMessage({ type: "activateTweetTarget" });
    } catch {
      // The page can still be saved on the next right-click after a reload.
    }
    setStatus(t("tweetPermissionReady"), "success");
    window.setTimeout(() => window.close(), 1600);
  })();
});
