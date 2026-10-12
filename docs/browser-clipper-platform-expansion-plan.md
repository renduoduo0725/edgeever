# Browser clipper platform expansion plan

[简体中文](browser-clipper-platform-expansion-plan.zh-CN.md)

Related: [Issue #493](https://github.com/tianma-if/edgeever/issues/493). Updated: 2026-10-10. The user confirmed that Phase 1 contains **Facebook, Instagram, LinkedIn, Threads and Bluesky**. See [usage and verification](browser-clipper-platforms.md).

## Delivery phases

| Phase | Platforms | Required content |
| --- | --- | --- |
| 1 | Facebook, Instagram, LinkedIn, Threads, Bluesky | One selected post, its complete readable text, available author and publication time, images, and explicit quotations. |
| 2 | BOSS Zhipin, Xueqiu, Xiaoyuzhou | Job details; investment posts and explicit stock identifiers; full episode Show Notes and timestamps. |
| 3 | WeChat Official Accounts, Jike, V2EX, Substack, Medium | Articles, posts and topic supplements, preserving structure and original metadata. |
| To schedule | Sspai, Juejin, Douban, further Hacker News work | Article/code structure, reviews and submission metadata. |

Deliver independent PRs per phase. Earlier local Hacker News, V2EX and Xiaoyuzhou work remains available but does not redefine Phase 1.

## Phase 1 behavior

The toolbar clips a supported post detail page; a valid text selection retains priority. The platform command in a page context menu selects the post under the pointer, including supported feed cards. A small content script remembers only the clicked card’s permalink; it performs no network requests or automatic capture. Feed pages without a resolvable card prompt the user to open the post and retry.

Readers validate the selected post ID against its own header permalink or activity URN. Links in the body, comments and quoted posts do not establish the parent post’s identity. Navigation and message correlation are checked again before note creation. An unreadable recognized post fails explicitly rather than falling back to the entire page.

Only content already readable in the current page is captured. Facebook and LinkedIn expand a local post control when necessary, with a bounded wait. Instagram and Threads use loaded post data only when the same caption is readable in the matching DOM card. Missing carousel items and hidden collection remainders fail as incomplete. No login, private API, background crawling, video download or transcription is added.

Metadata includes canonical source URL, available author, separate publication and capture times, `web-clip` and the platform’s stable tag. Known timestamps use the browser system timezone at capture and `yyyy-MM-dd HH:mm:ss`; missing, date-only and relative values are not fabricated. Saved text is stable after later device timezone changes. Comments, controls and unrelated feed cards are excluded; scripts, dangerous protocols and active HTML are removed or escaped.

## Implementation boundaries

Reuse the existing instance API, notebook selection, save queue, locale messages and image-copy path. Platform URL routing and shared metadata live in `platform-clip.ts`; `social-clip.ts` handles the five readers; `social-target.ts` handles pointer targeting; `capture-platform.ts` performs extraction and local expansion; `background.ts` validates and saves results. Injected entries are standalone classic scripts for Chromium and Firefox. No server endpoints, authentication changes, migrations or dependencies are added.

Save text first, then copy images and replace URLs with existing edit-version protection. Transfer limits remain 30 images, 20 MiB per image, 60 MiB total and 45 seconds. Failures retain the note and usable external links, with partial-success feedback; they never create a second note or overwrite a concurrent user edit. Source-site-independent image access is verified from instance resource URLs, not promised as complete offline client caching.

## Verification and delivery

Use sanitized real-page DOM and data fixtures with source URLs and predeclared content expectations. Exercise each platform’s success, unreadable, incorrect identity and incomplete content cases. Test actual bundled menu/toolbar saving, pointer targeting, message identity, navigation, attachment failures and edit conflicts. Verify local API persistence and reopened editor content with the built extension; block original sources and check all expected image attachments.

Required checks:

```sh
bun run test:extension
bun run typecheck
bun run typecheck:mobile
bun run build:web
bun run build:extension
bun run build:extension:firefox
bun run lint:extension:firefox
bunx playwright test tests/e2e/web-clipper-platforms.spec.ts --project=chromium
```

Record code/test status separately from commit, PR, store publication and live acceptance. Signed-out samples and Chromium integration do not establish authenticated feed behavior or Edge/Firefox runtime acceptance. Page structure changes can cause a refusal or incomplete extraction; fail closed and retain explicit partial-image feedback. Rollback removes the affected route, menu and reader without changing saved notes or data. Preserve unrelated workspace changes.
