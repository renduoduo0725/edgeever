import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const bundleTestScripts = (names) => {
  // Isolate esbuild from Bun's test process, as in the Worker build tests.
  const entryPoints = names.map((name) =>
    fileURLToPath(new URL(`./src/${name}.ts`, import.meta.url)),
  );
  const bundleDirectory = mkdtempSync(join(tmpdir(), "edgeever-extension-test-"));
  const bundlePath = join(bundleDirectory, "scripts.json");
  let scripts;
  try {
    const bundled = spawnSync(process.execPath, ["--eval", `
      import { writeFileSync } from "node:fs";
      import { build } from "esbuild";
      const scripts = await Promise.all(${JSON.stringify(entryPoints)}.map(async (entry) =>
        (await build({ entryPoints: [entry], bundle: true, platform: "browser", conditions: entry.endsWith("/background.ts") ? ["worker"] : [], format: "iife", loader: { ".css": "empty" }, write: false })).outputFiles[0].text
      ));
      writeFileSync(${JSON.stringify(bundlePath)}, JSON.stringify(scripts));
    `], { cwd: import.meta.dir, encoding: "utf8" });
    if (bundled.error || bundled.status !== 0) {
      throw new Error(`Failed to bundle extension test scripts: ${bundled.error?.message || bundled.stderr}`);
    }
    scripts = JSON.parse(readFileSync(bundlePath, "utf8"));
  } finally {
    rmSync(bundleDirectory, { recursive: true, force: true });
  }
  return scripts;
};
