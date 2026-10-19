import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import { chromium } from "@playwright/test";

// A fresh Chrome profile and a read-only mock session keep this audit independent
// of saved accounts, service workers, API latency and the developer's local data.
const root = resolve(process.argv[2] ?? "apps/web/dist");
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/api/")) return Response.json(pathname === "/api/v1/auth/session"
      ? { authRequired: true, authenticated: false, demoMode: false, user: null }
      : {});
    const path = resolve(root, `.${decodeURIComponent(pathname)}`);
    if (path !== root && !path.startsWith(root + sep)) return new Response(null, { status: 404 });
    let file = Bun.file(path);
    if (path === root || !await file.exists()) file = Bun.file(resolve(root, "index.html"));
    return new Response(file, { headers: { "Cache-Control": "no-store" } });
  },
});
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ locale: "en-US", serviceWorkers: "block" });
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  page.on("request", request => requests.push(request.url()));
  page.on("pageerror", error => errors.push(error.message));
  const start = performance.now();
  await page.goto(`http://127.0.0.1:${server.port}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="password"]').waitFor();
  const loginReadyMs = Math.round(performance.now() - start);
  await page.waitForLoadState("networkidle");
  const resources = await page.evaluate(() => performance.getEntriesByType("resource")
    .map(resource => ({ name: resource.name, bytes: resource.decodedBodySize })));
  const scripts = resources.filter(resource => /\.m?js(?:\?|$)/.test(resource.name));
  const javascriptBytes = scripts.reduce((total, resource) => total + resource.bytes, 0);
  const fontRequests = requests.filter(url => /\.(?:woff2?|ttf|otf)(?:\?|$)/.test(url));
  const eagerEditors = requests.filter(url => /\/(?:vendor-(?:beautiful-mermaid|mermaid|x6|infographic|codemirror|streamdown|tiptap|code-highlight)|(?:EditorPane|DiagramEditorPane|PosterEditorPane|TableEditorPane)-)/.test(new URL(url).pathname));
  assert.deepEqual(errors, [], "Startup must render without JavaScript errors");
  assert.deepEqual(fontRequests, [], "System typography must not download fallback or optional fonts");
  assert.deepEqual(eagerEditors, [], "Login must not fetch editor or diagram runtimes");
  assert.ok(javascriptBytes <= 1.25 * 1024 * 1024, `Login JavaScript exceeds 1.25 MiB: ${javascriptBytes}`);
  // Loading the deferred modules must still succeed after separating their
  // shared dependencies; this catches circular initialization failures.
  const deferredEditors = readdirSync(resolve(root, "assets"))
    .filter(file => /^(?:WorkspaceApp|EditorPane|DiagramEditorPane|PosterEditorPane|TableEditorPane|InfographicEditorPane)-.*\.js$/.test(file));
  for (const file of deferredEditors) await page.evaluate(async name => { await import(`/assets/${name}`); }, file);
  assert.deepEqual(errors, [], "Deferred editor modules must initialize without JavaScript errors");
  console.log(JSON.stringify({ ok: true, loginReadyMs, javascriptBytes, javascriptRequests: scripts.length, fontRequests: fontRequests.length, eagerEditors: eagerEditors.length, deferredEditors: deferredEditors.length }));
} finally {
  await browser?.close();
  server.stop(true);
}
