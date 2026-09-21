# iOS App Store builds via Xcode Cloud

## Why

Local Macs on **macOS beta** stamp binaries with `BuildMachineOSBuild` from the beta OS. App Store Connect then rejects the upload as **ITMS-90111** (often worded as “Unsupported SDK or Xcode version”), even when using a **release** Xcode.

**Policy for this repo:**

| Work | Where |
| --- | --- |
| Day-to-day coding, Simulator, device debug | **Local Mac** (beta OS OK) |
| Archive / TestFlight / App Store binary | **Xcode Cloud only** (started by store-delivery or a manual control workflow) |

Xcode Cloud is billed as **25 compute hours per month** with the Apple Developer Program. Keep the Cloud workflow start condition **Manual** so git pushes do not consume hours; formal Releases start it through the App Store Connect API.

Native store target: **`apps/ios`** (SwiftUI). Expo `apps/mobile` is not the iOS store path.

## One-time setup

### Xcode / App Store Connect

1. Open the project:
   ```sh
   cd apps/ios
   xcodegen generate   # if needed
   open EdgeEver.xcodeproj
   ```
2. **Xcode → Product → Xcode Cloud → Create Workflow…** (or Report navigator → Cloud).
3. Product: **EdgeEver** (`org.edgeever.mobile`), repository `tianma-if/edgeever`.
4. When asked for the project path in a monorepo, select **`apps/ios/EdgeEver.xcodeproj`**.
5. **Workflow settings (important):**
   - **Start condition:** **Manual** only — do **not** start on every git push / PR (saves the 25h quota). Formal Releases start this workflow through the App Store Connect API.
   - **Actions:** **Archive** (scheme `EdgeEver`, platform iOS).
   - **Deployment preparation:** App Store Connect / App Store eligible (or TestFlight Internal Only).
   - **Xcode / macOS:** latest **release** — not a beta toolchain.
6. Signing: project uses **Automatic** signing so Xcode Cloud can mint Development + Distribution profiles. First run may ask the Account Holder to confirm certificates in App Store Connect.
7. Grant GitHub access for the primary repo only. Public SPM deps (`GRDB`, `Pow`) do **not** need Connect.

### Shared secrets (auto-upload)

In **App Store Connect → EdgeEver → Xcode Cloud → Settings → Shared Environment Variables**, add (secret):

| Variable | Value |
| --- | --- |
| `APP_STORE_CONNECT_API_KEY_ID` | Key ID (e.g. from Users and Access → Integrations → App Store Connect API) |
| `APP_STORE_CONNECT_API_ISSUER_ID` | Issuer ID |
| `APP_STORE_CONNECT_API_KEY_P8_BASE64` | Entire `.p8` file contents, base64-encoded |

`ci_post_xcodebuild.sh` uses these to run `altool` after the archive so the IPA reaches ASC even if secondary Development/Ad Hoc exports fail.

Encode the key:

```sh
base64 -i AuthKey_XXXX.p8 | tr -d '\n'
```

### Build number (source of truth)

Xcode Cloud **overwrites** `CFBundleVersion` with its managed counter:

**App Store Connect → EdgeEver → Xcode Cloud → Settings → Build Number → Next build number**

Rules:

1. Next Cloud number must be **greater than** every build already on ASC for this app.
2. Keep `apps/ios/Config/Version.xcconfig` as the only marketing-version source.
   Do not hardcode `MARKETING_VERSION` in `project.yml`; Cloud runs `xcodegen`
   in `ci_post_clone`, and a stale YAML value would archive the previous App
   Store version. `ci_pre_xcodebuild.sh` copies the xcconfig version into the
   generated pbxproj and stamps Cloud’s `CI_BUILD_NUMBER` into
   `CURRENT_PROJECT_VERSION`.
3. Before a store run, from a machine with API credentials:

   ```sh
   cd apps/ios
   export APP_STORE_CONNECT_API_KEY_ID=...
   export APP_STORE_CONNECT_API_ISSUER_ID=...
   export APP_STORE_CONNECT_API_KEY_P8_BASE64=...   # or install AuthKey_*.p8 under ~/.appstoreconnect/private_keys/
   bash Scripts/ensure-xcode-cloud-build-number.sh
   ```

   Then set the ASC “next build number” UI to the printed `recommended_next_cloud_build` (or higher) if the UI is not already there.

## What the repo provides

| Path | Role |
| --- | --- |
| `scripts/xcode-cloud-control.py` | Start/monitor Cloud and wait until the App Store build is Valid |
| `apps/ios/ci_scripts/ci_post_clone.sh` | bun + XcodeGen + EditorBundle + `xcodegen generate` |
| `apps/ios/ci_scripts/ci_pre_xcodebuild.sh` | Stamp `CI_BUILD_NUMBER`; force Automatic signing |
| `apps/ios/ci_scripts/ci_post_xcodebuild.sh` | Upload App Store IPA via `altool` when secrets are set |
| `apps/ios/Scripts/upload-app-store-ipa.sh` | Manual upload of `.ipa` or Cloud `app-store.zip` |
| `apps/ios/Scripts/ensure-xcode-cloud-build-number.sh` | Recommend / sync next build number from ASC history |
| `apps/ios/EdgeEver.xcodeproj/xcshareddata/xcodecloud/manifest.json` | Cloud product linkage (commit this file) |

## Routine: ship a store binary

Formal Releases do this automatically when `apps/ios` or the shared editor
runtime changed: `bun run release` bumps `MARKETING_VERSION`, starts the Manual
Xcode Cloud Archive workflow, requires the Cloud source's marketing version
to match the Release tag, waits until the build is **Valid**, and submits App
Review. The Cloud workflow stays Manual, so Apple rejects starting it on a
tag that is not in the start condition. `project.yml` must not hardcode
`MARKETING_VERSION`; Cloud regenerates the Xcode project during `ci_post_clone`.

To retry or ship iOS without a new GitHub Release:

```sh
bun run publish:stores -- --release vX.Y.Z --platform ios
```

Pass `--ios-build-number N` only when the IPA is already on App Store Connect.

Manual Cloud controls remain available from
`.github/workflows/ios-xcode-cloud.yml` (`inspect` / `start` / `monitor`). Keep
Cloud **next build number** above the latest ASC build
(`ensure-xcode-cloud-build-number.sh`) if a Cloud run stamps a too-low
`CFBundleVersion`.

## Local archive (release macOS only)

```sh
cd apps/ios
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer bash Scripts/archive-app-store.sh
bash Scripts/upload-app-store-ipa.sh build/export/EdgeEver.ipa
```

On **macOS beta**, do **not** upload that IPA; use Xcode Cloud instead. `archive-app-store.sh` refuses beta hosts unless `EDGE_EVER_IOS_ALLOW_BETA_HOST=1`.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| ITMS-90111 after **local** upload | Host macOS is beta (`BuildMachineOSBuild`) | Use Xcode Cloud only for store binaries |
| Cloud run **FAILED** but `ARCHIVE_EXPORT` / App Store IPA exists | Development/Ad Hoc export lacks profiles | Automatic signing + Cloud managed certs; `ci_post_xcodebuild` still uploads App Store IPA |
| IPA `CFBundleVersion` is `1` or too low | Cloud “next build number” not advanced | ASC → Xcode Cloud → Build Number; run `ensure-xcode-cloud-build-number.sh` |
| Build never appears on ASC | Auto-upload secrets missing; or only Dev/Ad Hoc failed without App Store IPA | Set shared env secrets; or manual `upload-app-store-ipa.sh` |
| Cloud fails in post-clone on bun/xcodegen | Network / Homebrew on Cloud | Re-run; inspect `ci_post_clone` log |
| Editor blank in app | EditorBundle not built | Confirm `ci_post_clone` log shows bundle build |
| Hours running out | Workflow not Manual | Disable push/PR start conditions |
| PrepareBuildForAppStoreConnect fails with the previous live version (for example 1.74.0) | `project.yml` hardcoded `MARKETING_VERSION` and `xcodegen` overwrote `Version.xcconfig` | Keep marketing version only in `Config/Version.xcconfig`; `ci_pre_xcodebuild.sh` must stamp it into the pbxproj |

## Related

- `apps/ios/README.md` — generate / test / Fastlane submit
- `apps/ios/Scripts/archive-app-store.sh` — local archive
- `apps/ios/ci_scripts/*` — Cloud lifecycle hooks
