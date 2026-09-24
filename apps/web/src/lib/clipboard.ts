export const copyTextToClipboard = async (text: string) => {
  if (typeof window !== "undefined" && window.edgeeverDesktop?.isAvailable) {
    try {
      return await window.edgeeverDesktop.copyText(text);
    } catch {
      return false;
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to the textarea path below.
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
};

export const copyHtmlToClipboard = async (html: string, plainText: string) => {
  if (typeof window !== "undefined" && window.edgeeverDesktop?.isAvailable) {
    const copied = await window.edgeeverDesktop.copyHtml(html, plainText);
    if (!copied) throw new Error("Native rich clipboard verification failed");
    return;
  }

  if (navigator.clipboard && "ClipboardItem" in window) {
    await navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plainText], { type: "text/plain" }),
    })]);
    return;
  }

  const selection = window.getSelection();
  const range = document.createRange();
  const container = document.createElement("div");
  container.setAttribute("contenteditable", "true");
  container.style.cssText = "position: fixed; left: -99999px; top: 0;";
  container.innerHTML = html;
  document.body.appendChild(container);
  range.selectNodeContents(container);
  selection?.removeAllRanges();
  selection?.addRange(range);
  const copied = document.execCommand("copy");
  selection?.removeAllRanges();
  container.remove();
  if (!copied) throw new Error("Clipboard copy was not available");
};

const toPngBlob = (blob: Blob): Promise<Blob | null> => {
  if (blob.type === "image/png") return Promise.resolve(blob);
  if (blob.type === "") return Promise.resolve(new Blob([blob], { type: "image/png" }));
  if (typeof document === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const image = document.createElement("img");
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d")?.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => resolve(png), "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
};

export const copyImageUrlToClipboard = async (url: string): Promise<boolean> => {
  const copyImage = typeof window !== "undefined" ? window.edgeeverDesktop?.copyImage : undefined;
  if (copyImage) {
    try {
      const response = await fetch(url);
      if (!response.ok) return false;
      return await copyImageBlobToClipboard(await response.blob());
    } catch {
      return false;
    }
  }

  if (typeof window === "undefined" || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    return false;
  }

  try {
    // Safari keeps the click gesture only when write() runs now and the
    // ClipboardItem payload is still a Promise. Fetch and PNG conversion stay inside it.
    const pngPromise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Image fetch failed");
        return response.blob();
      })
      .then((blob) => toPngBlob(blob))
      .then((png) => {
        if (!png) throw new Error("PNG conversion failed");
        return png;
      });
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": pngPromise,
      }),
    ]);
    return true;
  } catch (error) {
    console.warn("Failed to copy image URL to clipboard:", error);
    return false;
  }
};

export const copyImageBlobToClipboard = async (blob: Blob): Promise<boolean> => {
  const copyImage = typeof window !== "undefined" ? window.edgeeverDesktop?.copyImage : undefined;
  if (copyImage) {
    // Renderer clipboard writes are denied in the desktop app. Text and HTML
    // already go through the main process; image bytes follow the same path.
    try {
      const png = await toPngBlob(blob);
      if (!png) return false;
      return await copyImage(new Uint8Array(await png.arrayBuffer()));
    } catch {
      return false;
    }
  }

  if (typeof window === "undefined" || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    return false;
  }

  try {
    // Safari keeps the click gesture only when write() runs now and the
    // ClipboardItem payload is still a Promise. JPEG conversion stays inside it.
    const pngPromise = toPngBlob(blob).then((png) => {
      if (!png) throw new Error("PNG conversion failed");
      return png;
    });
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": pngPromise,
      }),
    ]);
    return true;
  } catch (error) {
    console.warn("Failed to write image blob to clipboard:", error);
    return false;
  }
};

