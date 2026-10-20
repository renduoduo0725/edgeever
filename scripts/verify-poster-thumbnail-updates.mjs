// Run with Node (native TypeScript support). A temporary source fixture and Chrome exercise the real Vite
// watcher and renderer; no working-tree templates or user notes are changed.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, cp, readFile, writeFile, symlink, rm, stat } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "vite";
import { automaticPosterThumbnails } from "../apps/web/poster-thumbnails.ts";
import { sources, projectRoot, ensurePosterThumbnails, sourceState, thumbnailsCurrent } from "./prepare-poster-thumbnails.mjs";

await ensurePosterThumbnails();
const root = await mkdtemp(path.join(tmpdir(), "edgeever-poster-watch-"));
let server;
const output = path.join(root, "apps/web/src/assets/poster-template-previews");
const readManifest = async () => JSON.parse(await readFile(path.join(output, "manifest.json"), "utf8"));
const waitCurrent = async (previousHash) => {
  const started = Date.now();
  while (Date.now() - started < 180_000) {
    const manifest = await readManifest();
    if (manifest.sourceHash !== previousHash && await thumbnailsCurrent(output, await sourceState(root))) return manifest;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Vite did not automatically synchronize thumbnails after a template save");
};
try {
  const copy = async relative => {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await cp(path.join(projectRoot, relative), path.join(root, relative), { recursive: true, force: true });
  };
  await copy("apps/web/src/lib");
  for (const relative of sources) await copy(relative);
  await copy("apps/web/src/assets/poster-template-previews");
  await symlink(path.join(projectRoot, "node_modules"), path.join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  await symlink(path.join(projectRoot, "apps/web/node_modules"), path.join(root, "apps/web/node_modules"), process.platform === "win32" ? "junction" : "dir");
  server = await createServer({
    configFile: false, root, logLevel: "error", appType: "mpa",
    plugins: [automaticPosterThumbnails({ root })],
    server: { host: "127.0.0.1", port: 0, fs: { allow: [root, projectRoot] } },
    optimizeDeps: { noDiscovery: true },
  });
  await server.listen();
  const file = path.join(root, "apps/web/src/lib/poster-design/vendor/qiaomu/templates.ts");
  const original = await readFile(file, "utf8");
  const before = await readManifest();
  const untouched = await stat(path.join(output, "folio.zh.webp"));
  assert(original.includes("bg: '#ffffff', bg2: '#ffffff', ink: '#171717'"));
  await writeFile(file, original.replace("bg: '#ffffff', bg2: '#ffffff', ink: '#171717'", "bg: '#e8f4ff', bg2: '#e8f4ff', ink: '#171717'"));
  const changed = await waitCurrent(before.sourceHash);
  for (const template of before.templates) {
    const next = changed.templates.find(entry => entry.id === template.id);
    for (const language of ["zh", "en"]) {
      assert.equal(next[language].sha256 !== template[language].sha256, template.id === "minimal", `Unexpected refresh: ${template.id}/${language}`);
    }
  }
  assert.equal((await stat(path.join(output, "folio.zh.webp"))).mtimeMs, untouched.mtimeMs);
  console.log("PASS: saving one template automatically regenerates only its two thumbnails; other files stay untouched");

  const saved = await readFile(file, "utf8");
  await writeFile(file, `${saved}\nTEMPLATES.push({ ...TEMPLATES[0]!, id: "watch-test-new", build: () => ({ background: solid("#abcdef"), objects: [rect(30, 30, 100, 100, "#123456")] }) });\n`);
  const added = await waitCurrent(changed.sourceHash);
  assert(added.templates.some(template => template.id === "watch-test-new"));
  for (const template of changed.templates) {
    const next = added.templates.find(entry => entry.id === template.id);
    assert.equal(next.zh.sha256, template.zh.sha256);
    assert.equal(next.en.sha256, template.en.sha256);
  }
  console.log("PASS: adding a template automatically creates its Chinese and English images without redrawing existing templates");

  await writeFile(file, saved);
  const removed = await waitCurrent(added.sourceHash);
  assert(!removed.templates.some(template => template.id === "watch-test-new"));
  await assert.rejects(readFile(path.join(output, "watch-test-new.zh.webp")), { code: "ENOENT" });
  console.log("PASS: deleting a template automatically removes its generated images");
} finally {
  await server?.close();
  // node_modules is a link to dependencies, never recursively remove its target.
  await rm(path.join(root, "node_modules"), { force: true, recursive: false }).catch(() => {});
  await rm(root, { recursive: true, force: true });
}
