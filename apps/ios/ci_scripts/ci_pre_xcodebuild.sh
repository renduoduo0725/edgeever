#!/bin/sh
# Xcode Cloud — runs before xcodebuild (after ci_post_clone).
# Align CFBundleVersion with Cloud's managed build number and keep signing Automatic.
#
# Docs: docs/ios-xcode-cloud.md
set -euo pipefail

echo "==> EdgeEver Xcode Cloud pre-xcodebuild"

REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-}"
if [ -z "$REPO_ROOT" ]; then
  REPO_ROOT="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
fi
IOS_ROOT="$REPO_ROOT/apps/ios"
cd "$IOS_ROOT"

# Cloud stamps CFBundleVersion from App Store Connect "next build number".
# Mirror that into Version.xcconfig so the archive and any tooling agree.
# Also copy MARKETING_VERSION into the generated pbxproj so xcodegen cannot
# keep a stale CFBundleShortVersionString from project.yml.
MARKETING_VERSION=""
if [ -f Config/Version.xcconfig ]; then
  MARKETING_VERSION="$(sed -nE 's/^MARKETING_VERSION[[:space:]]*=[[:space:]]*([^[:space:]]+).*/\1/p' Config/Version.xcconfig | head -1)"
fi
if [ -n "${CI_BUILD_NUMBER:-}" ]; then
  echo "CI_BUILD_NUMBER=$CI_BUILD_NUMBER"
  if [ -f Config/Version.xcconfig ]; then
    # portable in-place edit (macOS sed)
    sed -i '' -E "s/^(CURRENT_PROJECT_VERSION[[:space:]]*=[[:space:]]*).*/\\1${CI_BUILD_NUMBER}/" Config/Version.xcconfig
    echo "Stamped CURRENT_PROJECT_VERSION=${CI_BUILD_NUMBER} into Config/Version.xcconfig"
    grep -E '^(MARKETING_VERSION|CURRENT_PROJECT_VERSION)' Config/Version.xcconfig || true
  fi
  if [ -f EdgeEver.xcodeproj/project.pbxproj ]; then
    sed -i '' -E "s/(CURRENT_PROJECT_VERSION = )[0-9]+;/\\1${CI_BUILD_NUMBER};/g" EdgeEver.xcodeproj/project.pbxproj
    echo "Stamped CURRENT_PROJECT_VERSION in project.pbxproj"
  fi
else
  echo "CI_BUILD_NUMBER unset (local dry-run); leaving Version.xcconfig unchanged"
fi
if [ -n "$MARKETING_VERSION" ] && [ -f EdgeEver.xcodeproj/project.pbxproj ]; then
  sed -i '' -E "s/(MARKETING_VERSION = )[^;]+;/\\1${MARKETING_VERSION};/g" EdgeEver.xcodeproj/project.pbxproj
  echo "Stamped MARKETING_VERSION=${MARKETING_VERSION} in project.pbxproj"
fi

# Defensive: ensure Automatic signing so Cloud can create Dev + Distribution profiles.
# (project.yml already prefers Automatic; this repairs accidental Manual settings.)
if [ -f EdgeEver.xcodeproj/project.pbxproj ]; then
  sed -i '' 's/CODE_SIGN_STYLE = Manual;/CODE_SIGN_STYLE = Automatic;/g' EdgeEver.xcodeproj/project.pbxproj
  # Drop fixed profile specifiers that force App Store-only profiles (break Dev/Ad Hoc export)
  sed -i '' '/PROVISIONING_PROFILE_SPECIFIER/d' EdgeEver.xcodeproj/project.pbxproj
  echo "Ensured CODE_SIGN_STYLE=Automatic and cleared PROVISIONING_PROFILE_SPECIFIER"
fi

echo "==> pre-xcodebuild complete"
