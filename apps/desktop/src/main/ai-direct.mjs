const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_AUDIO_REQUEST_BYTES = 25_000_000;
const MAX_CONCURRENT = 2;

// AI endpoints are user-configured and may be on the client's private network.
// Keep this separate from the public-only policy used by plugin requests.
export const validateAiProviderUrl = (value) => {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error("AI provider requests must use HTTP or HTTPS without URL credentials or fragments.");
  }
  return url;
};

export const createAiDirectRuntime = ({ fetchImpl = globalThis.fetch, maxConcurrent = MAX_CONCURRENT } = {}) => {
  const active = new Map();
  return {
    async open(requestId, input, { onData, onEnd, onError }) {
      if (typeof requestId !== "string" || requestId.length < 8 || requestId.length > 80) {
        throw new Error("Invalid AI provider request.");
      }
      if (!input || typeof input !== "object") throw new Error("Invalid AI provider request.");
      const method = input.method ?? "POST";
      if (method !== "POST" && !(method === "GET" && new URL(input.url).pathname.endsWith("/models"))) throw new Error("AI provider requests must use POST, or GET for model discovery.");
      const binaryBody = input.bodyBytes instanceof Uint8Array
        ? input.bodyBytes
        : input.bodyBytes instanceof ArrayBuffer ? new Uint8Array(input.bodyBytes) : null;
      if (input.bodyBytes != null && !binaryBody) {
        throw new Error("Invalid binary AI provider request body.");
      }
      if (binaryBody
        ? binaryBody.byteLength > MAX_AUDIO_REQUEST_BYTES
        : typeof input.body !== "string" || Buffer.byteLength(input.body) > MAX_BODY_BYTES) {
        throw new Error("AI provider request body is too large.");
      }
      const url = validateAiProviderUrl(input.url);
      const headers = {};
      if (input.headers && typeof input.headers === "object") {
        for (const [key, value] of Object.entries(input.headers)) {
          if (typeof key !== "string" || typeof value !== "string" || /[\r\n\0]/.test(key) || /[\r\n\0]/.test(value)) {
            throw new Error("Invalid AI provider header.");
          }
          if (["host", "connection", "transfer-encoding", "content-length", "upgrade", "proxy-authorization"].includes(key.toLowerCase())) {
            throw new Error("Invalid AI provider header.");
          }
          headers[key] = value;
        }
      }
      if (binaryBody && (
        !url.pathname.endsWith("/audio/transcriptions")
        || !Object.entries(headers).some(([key, value]) => key.toLowerCase() === "content-type" && /^multipart\/form-data;\s*boundary=/i.test(value))
      )) {
        throw new Error("Binary AI requests must be multipart speech transcriptions.");
      }
      if (active.size >= maxConcurrent || active.has(requestId)) throw new Error("Too many AI provider requests.");
      const controller = new AbortController();
      active.set(requestId, controller);
      try {
        const response = await fetchImpl(url.href, {
          method,
          headers,
          body: method === "GET" ? undefined : binaryBody ?? input.body,
          redirect: "error",
          signal: controller.signal,
        });
        const headerEntries = {};
        response.headers.forEach((value, key) => {
          headerEntries[key] = value;
        });
        queueMicrotask(async () => {
          try {
            if (!response.body) {
              onEnd();
              return;
            }
            const reader = response.body.getReader();
            while (!controller.signal.aborted) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value?.byteLength) onData(value);
            }
            onEnd();
          } catch (error) {
            if (!controller.signal.aborted) onError(error);
          } finally {
            active.delete(requestId);
          }
        });
        return { status: response.status, headers: headerEntries };
      } catch (error) {
        active.delete(requestId);
        throw error;
      }
    },
    cancel(requestId) {
      const controller = active.get(requestId);
      if (!controller) return false;
      controller.abort(new Error("AI provider request cancelled"));
      active.delete(requestId);
      return true;
    },
    get activeCount() {
      return active.size;
    },
  };
};
