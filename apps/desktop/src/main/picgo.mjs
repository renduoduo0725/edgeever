// PicGo owns uploader credentials. This bridge only sends image bytes to its
// local HTTP server; it never reads the clipboard or writes temporary files.
export const normalizePicGoEndpoint = (value) => {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    || url.username || url.password || url.hash || url.search || url.pathname !== "/upload") {
    throw new Error("Use a local PicGo address such as http://127.0.0.1:36677/upload");
  }
  return url;
};

const request = async (url, body, fetchImpl, timeoutMs) => {
  const response = await fetchImpl(url, {
    method: "POST", body, redirect: "error", signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`PicGo HTTP ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("PicGo returned an empty response");
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 65536) throw new Error("PicGo response is too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
};

export const testPicGoConnection = async (endpoint, { fetchImpl = fetch, timeoutMs = 5000 } = {}) => {
  const url = normalizePicGoEndpoint(endpoint);
  url.pathname = "/heartbeat";
  const data = await request(url, undefined, fetchImpl, timeoutMs);
  if (data?.success !== true || data.result !== "alive") throw new Error("The local service did not identify itself as PicGo");
  return true;
};

export const uploadPicGoImage = async (input, { fetchImpl = fetch, timeoutMs = 60000 } = {}) => {
  const url = normalizePicGoEndpoint(input.endpoint);
  const bytes = input.bytes;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > 50 * 1024 * 1024
    || typeof input.mimeType !== "string" || !input.mimeType.startsWith("image/")) {
    throw new Error("PicGo requires an image of up to 50 MB");
  }
  const form = new FormData();
  form.append("files", new Blob([bytes], { type: input.mimeType }), String(input.filename || "image.png"));
  const data = await request(url, form, fetchImpl, timeoutMs);
  if (data?.success !== true || !Array.isArray(data.result) || data.result.length !== 1) {
    throw new Error("PicGo did not return an uploaded image URL");
  }
  const result = new URL(data.result[0]);
  if (!["http:", "https:"].includes(result.protocol) || result.username || result.password) {
    throw new Error("PicGo returned an invalid image URL");
  }
  return { url: result.href };
};

export const createPicGoUploadQueue = ({ upload = uploadPicGoImage, chooseFailure, isActive }) => {
  let queue = Promise.resolve();
  return (input, isRequestActive = isActive) => {
    const run = async () => {
      while (true) {
        if (!isRequestActive()) throw new Error("The editor closed");
        try { return await upload(input); }
        catch {
          if (!isRequestActive()) throw new Error("The editor closed");
          const response = await chooseFailure(input);
          if (response === 1) return { fallback: true };
          if (response !== 0) throw new Error("PicGo upload cancelled");
        }
      }
    };
    const pending = queue.then(run);
    queue = pending.catch(() => {});
    return pending;
  };
};
