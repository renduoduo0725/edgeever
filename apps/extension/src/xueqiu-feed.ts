import { platformTarget, type PlatformRead, type PlatformTarget } from "./platform-clip";
import { readXueqiu, xueqiuCardTarget, XUEQIU_CARD_SELECTOR } from "./xueqiu-clip";

/** Render only the selected public detail, without scripts. Browser-computed
 * CSS visibility must remain available to the existing detail reader. */
export const readXueqiuFeedPost = async (doc: Document, target: PlatformTarget, sourceUrl: string): Promise<PlatformRead> => {
  const source = new URL(sourceUrl);
  if (target.platform !== "xueqiu" || source.protocol !== "https:"
    || !["xueqiu.com", "www.xueqiu.com"].includes(source.hostname) || platformTarget(sourceUrl)) return { ok: false, reason: "not-target" };
  const card = Array.from(doc.querySelectorAll(XUEQIU_CARD_SELECTOR)).find(node => xueqiuCardTarget(node)?.url === target.url);
  if (!card) return { ok: false, reason: "unreadable" };
  const frame = doc.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1280px;height:800px;pointer-events:none";
  return new Promise(resolve => {
    const finish = (result: PlatformRead) => {
      clearTimeout(timer);
      frame.onload = null;
      frame.onerror = null;
      frame.remove();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: "unreadable" }), 8000);
    frame.onload = () => {
      if (!doc.contains(card) || xueqiuCardTarget(card)?.url !== target.url) return finish({ ok: false, reason: "changed" });
      try {
        const detail = frame.contentDocument;
        if (!detail || platformTarget(detail.URL)?.url !== target.url) return finish({ ok: false, reason: "changed" });
        finish(readXueqiu(detail, target, detail.URL));
      } catch { finish({ ok: false, reason: "unreadable" }); }
    };
    frame.onerror = () => finish({ ok: false, reason: "unreadable" });
    frame.src = new URL(`/${target.id}`, source).href;
    doc.body.appendChild(frame);
  });
};
