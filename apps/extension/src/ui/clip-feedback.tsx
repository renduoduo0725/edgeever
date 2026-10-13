import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Toaster, toast, notificationDuration } from "./components/sonner";

// Re-injection reuses the mounted component and its Sonner store. Keep both the
// stylesheet and React tree inside the shadow root, away from the site's CSS.
declare const __CLIP_FEEDBACK_CSS__: string;
type Kind = "normal" | "success" | "error";
const scope = globalThis as typeof globalThis & {
  __edgeeverImageClipPayload?: { action?: string; message?: string; kind?: string; closeLabel?: string; regionLabel?: string };
  __edgeeverClipFeedback?: { host: HTMLElement; show: (message: string, kind: Kind) => void; dispose: () => void };
};
const payload = scope.__edgeeverImageClipPayload;
delete scope.__edgeeverImageClipPayload;
if (payload?.action === "toast") {
  let service = scope.__edgeeverClipFeedback;
  if (!service?.host.isConnected) {
    service?.dispose();
    const host = document.createElement("div");
    host.id = "edgeever-clipper-toast";
    host.style.cssText = "all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = __CLIP_FEEDBACK_CSS__;
    const mount = document.createElement("div");
    shadow.append(style, mount);
    (document.documentElement ?? document.body).appendChild(host);
    const root = createRoot(mount);
    flushSync(() => root.render(<Toaster containerAriaLabel={payload.regionLabel} toastOptions={{ closeButtonAriaLabel: payload.closeLabel }} />));
    service = {
      host,
      show(message, kind) {
        const options = { id: "edgeever-clip", duration: notificationDuration[kind] };
        if (kind === "error") toast.error(message, options);
        else if (kind === "success") toast.success(message, options);
        else toast(message, options);
      },
      dispose: () => { root.unmount(); host.remove(); },
    };
    scope.__edgeeverClipFeedback = service;
  }
  service.show(typeof payload.message === "string" ? payload.message : "", payload.kind === "error" ? "error" : payload.kind === "normal" ? "normal" : "success");
}
