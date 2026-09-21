# Mobile Store Delivery

GitHub Releases and mobile store delivery are separate operations:

- `bun run release` creates and audits the GitHub Release. Android assets cannot
  be published until they pass the Play app-signing gate. When the audited
  range includes iOS runtime changes, the same command also starts Xcode Cloud
  and submits the resulting build to App Review. An iOS failure leaves the
  GitHub Release published; retry with `bun run publish:stores`.
- `bun run publish:stores` dispatches a store-delivery workflow for a matching
  Draft or an existing formal Release tag. When Android is rebuilt, run it
  against the Draft so the Play-signed APK replaces the temporary locally
  signed APK before publication. Omit `--ios-build-number` to start Xcode Cloud;
  pass it only to submit an already uploaded App Store Connect build.
- Store delivery is the authorization to submit. By default, Google Play uses
  the Production track, while iOS continues from App Store Connect upload into
  App Review. Approved builds are released automatically.

## Safety Model

The workflow checks out the immutable Release tag rather than `main`. Before any
store build starts, it verifies that:

- the tag belongs to a matching Draft or formal, non-prerelease GitHub Release;
- the Release target and Git tag resolve to the same commit;
- the audited range since the previous formal Release contains mobile runtime
  changes;
- root and mobile app versions both match the Release tag;
- Android `versionCode` increased.

A Release that reused the previous store binary for the selected platform is
intentionally rejected. It does not represent a new store binary and should not
be uploaded again. Android delivery requires `apps/mobile` runtime changes and
an increased `versionCode`. iOS delivery requires `apps/ios` or shared editor
runtime changes and `MARKETING_VERSION` equal to the Release tag.

The publication gate accepts only `ANDROID_PLAY_APP_SIGNER_SHA256`. An APK
signed by the local upload certificate may temporarily exist in a Draft for
store processing, but cannot become the final Android asset of a formal
Release. A failed gate leaves the Release as a Draft. If someone bypasses the
release command and publishes manually, the `published` audit rejects that APK
and restores Draft state.

## Prerequisites

Configure these GitHub repository secrets:

- `EXPO_TOKEN`
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_PLAY_APP_SIGNER_SHA256`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64`
- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY_P8_BASE64`

Upload the Google Play service-account key to the Android application's EAS
Submit credentials, and store the same service-account JSON as base64 in the
repository secret listed above. Copy the SHA-256 fingerprint of the **app
signing certificate** (not the upload certificate) from Play Console into
`ANDROID_PLAY_APP_SIGNER_SHA256`. Configure the iOS distribution credentials
and App Store Connect API key in EAS. Credentials and private keys must remain
outside the repository.

Create these GitHub Environments:

- `store-delivery` for Android testing tracks and Apple App Review delivery.
- `store-production` for Google Play production delivery.

EAS Submit requires the application to exist in each store and Google Play API
submission requires the service account to have access to the application.
Follow the official
[EAS Android submission guide](https://docs.expo.dev/submit/android/) and
[EAS Submit configuration reference](https://docs.expo.dev/submit/eas-json/).

## Commands

Submit both platforms to Google Play Production and Apple App Review when
both runtimes changed:

```sh
bun run publish:stores -- --release v1.7.0
```

Deliver only iOS, starting the Manual Xcode Cloud Archive workflow:

```sh
bun run publish:stores -- --release v1.7.0 --platform ios
```

Prepare the Android Play-signed asset for a Draft before formal publication:

```sh
bun run publish:stores -- \
  --release v1.7.0 \
  --platform android \
  --android-track production
```

Deliver only Android to a closed testing track:

```sh
bun run publish:stores -- \
  --release v1.7.0 \
  --platform android \
  --android-track beta
```

Use `--dry-run` to print the GitHub workflow dispatch without starting it.

## Platform Behavior

### Google Play

The self-hosted release runner builds an `arm64-v8a` signed AAB from the
selected tag, verifies its signature and R8 mapping, preserves both as GitHub
Actions artifacts, and uploads the AAB through EAS Submit.

After Google Play finishes processing the bundle, the workflow downloads the
Play-signed universal APK, verifies the pinned app-signing certificate, and
replaces the Draft or formal GitHub Release Android asset. A Draft replacement
must also pass the independent pre-publication signature gate. This makes installations from
Google Play and GitHub mutually updateable. The uploaded AAB is intentionally
limited to `arm64-v8a`, so the Play-generated universal APK does not bundle
unused 32-bit ARM or x86 native libraries. Automatic Protection must be
disabled for the release. The downloader fails closed when Play reports
installer-locked artifacts, preventing a protected APK from being published
for GitHub sideloading.

Internal, Alpha, Beta, and Production profiles use a completed release on the
selected track. The default command targets Production; use
`--android-track internal`, `alpha`, or `beta` only when a testing delivery is
explicitly requested.

### App Store Connect

Native iOS store binaries come from **`apps/ios`** (SwiftUI), not Expo EAS.
On macOS beta hosts, archives must go through **Xcode Cloud** so
`BuildMachineOSBuild` is a release OS image — see
[iOS Xcode Cloud](ios-xcode-cloud.md). The store-delivery workflow starts that
Manual Archive workflow on its configured default branch, requires the Cloud
source's `MARKETING_VERSION` to match the Release tag, waits until App Store Connect marks the
build Valid, then Fastlane (`apps/ios` `submit_review`) submits App Review and
configures automatic release after approval. Pass `--ios-build-number` only to
reuse an already uploaded build. Missing metadata, agreements, review
information, or credentials cause the workflow to fail without submitting a
different build.

Store listing localizations (including Japanese) live in
`apps/mobile/store-assets/` and are pasted in App Store Connect and Play
Console. Do not add a new locale to Fastlane `submit_review` until that
locale is complete in the console. An incomplete localization can fail
App Review without changing the binary.
