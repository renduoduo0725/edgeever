import "./styles.css";
import { localizeDocument, t } from "./i18n";

localizeDocument();
document.title = t("zhihuSaveWindowTitle");

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
        origins: [
          "https://www.zhihu.com/*",
          "https://zhihu.com/*",
          "https://zhuanlan.zhihu.com/*",
          "https://www.zhuanlan.zhihu.com/*",
        ],
      });
    } catch {
      granted = false;
    }
    if (!granted) {
      setStatus(t("zhihuPermissionDenied"), "error");
      allowButton.disabled = false;
      return;
    }
    try {
      await chrome.runtime.sendMessage({ type: "activateZhihuTarget" });
    } catch {
      // The page can still be saved on the next right-click after a reload.
    }
    setStatus(t("zhihuPermissionReady"), "success");
    window.setTimeout(() => window.close(), 1600);
  })();
});
