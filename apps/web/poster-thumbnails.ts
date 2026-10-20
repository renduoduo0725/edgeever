import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { runPosterThumbnailGeneration, projectRoot, sources } from "../../scripts/prepare-poster-thumbnails.mjs";

/** Generate on build/startup and coalesce template saves while rendering. */
export function automaticPosterThumbnails({ root = projectRoot, generate = runPosterThumbnailGeneration } = {}): Plugin {
  let command: "build" | "serve";
  let server: ViteDevServer | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let pending = false;
  let closed = false;
  const inputs = sources.map(source => path.resolve(root, source));
  const isInput = (file: string) => inputs.some(input => file === input || file.startsWith(`${input}${path.sep}`));
  const schedule = (file: string) => {
    if (closed || !isInput(path.resolve(file))) return;
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(drain, 300);
  };
  const drain = () => {
    if (closed || running) return;
    running = (async () => {
      while (pending && !closed) {
        pending = false;
        try {
          const result = await generate({ root });
          if (!result.skipped) server?.ws.send({ type: "full-reload" });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          server?.config.logger.error(`[poster thumbnails] ${message}`);
          server?.ws.send({ type: "error", err: { message, stack: error instanceof Error ? error.stack ?? "" : "" } });
        }
      }
    })().finally(() => { running = undefined; });
  };
  return {
    name: "edgeever-automatic-poster-thumbnails",
    configResolved(config) { command = config.command; },
    async buildStart() {
      if (command === "build") await generate({ root });
    },
    async configureServer(devServer) {
      server = devServer;
      await generate({ root });
      server.watcher.add(inputs);
      server.watcher.on("add", schedule).on("change", schedule).on("unlink", schedule);
    },
    async closeBundle() {
      closed = true;
      clearTimeout(timer);
      server?.watcher.off("add", schedule).off("change", schedule).off("unlink", schedule);
      await running;
    },
  };
}
