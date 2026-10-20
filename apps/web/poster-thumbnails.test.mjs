import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import path from "node:path";
import { automaticPosterThumbnails } from "./poster-thumbnails";
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const fixture = generate => {
  const watcher = new EventEmitter();
  watcher.add = () => watcher;
  const messages = [], errors = [];
  const server = { watcher, ws: { send: message => messages.push(message) }, config: { logger: { error: message => errors.push(message) } } };
  const root = path.resolve("/test-fixture");
  return { plugin: automaticPosterThumbnails({ root, generate }), server, messages, errors, input: path.join(root, "apps/web/src/lib/poster-design/templates.ts") };
};

test("normal builds automatically ensure thumbnails before building", async () => {
  let count = 0;
  const f = fixture(async () => { count++; return { generated: 0, skipped: true }; });
  f.plugin.configResolved({ command: "build" });
  await f.plugin.buildStart();
  expect(count).toBe(1);
});

test("dev startup ensures images; save bursts coalesce and generated assets do not recurse", async () => {
  let count = 0;
  const f = fixture(async () => { count++; return { generated: 2, skipped: false }; });
  await f.plugin.configureServer(f.server);
  f.server.watcher.emit("change", f.input);
  f.server.watcher.emit("change", f.input);
  f.server.watcher.emit("change", f.input);
  f.server.watcher.emit("change", path.resolve("/test-fixture/apps/web/src/assets/poster-template-previews/manifest.json"));
  await pause(500);
  expect(count).toBe(2);
  expect(f.messages.filter(message => message.type === "full-reload")).toHaveLength(1);
  await f.plugin.closeBundle();
  f.server.watcher.emit("change", f.input);
  await pause(350);
  expect(count).toBe(2);
});

test("a failed save reports an overlay and a subsequent save recovers", async () => {
  let count = 0;
  const f = fixture(async () => {
    if (++count === 2) throw new Error("invalid template");
    return { generated: 2, skipped: false };
  });
  await f.plugin.configureServer(f.server);
  f.server.watcher.emit("change", f.input);
  await pause(500);
  expect(f.errors[0]).toContain("invalid template");
  expect(f.messages[0].type).toBe("error");
  f.server.watcher.emit("change", f.input);
  await pause(500);
  expect(count).toBe(3);
  expect(f.messages[1].type).toBe("full-reload");
  await f.plugin.closeBundle();
});
