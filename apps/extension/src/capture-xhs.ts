// Injected on demand. Reads the open Xiaohongshu note, or the note marked by
// xhs-target.js. Must stay import-free.
(() => {
  const root = globalThis as typeof globalThis & {
    __edgeeverXhsTarget?: boolean;
    __edgeeverXhsClipPayload?: { requestId?: string };
  };
  const payload = root.__edgeeverXhsClipPayload;
  delete root.__edgeeverXhsClipPayload;
  if (!payload || typeof payload.requestId !== "string") return;
  const requestId = payload.requestId;

  const finish = (result: Record<string, unknown>) => {
    void chrome.runtime.sendMessage({ type: "pageXhsRead", requestId, result });
  };

  // Keep identical to noteIdFromPath in xhs-clip.ts.
  const noteIdFromPath = (pathname: string) => {
    const direct = pathname.match(/^\/(?:explore|discovery\/item)\/([0-9a-fA-F]{16,32})(?=\/|$)/);
    if (direct?.[1]) return direct[1];
    const profile = pathname.match(/^\/user\/profile\/[^/]+\/([0-9a-fA-F]{16,32})(?=\/|$)/);
    return profile?.[1] ?? "";
  };

  const noteIdFromHref = (href: string) => {
    if (!href) return "";
    try {
      return noteIdFromPath(new URL(href, location.href).pathname);
    } catch {
      return "";
    }
  };

  const asString = (value: unknown) => (typeof value === "string" ? value : "");

  const asNumber = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    return 0;
  };

  const emptyImage = (url = "") => ({ url, urlDefault: "", urlPre: "", infoList: [] as Array<{ imageScene: string; url: string }> });

  type Snapshot = {
    noteId: string;
    title: string;
    desc: string;
    nickname: string;
    timeMs: number;
    timeText: string;
    location: string;
    tags: string[];
    images: Array<{ url: string; urlDefault: string; urlPre: string; infoList: Array<{ imageScene: string; url: string }> }>;
  };

  const hasContent = (note: Snapshot) => Boolean(note.title || note.desc || note.nickname || note.images.length > 0);

  const stateRoot = () => {
    const state = (window as unknown as {
      __INITIAL_STATE__?: {
        note?: {
          noteDetailMap?: Record<string, unknown>;
          currentNoteId?: unknown;
          firstNoteId?: unknown;
        };
      };
    }).__INITIAL_STATE__;
    return state?.note ?? null;
  };

  const readStateNote = (noteId: string) => {
    const map = stateRoot()?.noteDetailMap;
    if (!map || !noteId) return null;
    const entry = map[noteId];
    if (!entry || typeof entry !== "object") return null;
    const record = entry as { note?: unknown };
    if (record.note && typeof record.note === "object") return record.note as Record<string, unknown>;
    return record as Record<string, unknown>;
  };

  const snapshotFromState = (note: Record<string, unknown> | null, noteId: string): Snapshot | null => {
    if (!note) return null;
    const user = note.user && typeof note.user === "object" ? note.user as Record<string, unknown> : {};
    const tags: string[] = [];
    if (Array.isArray(note.tagList)) {
      for (const tag of note.tagList) {
        if (tags.length >= 40) break;
        const name = tag && typeof tag === "object" ? asString((tag as { name?: unknown }).name) : "";
        if (name) tags.push(name);
      }
    }
    const images: Snapshot["images"] = [];
    if (Array.isArray(note.imageList)) {
      for (const image of note.imageList) {
        if (images.length >= 18 || !image || typeof image !== "object") continue;
        const source = image as { url?: unknown; urlDefault?: unknown; urlPre?: unknown; infoList?: unknown };
        const infoList: Array<{ imageScene: string; url: string }> = [];
        if (Array.isArray(source.infoList)) {
          for (const info of source.infoList) {
            if (infoList.length >= 8 || !info || typeof info !== "object") continue;
            const item = info as { imageScene?: unknown; url?: unknown };
            infoList.push({ imageScene: asString(item.imageScene), url: asString(item.url) });
          }
        }
        images.push({
          url: asString(source.url),
          urlDefault: asString(source.urlDefault),
          urlPre: asString(source.urlPre),
          infoList,
        });
      }
    }
    return {
      noteId: asString(note.noteId) || noteId,
      title: asString(note.title),
      desc: asString(note.desc),
      nickname: asString(user.nickname) || asString(user.nickName),
      timeMs: asNumber(note.time),
      timeText: "",
      location: asString(note.ipLocation),
      tags,
      images,
    };
  };

  const clean = (value: string) => value.replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").trim();

  const textOf = (node: Element | null) => {
    if (!node) return "";
    const element = node as HTMLElement;
    return clean(element.innerText || element.textContent || "");
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const expandFolded = async (scope: Element) => {
    const desc = scope.querySelector("#detail-desc, .desc, .note-content");
    if (!desc) return;
    const control = [...desc.querySelectorAll("button, span, div")].find((node) => {
      const text = (node.textContent || "").replace(/\s+/g, "");
      return text === "展开" || text === "展开全文";
    });
    if (!control) return;
    (control as HTMLElement).click();
    await sleep(300);
  };

  const snapshotFromDom = (scope: Element, noteId: string): Snapshot => {
    const authorRoot = scope.querySelector(".author-wrapper, .author-container, .author");
    const descRoot = scope.querySelector("#detail-desc .note-text") || scope.querySelector("#detail-desc, .note-text, .desc");
    const dateNode = scope.querySelector(".note-scroller .date, .bottom-container .date");
    const tags = [...scope.querySelectorAll("#detail-desc a.tag, #detail-desc a[href*='search_result']")]
      .map((node) => clean(node.textContent || ""))
      .filter(Boolean)
      .slice(0, 40);
    const media = scope.querySelector(".media-container, .swiper, .swiper-container, .note-slider") || scope;
    const images: Snapshot["images"] = [];
    for (const img of media.querySelectorAll("img")) {
      if (images.length >= 18) break;
      if (img.closest(".avatar, .comment, .comments-container, .comments-el, .author, .author-wrapper, .author-container")) continue;
      if (img.naturalWidth > 0 && img.naturalHeight > 0 && img.naturalWidth < 48 && img.naturalHeight < 48) continue;
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;
      if (images.some((image) => image.url === src)) continue;
      images.push(emptyImage(src));
    }
    return {
      noteId,
      title: textOf(scope.querySelector("#detail-title, .title")),
      desc: textOf(descRoot),
      nickname: clean(authorRoot?.querySelector(".username, .name")?.textContent || ""),
      timeMs: 0,
      timeText: textOf(dateNode),
      location: "",
      tags,
      images,
    };
  };

  void (async () => {
    try {
      const pageId = noteIdFromPath(location.pathname);
      const marked = document.querySelector("[data-edgeever-xhs-target='1']");
      const markedId = marked?.getAttribute("data-edgeever-xhs-note-id")
        || noteIdFromHref(marked?.querySelector("a[href]")?.getAttribute("href") || "");
      const detail = document.querySelector("#noteContainer");
      if (!pageId && !markedId && !detail) {
        finish({ ok: false, reason: root.__edgeeverXhsTarget ? "not-found" : "needs-listener" });
        return;
      }
      const noteState = stateRoot();
      const stateCurrent = asString(noteState?.currentNoteId) || asString(noteState?.firstNoteId);
      let noteId = pageId;
      if (!noteId && detail) noteId = stateCurrent || markedId;
      if (!noteId) noteId = markedId;

      let snapshot = snapshotFromState(readStateNote(noteId), noteId);
      if ((!snapshot || !hasContent(snapshot)) && detail) {
        await expandFolded(detail);
        snapshot = snapshotFromDom(detail, noteId);
      }
      if (!snapshot || !hasContent(snapshot)) {
        finish({ ok: false, reason: !detail && markedId ? "needs-open" : "not-found" });
        return;
      }
      finish({ ok: true, ...snapshot, noteId: snapshot.noteId || noteId });
    } catch {
      finish({ ok: false, reason: "not-found" });
    }
  })();
})();
