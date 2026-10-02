# EdgeEver Web Clipper source

This archive is the reviewable source for one Firefox Add-ons submission.
The archive root is `edgeever-source`. It contains the extension source,
the root package manifest, the Bun lockfile, workspace package manifests,
and the patch files `bun install --frozen-lockfile` requires.

Requirements:

- Bun 1.3.14 or later
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
