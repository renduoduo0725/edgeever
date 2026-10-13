import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSourceArchive, verifySourceArchive } from "./publish-web-clipper.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const staging = mkdtempSync(join(tmpdir(), "edgeever-extension-source-check-"));
try {
  const sourceZip = join(staging, "source.zip");
  createSourceArchive(repoRoot, sourceZip);
  verifySourceArchive({ sourceZip, referenceDirectory: join(repoRoot, "apps/extension/dist-firefox") });
} finally {
  rmSync(staging, { recursive: true, force: true });
}
