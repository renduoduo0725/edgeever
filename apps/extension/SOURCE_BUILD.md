# EdgeEver Web Clipper source

This archive is the reviewable source for one Firefox Add-ons submission.
The archive root is `edgeever-source`. It contains the extension source,
the root package manifest, the Bun lockfile, workspace package manifests,
the Web UI component sources imported by the extension,
and the patch files `bun install --frozen-lockfile` requires.

Requirements:

- The Bun version in the root `package.json` `packageManager` field (currently 1.3.14)
- Node.js 20 or later, required by `web-ext`

From the archive root:

```sh
bun install --frozen-lockfile
bun run test:extension
bun run build:extension:firefox
bun run lint:extension:firefox
bun run package:extension:firefox
```

The Firefox package is written to `apps/extension/web-ext-artifacts`.
The extension reads a page only after the user chooses a clip action, then
sends that content to the EdgeEver instance configured in the extension
settings. Review steps are in `apps/extension/FIREFOX_STORE_LISTING.md`.

Before store submission, the packaging command extracts this exact archive into
a clean temporary directory, installs with the frozen lockfile, and rebuilds
Firefox. Every rebuilt file must match the submission build by SHA-256.
