// Injected with chrome.scripting.executeScript({ files }). This file must stay
// free of imports so the build remains a classic script. The background page
// writes the request onto globalThis immediately before injection.
(() => {
  const root = globalThis as typeof globalThis & {
    __edgeeverImageClipPayload?: {
      action?: string;
      requestId?: string;
      urls?: unknown;
      matchUrl?: string;
      maxBytes?: number;
      message?: string;
      kind?: string;
    };
  };
  const payload = root.__edgeeverImageClipPayload;
  delete root.__edgeeverImageClipPayload;
  if (!payload) return;

  const supported = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);

  const sniff = (bytes: Uint8Array) => {
    const starts = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
    if (starts([0x89, 0x50, 0x4e, 0x47])) return "image/png";
    if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
    if (starts([0x47, 0x49, 0x46])) return "image/gif";
    if (bytes.length >= 12 && starts([0x52, 0x49, 0x46, 0x46]) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return "image/webp";
    }
    if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      const brand = String.fromCharCode(bytes[8] ?? 0, bytes[9] ?? 0, bytes[10] ?? 0, bytes[11] ?? 0);
      if (brand === "avif" || brand === "avis") return "image/avif";
    }
    return "";
  };

  const bytesToBase64 = (bytes: Uint8Array) => {
    let binary = "";
    const chunkSize = 0x2000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(index, index + chunkSize)));
    }
    return btoa(binary);
  };

  const showToast = (message: string, kind: string) => {
    document.getElementById("edgeever-clipper-toast")?.remove();
    const host = document.createElement("div");
    host.id = "edgeever-clipper-toast";
    host.style.position = "fixed";
    host.style.zIndex = "2147483647";
    host.style.right = "16px";
    host.style.bottom = "16px";
    host.style.pointerEvents = "none";
    const shadow = host.attachShadow({ mode: "open" });
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = [
      "max-width:280px",
      "padding:12px 14px",
      "border-radius:10px",
      `background:${kind === "error" ? "#b91c1c" : "#0f766e"}`,
      "color:#fff",
      "font:600 13px/1.45 -apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif",
      "box-shadow:0 8px 24px rgb(15 23 42 / 24%)",
    ].join(";");
    shadow.appendChild(toast);
    (document.documentElement ?? document.body).appendChild(host);
    window.setTimeout(() => host.remove(), kind === "error" ? 8000 : 4000);
  };

  if (payload.action === "toast") {
    showToast(typeof payload.message === "string" ? payload.message : "", payload.kind === "error" ? "error" : "success");
    return;
  }

  if (payload.action !== "read" || typeof payload.requestId !== "string") return;
  const requestId = payload.requestId;

  const finish = (result: { ok: true; mimeType: string; base64: string; byteSize: number; alt: string } | { ok: false; reason: string }) => {
    void chrome.runtime.sendMessage({ type: "pageImageRead", requestId, result });
  };

  const urlsMatch = (left: string, right: string) => {
    if (!left || !right) return false;
    if (left === right) return true;
    try {
      return new URL(left, document.baseURI).href === new URL(right, document.baseURI).href;
    } catch {
      return false;
    }
  };

  const read = async () => {
    const maxBytes = typeof payload.maxBytes === "number" ? payload.maxBytes : 20 * 1024 * 1024;
    const matchUrl = typeof payload.matchUrl === "string" ? payload.matchUrl : "";
    const requested = Array.isArray(payload.urls) ? payload.urls.filter((url): url is string => typeof url === "string" && url.length > 0) : [];
    const matched = [...document.images].filter((img) => {
      const candidates = [img.currentSrc, img.src, img.getAttribute("src") ?? ""];
      return candidates.some((value) => urlsMatch(value, matchUrl) || requested.some((url) => urlsMatch(value, url)));
    });
    const alt = matched.find((img) => img.alt.trim())?.alt.trim()
      || matched.find((img) => img.getAttribute("title")?.trim())?.getAttribute("title")?.trim()
      || "";
    const queue = [...requested];
    for (const img of matched) {
      if (img.currentSrc) queue.push(img.currentSrc);
      if (img.src) queue.push(img.src);
    }
    const urls = [...new Set(queue)];

    const classify = async (blob: Blob) => {
      if (blob.size <= 0) return { ok: false as const, reason: "empty" as const };
      if (blob.size > maxBytes) return { ok: false as const, reason: "too-large" as const };
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.byteLength > maxBytes) return { ok: false as const, reason: "too-large" as const };
      const reported = blob.type.split(";")[0]?.trim().toLowerCase() ?? "";
      const normalized = reported === "image/jpg" ? "image/jpeg" : reported;
      const mimeType = supported.has(normalized) ? normalized : sniff(bytes);
      if (!mimeType) return { ok: false as const, reason: "unsupported" as const };
      return {
        ok: true as const,
        mimeType,
        base64: bytesToBase64(bytes),
        byteSize: bytes.byteLength,
        alt,
      };
    };

    let matchOutcome = "";
    for (const url of urls) {
      const attempts: Array<"omit" | "include"> = url.startsWith("http") ? ["omit", "include"] : ["omit"];
      for (const credentials of attempts) {
        try {
          const response = await fetch(url, { credentials });
          if (!response.ok) continue;
          const declared = Number(response.headers.get("content-length"));
          if (Number.isFinite(declared) && declared > maxBytes) {
            if (urlsMatch(url, matchUrl)) matchOutcome = "too-large";
            continue;
          }
          const classified = await classify(await response.blob());
          if (classified.ok) return classified;
          if (urlsMatch(url, matchUrl)) matchOutcome = classified.reason;
        } catch {
          if (urlsMatch(url, matchUrl)) matchOutcome = matchOutcome || "unreadable";
        }
      }
    }

    for (const img of matched) {
      if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) continue;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) continue;
        context.drawImage(img, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), "image/png"));
        if (!blob) continue;
        const classified = await classify(blob);
        if (classified.ok) return classified;
      } catch {
        // A cross-origin image without CORS taints the canvas.
      }
    }

    if (matchOutcome === "too-large") return { ok: false as const, reason: "too-large" };
    if (matchOutcome === "unsupported") return { ok: false as const, reason: "unsupported" };
    return { ok: false as const, reason: "unreadable" };
  };

  void read().then(finish, () => finish({ ok: false, reason: "unreadable" }));
})();
