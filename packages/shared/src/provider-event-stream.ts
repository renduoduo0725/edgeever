export const consumeProviderEventStream = async (
  body: ReadableStream<Uint8Array>,
  onData: (payload: unknown) => void,
) => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const emit = (frame: string) => {
    for (const line of frame.split("\n")) {
      const data = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (!data || data === "[DONE]") continue;
      try {
        onData(JSON.parse(data));
      } catch {
        // Keep scanning; provider SSE can include comments or incomplete JSON.
      }
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) emit(frame);
      if (done) break;
    }
    if (buffer) emit(buffer);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
};

