# Lossless acceptance criteria for rich text and Markdown views

Related to [Issue #469](https://github.com/tianma-if/edgeever/issues/469). These criteria apply to ordinary notes in the TipTap rich text view and CodeMirror Markdown source view on Web and desktop, including their shared save path. They describe observable results for users; they do not require both views to use the same editor component.

## Three levels of preservation

| Level | Assertion | When it applies |
|---|---|---|
| Exact source | The Markdown string is strictly equal, including blank lines, spaces, escapes, entities, and line endings | The user has not changed the source, or saves from source view and reopens without subsequently editing rich text |
| Rich structure | The persisted TipTap document structure and user-visible attributes are equal | View switching only, or source edits outside rich-only structures |
| Editing semantics | Text, formatting, link targets, list hierarchy and checked state, table data, attachments, and other supported nodes retain their meaning | The user edits rich text, so Markdown serialization may change its spelling |

These levels must not be combined into a claim of universally byte-for-byte lossless Markdown round trips. After a rich text edit, serialization may rewrite blank lines, list markers, or escapes. The guarantee then concerns the editing semantics of supported content, not exact source spelling. Markdown alone cannot prove that rich-only attributes survived.

## Required scenarios

| Scenario | Acceptance assertion |
|---|---|
| A. Switch views without editing | Rich text → Markdown → rich text → Markdown, without typing or pasting: the second source is character-for-character equal to the first; the rich document is unchanged; switching alone causes no content change, save, or new revision. An existing note retains its stored source rather than being reformatted merely by opening the view. |
| B. Edit in source view | After saving, reopening, and entering source view, the source is exactly what the user submitted. Switching to rich text and back without editing rich text retains that source. Supported content in rich text matches the parsed source. Autosave hydration must not replace a live buffer or move its caret. |
| C. Edit in rich text view | After saving and reopening, rich content and its user-visible attributes are preserved. Re-parsing generated Markdown retains the semantics of supported content. Markdown spelling may be normalized, but plain `[`, `]`, and `&` must not appear as unnecessary `\[`, `\]`, or `&amp;`; escapes remain where removing them would change parsing. |
| D. Rich-only structures | Merely viewing source preserves rich-only structures and attributes exactly. Editing source elsewhere preserves unaffected rich-only structures. If an edit would degrade an affected structure, the UI must explain the specific loss before overwriting and allow cancellation. Silent structural loss fails acceptance. |
| E. Caret and focus | When switching within ordinary editable text, the caret or selection maps to the same visible content, focus enters the target editor, and the next keystroke does not land before or after an adjacent character. Within Markdown syntax or link destinations with no rich text edit position, a nearby safe position is acceptable; content must not change. |
| F. Conflicts and recovery | A–D continue to hold after autosave, offline draft recovery, and remote revision conflicts. A snapshot from another note must never be reused; conflict handling must not silently replace newer content with an older view. |

Silent deletion of body content, attachment references, or structures that Markdown cannot represent blocks acceptance in any test. “Equivalent Markdown syntax” does not excuse such deletion. If D cannot be met, preserve the original data and prevent a lossy overwrite until the user explicitly chooses to convert it.

## Fixtures and execution

Run A–C for every fixture, and D for fixtures with rich-only structures. Assert both rendered views and `contentJson` / `contentMarkdown` before and after persistence; screenshots or serialized strings alone are insufficient.

| Fixture | Required cases |
|---|---|
| Plain text | `Alpha [ ] & Bravo`, literal `&amp;`, brackets that could form a link, backslashes, dollar signs, spaces and consecutive blank lines, CRLF, Chinese, and emoji |
| Markdown structures | Headings, emphasis, links and destinations, inline and fenced code, blockquotes, nested lists, task state, GFM tables, Mermaid, math, and `details` |
| EdgeEver content | Images and galleries, file and PDF attachments, plugin embeds, merge dividers, task lists or multiple paragraphs inside a rich table cell, and rich-only attributes |
| Input and switching | Chinese and English IME composition, paste, undo/redo, caret at punctuation and formatting boundaries, selections, rapid repeated switching, and long notes |

Automation must cover conversion and snapshot assertions, save and reopen, and actual browser typing and caret placement. Issue #469 was reported on Windows 10 / Chrome 154 / zh-TW; reproduce on that environment or an equivalent Windows Chrome environment with documented differences before closing it. Changes to the storage format, migrations, or cross-version reading also require a real old-version → new-version note test. Record pass / fail / unverified, platform, and version for each case. Do not report an unverified case as passing.

## Current implementation and gaps (2026-10-04)

- The save path stores both `contentJson` and `contentMarkdown`. Source-view saves submit the user's source; rich-view saves derive Markdown from JSON on the server. Thus C does not promise exact source after a rich text edit.
- Existing unit tests cover readable source for plain `[`, `]`, and `&`, necessary escapes, unchanged-source snapshots, an untouched complex table cell, and some caret mapping. A local browser check covered continued typing after ordinary punctuation.
- A rich table cell containing a task list now accepts safe source edits to task text and checked state while keeping the list structure. If an edit cannot be mapped back safely, such as a table shape change, the editor reverts that edit and explains why; the user can change the structure in rich text view. Other rich-only structures still require fixture-by-fixture verification before declaring D fully met.
- A real Windows 10 / Chrome 154 check and save-and-reopen coverage for all fixtures have not been completed. No real cross-version test has been run; that test is a release gate if a storage or cross-version reading change is introduced. Do not claim Issue #469 meets the full lossless criteria on the current evidence.

Implementation references: [`editor-mode-content.ts`](../apps/web/src/components/editor/editor-mode-content.ts), [`useEditorMarkdownMode.ts`](../apps/web/src/components/editor/useEditorMarkdownMode.ts), [`content.ts`](../packages/shared/src/content.ts), and [`memo-service.ts`](../apps/api/src/memo-service.ts).
