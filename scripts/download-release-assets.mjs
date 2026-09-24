import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const globToRegExp = (pattern) => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`);
};

export const selectReleaseAssets = (assets, patterns) => {
  const selected = [];
  for (const pattern of patterns) {
    const expression = globToRegExp(pattern);
    const matches = assets.filter((asset) => expression.test(asset.name));
    if (matches.length === 0) {
      throw new Error(`Release has no asset matching ${pattern}.`);
    }
    selected.push(...matches);
  }
  return selected;
};

const parseArgs = (argv) => {
  const options = { patterns: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--repo") options.repo = value;
    else if (argument === "--tag") options.tag = value;
    else if (argument === "--dir") options.dir = value;
    else if (argument === "--pattern") options.patterns.push(value);
    else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }
  if (!options.repo || !options.tag || !options.dir || options.patterns.length === 0) {
    throw new Error("Usage: download-release-assets.mjs --repo owner/name --tag vX.Y.Z --dir path --pattern glob");
  }
  return options;
};

const gh = (args, stdio = "pipe") => {
  const result = spawnSync("gh", args, { encoding: stdio === "pipe" ? "utf8" : undefined, stdio });
  if (result.status !== 0) {
    throw new Error(`gh ${args.join(" ")} failed: ${result.stderr || result.stdout || result.status}`);
  }
  return result.stdout;
};

export const downloadReleaseAssets = ({ repo, tag, dir, patterns }) => {
  const apiUrl = gh([
    "release", "view", tag,
    "--repo", repo,
    "--json", "apiUrl",
    "--jq", ".apiUrl",
  ]).trim();
  const assets = JSON.parse(gh(["api", apiUrl]));
  const selected = selectReleaseAssets(assets.assets ?? [], patterns);
  mkdirSync(dir, { recursive: true });
  for (const asset of selected) {
    const destination = join(dir, asset.name);
    const output = openSync(destination, "w");
    try {
      gh([
        "api",
        asset.url,
        "-H",
        "Accept: application/octet-stream",
      ], ["ignore", output, "inherit"]);
    } finally {
      closeSync(output);
    }
  }
  return selected.map((asset) => asset.name);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const names = downloadReleaseAssets(parseArgs(process.argv.slice(2)));
    console.log(names.join("\n"));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
