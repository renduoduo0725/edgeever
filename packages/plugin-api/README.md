# @edgeever/plugin-api

Public TypeScript contracts and runtime manifest helpers for EdgeEver client plugins and code-free themes.

```ts
import { definePlugin } from "@edgeever/plugin-api";

export default definePlugin({
  activate(context) {
    return context.commands.register({
      id: "hello",
      title: "Hello",
      run: () => context.ui.showNotice("Hello from EdgeEver"),
    });
  },
});
```

The package ships ESM JavaScript and TypeScript declarations. Plugin bundles must produce a single `main.js` file without relative imports before distribution. See the EdgeEver plugin development guide for the Manifest format, permissions, settings Schema, release assets, and marketplace verification rules.

Desktop plugins can declare the `schedules` permission and idempotently schedule one of their own registered commands:

```ts
context.commands.register({ id: "refresh", title: "Refresh", run: refresh });
await context.schedules.upsert({
  key: "hourly-refresh",
  name: "Hourly refresh",
  commandId: "refresh",
  cronExpression: "0 * * * *",
});
```

Conflict-safe Markdown edits use the note baseline returned by `context.notes.get()`:

```ts
const note = await context.notes.get(noteId);
await context.notes.editMarkdown(noteId, {
  expectedRevision: note.revision,
  expectedContentHash: note.contentHash,
  edits: [{ from: 0, to: 0, insert: "- [ ] New task\n" }],
});
await context.ui.openNote(noteId, { search: "New task" }); // requires ui:navigation
```

Bulk-indexing plugins can page through `context.notes.queryContent()`. The API also exposes workspace templates, full live-editor reads and range edits, template mutation events, and programmatic opening of a plugin's own registered panels.

Speech plugins can transcribe a note attachment with `context.ai.transcribeResource(noteId, resourceId)`, or pass an audio/video `Blob` or `File` to `context.ai.transcribeMedia(media)`. EdgeEver extracts audio on the client and calls the user's configured speech provider directly. Neither method accepts a media URL or returns the provider credential.

Dashboard and workflow panels can ask EdgeEver to render system chrome (header actions, search, tabs, selects, empty states) through `mount` context `shell.set()`, while the plugin keeps owning the body DOM.

Canvas-style plugins can read and conflict-safely replace resource bytes, open full-screen guarded panels with JSON state, and register constrained block embed renderers:

```ts
const [resource] = await context.resources.list(noteId);
const scene = await context.resources.read(resource.id);
await context.resources.update(resource.id, {
  file: new File([scene], "drawing.excalidraw"),
  expectedContentHash: resource.contentHash!,
});

context.editor.embeds.register({ type: "drawing", mount(container, embed) {} });
await context.editor.insertEmbed({ type: "drawing", resourceId: resource.id, title: "Drawing" });
```

Structured notes expose `kind` and full read-only `contentJson` / `contentMarkdown`. Use `context.diagrams.get()` / `edit()` for graph nodes and edges, or `context.tables.get()` / `edit()` for fields, records, and cells. Both require the revision, content hash, and snapshot `editToken` returned by their dedicated read:

```ts
const snapshot = await context.tables.get(noteId);
await context.tables.edit(noteId, {
  expectedRevision: snapshot.note.revision,
  expectedContentHash: snapshot.note.contentHash,
  expectedEditToken: snapshot.editToken,
  operations: [{ op: "update_record", recordId: "row-1", cells: { "field-1": "Updated" } }],
});
```

Use `dryRun: true` to preview batches without saving. Schema changes that affect populated cells additionally require `allowDataChanges: true`. Generic Markdown writes to special notes throw `STRUCTURED_NOTE_REQUIRED`; title/tag updates preserve their original body. Use `context.posters.get()` / `edit()` for element patches, layers, groups, and canvas changes, and `context.infographics.get()` / `edit()` for nested data, template, and theme changes. Both expose `capabilities()` and require the same revision/hash/snapshot baseline. Locked poster elements are protected; infographic changes must round-trip through the existing AntV parser without losing unrequested values or styles. See the [structured note guide](../../docs/plugin-development.md#reading-and-editing-structured-notes) for operations, limits, and migration errors.

Plugin writes use transactional local snapshot checks and refuse to reset unresolved sync conflicts. Desktop hosts must support the guarded native save method; older hosts throw `HOST_UPGRADE_REQUIRED` rather than falling back to an unguarded write. Native content, history, and outbox changes commit together. Cloud history retains the existing snapshot interval.
