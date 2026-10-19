# Web Clipper store submission

Chrome, Edge, and Firefox listings are submitted by the official repository
workflow **Submit Web Clipper**. This is separate from `bun run release`.
A stable GitHub Release triggers the store workflow asynchronously. Store
submission does not block the GitHub Release, and review does not change it.

The extension has its own version in `apps/extension/package.json`, independent
of the main app version in the root `package.json`. For an extension-only release,
merge the change, then run the workflow manually on `main` with `release_tag`
left empty. A new GitHub Release for the main app is not required.

Edge users install the Chrome Web Store item
`gjadpfmanienmlofajibkfkkpfdkclgo`. One Chrome submission covers that item.
Firefox is a separate submission for `edgeever-web-clipper`. The workflow does
not publish to Microsoft Edge Add-ons.

The workflow builds the packages, uploads them, and submits them for review.
It does not approve the listing. Users stay on the last approved version until
Chrome and Mozilla each finish review. An uploaded version number cannot be
reused. Increase `apps/extension/package.json` before submitting changes.

Before either store is contacted, the command extracts the Firefox review source
ZIP into a clean directory, installs with the frozen lockfile, and rebuilds it.
Every output file must match the submission build by SHA-256; a mismatch stops
the command. The archive includes the shared Web UI components the extension
imports. Build CI watches these dependencies and runs the same rebuild check.
Both workflows use the Bun version from the checked-out root `package.json`.

## Run it

On https://github.com/tianma-if/edgeever/actions/workflows/extension-store.yml,
choose **Run workflow**. Leave the Firefox notes empty for a one-line version
note, or paste the notes Mozilla should show. `dry_run` builds the packages
and stops before calling either store.

The same command runs locally after the credentials below are available in the
environment:

```sh
bun run publish:extension -- --dry-run
bun run publish:extension -- --notes "What changed."
```

`--platform chrome` or `--platform firefox` retries one store. A Chrome
version that is already awaiting review is left in place. A Firefox version
that is awaiting review and has no source archive receives the source archive
on the next run.

The Actions log and Summary report each store separately: submission action,
API state, confirmed public version (when available), failure stage, and the
API's detailed error response or warnings. `submitted` / `already-submitted`
mean review submission, not publication; `STAGED` means approved but awaiting
publication. Only an API-confirmed public version or `PUBLISHED` state is
reported as published. The run does not wait for later review results.
Diagnostics redact credentials and private review notes; large error responses
are explicitly truncated. If the API returns only a generic error, use the
linked developer dashboard for requirements that the API does not expose.
After fixing a store-specific issue, retry only that platform.

## Credentials

Add these Actions secrets to `tianma-if/edgeever`. Forks do not run the job.

Chrome accepts either a service account or a refresh token. The service
account does not expire every few days:

1. In Google Cloud, enable the Chrome Web Store API and create a service
   account. Do not grant it extra project roles.
2. In the Chrome Web Store developer dashboard, under Account, add that
   service account email. The publisher can register one service account.
3. Create a JSON key and store the whole file as
   `CHROME_WEB_STORE_SERVICE_ACCOUNT_JSON`.

The refresh-token alternative uses `CHROME_WEB_STORE_CLIENT_ID`,
`CHROME_WEB_STORE_CLIENT_SECRET`, and `CHROME_WEB_STORE_REFRESH_TOKEN` for
scope `https://www.googleapis.com/auth/chromewebstore`. The Google account
needs 2-Step Verification. An OAuth client left in testing expires its refresh
token after seven days, so publish the consent screen or use the service
account.

Firefox uses an API key from
https://addons.mozilla.org/developers/addon/api/key/:

- `AMO_JWT_ISSUER`
- `AMO_JWT_SECRET`

These two optional secrets are added to the Firefox reviewer note:

- `EDGE_EVER_REVIEW_INSTANCE_URL`
- `EDGE_EVER_REVIEW_API_TOKEN`

Chrome's upload API has no release-notes field. The Chrome listing text and
privacy disclosure stay as they were last saved in the dashboard. Change those
in the dashboard when the permissions or the public description change.
Firefox receives the workflow notes as `en-US` release notes, plus the build
steps from `apps/extension/SOURCE_BUILD.md`.

The current Firefox listing uses license `AGPL-3.0-only`. The workflow sends
that license with every version.
