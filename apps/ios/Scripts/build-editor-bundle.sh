#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/EditorSource"
OUT="$ROOT/EditorBundle"

cd "$SRC"
if ! command -v bun >/dev/null 2>&1 && ! command -v npm >/dev/null 2>&1; then
  echo "Need bun or npm to build EditorSource" >&2
  exit 1
fi

if command -v bun >/dev/null 2>&1; then
  bun install
  bun run build
else
  npm install
  npm run build
fi

# Ensure index.html exists at EditorBundle root for iOS resource load.
if [[ ! -f "$OUT/index.html" || ! -f "$OUT/font-picker.html" ]]; then
  echo "Editor bundle build did not produce index.html and font-picker.html" >&2
  exit 1
fi

# XcodeGen only packages paths under EdgeEver/Resources reliably — mirror there.
RES_OUT="$ROOT/EdgeEver/Resources/EditorBundle"
mkdir -p "$RES_OUT"
cp -f "$OUT/index.html" "$RES_OUT/index.html"
cp -f "$OUT/font-picker.html" "$RES_OUT/font-picker.html"
if [[ -d "$OUT/assets" ]]; then
  mkdir -p "$RES_OUT/assets"
  rsync -a --delete "$OUT/assets/" "$RES_OUT/assets/"
fi
echo "Built EditorBundle → $OUT (mirrored to $RES_OUT)"
