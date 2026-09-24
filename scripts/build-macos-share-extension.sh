#!/bin/bash
# Build the macOS share extension that receives WeChat's merged-forward ZIP.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
source_directory="$root/apps/desktop/share-extension"
version="$(node -e "console.log(require('$root/apps/desktop/package.json').version)")"
arch="${EDGE_EVER_DESKTOP_ARCH:-}"
if [[ -z "$arch" ]]; then
  case "$(uname -m)" in
    arm64) arch="arm64" ;;
    x86_64) arch="x64" ;;
    *) echo "Unsupported Mac architecture: $(uname -m)" >&2; exit 1 ;;
  esac
fi
case "$arch" in
  arm64) target="arm64-apple-macos13.0" ;;
  x64) target="x86_64-apple-macos13.0" ;;
  *) echo "EDGE_EVER_DESKTOP_ARCH must be arm64 or x64, received: $arch" >&2; exit 1 ;;
esac

sdk="$(xcrun --sdk macosx --show-sdk-path)"
appex="$source_directory/dist/EdgeEverShare.appex"
rm -rf "$appex"
mkdir -p "$appex/Contents/MacOS"
sed \
  -e "s/__MARKETING_VERSION__/${version}/g" \
  -e "s/__BUILD_VERSION__/${version}/g" \
  "$source_directory/Info.plist" > "$appex/Contents/Info.plist"
plutil -lint "$appex/Contents/Info.plist" >/dev/null
swiftc \
  -O \
  -parse-as-library \
  -application-extension \
  -target "$target" \
  -sdk "$sdk" \
  -module-name EdgeEverShare \
  -emit-executable \
  -Xlinker -e -Xlinker _NSExtensionMain \
  -o "$appex/Contents/MacOS/EdgeEverShare" \
  "$source_directory/ShareViewController.swift"
if ! xcrun nm -u "$appex/Contents/MacOS/EdgeEverShare" | grep -q '_NSExtensionMain'; then
  echo "Share extension is missing the NSExtensionMain entry point" >&2
  exit 1
fi
chmod 755 "$appex/Contents/MacOS/EdgeEverShare"
codesign \
  --force \
  --sign - \
  --entitlements "$source_directory/EdgeEverShare.entitlements" \
  --generate-entitlement-der \
  "$appex"
echo "Built $appex ($target)"
