import { facebookExpandButton, linkedinExpandButton, readSocial, socialPostCard } from "./social-clip";
import { readHackerNews } from "./hacker-news-clip";
import { readV2ex } from "./v2ex-clip";
import { readXiaoyuzhou } from "./xiaoyuzhou-clip";
import { markdownText, platformHtmlMarkdown, platformTarget, type PlatformLabels, type PlatformRead } from "./platform-clip";

// Built as a standalone IIFE and injected only after a user action.
(() => {
  const root = globalThis as typeof globalThis & {
    __edgeeverPlatformClipPayload?: { requestId?: string; url?: string; selectionFirst?: boolean; sourceUrl?: string; xiaoyuzhouState?: unknown };
  };
  const payload = root.__edgeeverPlatformClipPayload;
  delete root.__edgeeverPlatformClipPayload;
  if (!payload?.requestId || !payload.url || !payload.sourceUrl) return;
  const requestId = payload.requestId;
  const expected = platformTarget(payload.url);
  if (!expected) return;
  const t = (key: string) => chrome.i18n.getMessage(key) || key;
  const labels: PlatformLabels = {
    score: t("platformScoreLabel"), externalLink: t("platformExternalLinkLabel"),
    supplement: t("platformSupplementLabel"), podcast: t("platformPodcastLabel"),
    noShowNotes: t("platformNoShowNotes"), relativeTime: t("platformRelativeTimeLabel"),
  };
  const sourceUrl = payload.sourceUrl;
  const samePage = () => location.href === sourceUrl;
  const read = (): PlatformRead => {
    if (!samePage()) return { ok: false, reason: "changed" };
    switch (expected.platform) {
      case "hacker-news": return readHackerNews(document, location.href, labels);
      case "v2ex": return readV2ex(document, location.href, labels);
      case "xiaoyuzhou": return readXiaoyuzhou(document, location.href, labels, payload.xiaoyuzhouState);
      default: return readSocial(document, expected);
    }
  };
  const finish = (result: unknown) => {
    void chrome.runtime.sendMessage({ type: "pagePlatformRead", requestId, result });
  };

  const capture = async () => {
    if (!samePage()) return { ok: false, reason: "changed" };
    const selection = payload.selectionFirst ? window.getSelection() : null;
    if (selection?.rangeCount && selection.toString().trim()) {
      const selected = document.createElement("div");
      for (let index = 0; index < selection.rangeCount; index += 1) selected.appendChild(selection.getRangeAt(index).cloneContents());
      const markdown = platformHtmlMarkdown(selected, expected.url)
        || selection.toString().trim().split(/\r?\n/).map(markdownText).join("\n");
      return { ok: true, selection: { title: document.title.trim() || expected.platform, url: expected.url, markdown, kind: "selection" } };
    }
    const initial = read();
    if (!initial.ok && initial.reason === "incomplete" && ["facebook", "linkedin"].includes(expected.platform)) {
      const card = socialPostCard(document,expected);
      const expand = expected.platform === "facebook" ? facebookExpandButton(card) : linkedinExpandButton(card);
      if (!expand) return initial;
      return new Promise<PlatformRead>((resolve) => {
        let settled=false;
        const complete=(value: PlatformRead)=>{if(settled)return;settled=true;observer.disconnect();clearTimeout(timer);resolve(value);};
        const inspect=()=>{try{const value=read();if(value.ok || value.reason !== "incomplete")complete(value);}catch{complete({ok:false,reason:"unreadable"});}};
        const observer=new MutationObserver(inspect);
        const timer=setTimeout(()=>complete({ok:false,reason:"incomplete"}),6000);
        observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true});
        try { expand.click(); inspect(); } catch { complete(initial); }
      });
    }
    if (initial.ok || initial.reason !== "incomplete" || expected.platform !== "xiaoyuzhou") return initial;
    // Click only the sampled Show Notes control, once. Never touch a player,
    // login dialog, unrelated "more" button, or a link to the native app.
    const section = document.querySelector('section[aria-label="节目show notes"]');
    const button = section?.parentElement?.querySelector<HTMLElement>(".expand-wrap .expand");
    if (!button || !/^展开\s*Show\s*Notes$/i.test(button.textContent?.trim() || "")) return initial;
    return new Promise<PlatformRead>((resolve) => {
      let settled = false;
      const complete = (value: PlatformRead) => {
        if (settled) return;
        settled = true;
        observer.disconnect(); clearTimeout(timer);
        window.removeEventListener("popstate", inspect);
        resolve(value);
      };
      const inspect = () => {
        try {
          const result = read();
          if (result.ok || result.reason !== "incomplete") complete(result);
        } catch { complete({ ok: false, reason: "unreadable" }); }
      };
      const observer = new MutationObserver(inspect);
      const timer = setTimeout(() => complete({ ok: false, reason: "incomplete" }), 6_000);
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true });
      window.addEventListener("popstate", inspect);
      try { button.click(); inspect(); } catch { complete({ ok: false, reason: "incomplete" }); }
    });
  };
  void capture().then((result) => finish(samePage() ? result : { ok: false, reason: "changed" }))
    .catch(() => finish({ ok: false, reason: "unreadable" }));
})();
