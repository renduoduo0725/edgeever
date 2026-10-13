import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extname, join, normalize, relative, resolve } from "node:path";
import { runInNewContext } from "node:vm";

// Exercise the production static handler without starting the database or API.
const source = readFileSync(new URL("./self-hosted-server.mjs", import.meta.url), "utf8");
const handlerSource = source.slice(source.indexOf("const contentTypes ="), source.indexOf("const server = Bun.serve"));
const webDirectory = resolve("/test/web");
const contents = new Map([
  [join(webDirectory, "assets/pdf.worker.mjs"), "export const WorkerMessageHandler = {};"],
  [join(webDirectory, "assets/app.js"), "export {};"],
  [join(webDirectory, "assets/unknown.bin"), "binary"],
]);
const serveStatic = runInNewContext(`${handlerSource}\nserveStatic;`, {
  extname, join, normalize, relative, resolve, webDirectory, URL, Response,
  Bun: { file(path) {
    const file = new Blob([contents.get(path) ?? ""]);
    file.exists = async () => contents.has(path);
    return file;
  } },
});

test("serves the PDF module worker with a JavaScript MIME type and its original bytes", async () => {
  const response = await serveStatic(new Request("http://localhost/assets/pdf.worker.mjs"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/javascript; charset=utf-8");
  assert.equal(await response.text(), "export const WorkerMessageHandler = {};");
});

test("preserves JavaScript and unknown-file content types", async () => {
  for (const [name, expected] of [["app.js", "text/javascript; charset=utf-8"], ["unknown.bin", "application/octet-stream"]]) {
    const response = await serveStatic(new Request(`http://localhost/assets/${name}`));
    assert.equal(response.headers.get("Content-Type"), expected);
  }
});
