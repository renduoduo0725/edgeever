export type FontLoadStatus = "idle" | "loading" | "ready" | "error";

/** A newer request owns the status; late completions cannot overwrite it. */
export const createFontLoadState = () => {
  let status: FontLoadStatus = "idle";
  let generation = 0;
  const listeners = new Set<() => void>();
  const publish = (next: FontLoadStatus) => {
    if (status === next) return;
    status = next;
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => status,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reset: () => { generation++; publish("idle"); },
    async run<T>(load: () => Promise<T>): Promise<T> {
      const request = ++generation;
      publish("loading");
      try {
        const result = await load();
        if (request === generation) publish("ready");
        return result;
      } catch (error) {
        if (request === generation) publish("error");
        throw error;
      }
    },
  };
};

/** Content and the name preview must both succeed before showing ready. */
export const combineFontLoadStatus = (content: FontLoadStatus, preview: FontLoadStatus): FontLoadStatus => {
  if (content === "error" || preview === "error") return "error";
  if (content === "idle" && preview === "idle") return "idle";
  return content === "ready" && preview === "ready" ? "ready" : "loading";
};
