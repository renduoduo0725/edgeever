# Browser platform clips

[简体中文](browser-clipper-platforms.zh-CN.md)

Related to [Issue #493](https://github.com/tianma-if/edgeever/issues/493) and the [implementation plan](browser-clipper-platform-expansion-plan.md). Updated: 2026-10-11. Phase 1 implementation is prepared for PR review; extension-store publication and full cross-browser live acceptance remain pending.

## Phase 1: five social platforms (2026-10-10)

Facebook, Instagram, LinkedIn, Threads and Bluesky now have dedicated readers. Open a supported post and use the toolbar, or right-click the post card and choose its platform command. Selection capture retains priority. On an already open feed, reload the page so the target listener is installed; if the card cannot be resolved, open its detail page. No automatic capture or login is performed.

| Platform | Supported detail URLs | Saved content |
| --- | --- | --- |
| Facebook | `facebook.com/{account}/posts/{id}`, `permalink.php` and `story.php` | Full readable main post, author/organization, available time and loaded photos; excludes comments and controls. |
| Instagram | `instagram.com/p/{code}/`, `/reel/{code}/` | Complete readable caption, handle, time and all loaded carousel photos or video covers. |
| LinkedIn | `linkedin.com/posts/…-activity-{id}-…`, `/feed/update/urn:li:activity:{id}/` | Full post, publisher, time and complete loaded image collection. |
| Threads | `threads.com/@{handle}/post/{code}` and `threads.net` aliases | Full post, handle, time, loaded images and explicit quoted content. |
| Bluesky | `bsky.app/profile/{handle}/post/{id}` | Body, author, available time, full-size CDN images and visible quoted post. |

Tags are `web-clip` and `facebook`, `instagram`, `linkedin`, `threads` or `bluesky`. Videos are not downloaded. Missing carousel items, truncated text, login walls and incorrect IDs cause an explicit failure. Source identity uses the card header, excluding links inside body text and quoted posts. Hidden Meta cards cannot establish readability.

Signed-out real pages were sampled in Ego Chromium; all five pointer targets were verified live, including a Bluesky feed. Sanitized fixtures retain expected image counts 1/3/8/4/1 for Facebook/Instagram/LinkedIn/Threads/Bluesky. Actual bundled script tests cover toolbar/menu parity, feed selection, quoted content, queued right-clicks, navigation, incorrect identity and partial images. The Chromium persistence test loads the real extension against these fixtures and saves through the local API; its image endpoint is a controlled local server, not the live CDN. It verifies every expected attachment and reopened editor content after blocking the sources.

The PR includes this implementation and its regression checks. 210 extension tests, root/mobile typechecking, Web and Chromium/Firefox builds pass. Firefox lint retains two upstream Readability warnings. Authenticated feeds, Edge/Firefox runtime saves and Firefox Android remain unverified.


The eight-platform Chromium E2E passes (three earlier adapters plus Phase 1), including all expected image resources and reopened editor images, unreadable-page refusal and cleanup. Wrangler 4.112.0’s development proxy intermittently returns `503` on POST with “Your worker restarted mid-request.” This run used `EDGE_EVER_CLIPPER_TEST_INSTANCE_URL=http://127.0.0.1:64641` to reach the same local workerd API directly; that internal port must be resolved again for a new dev process. The default instance URL remains the test base URL. No production API or runtime code was changed. The installed Ego development extension was reloaded; existing source tabs need refreshing for the new target listener.

2026-10-11: Fixed Instagram carousels with individual slide captions being rejected as unreadable. The reader establishes readable content using the target permalink and the visible slide caption, while retaining every loaded slide caption and media cover, replacing a truncated parent prefix with complete slide text and preserving independent parent text. The live Google post `DeKe6teEpya` yielded the loaded parent caption and 20 covers (one video, 19 photos); regression checks cover different visible slides, hidden cards, unrelated text and missing carousel items. Videos themselves are not downloaded. The added sample passes Chromium E2E through the actual extension and local API, including all 20 archived images and reopening the note with source hosts blocked; this run used the default local instance URL.

2026-10-11: Added LinkedIn `ugcPost` share URLs and signed-in SDUI cards, retaining distinct UGC and activity identities. The main commentary supplies the exact UGC ID; comments and referenced links cannot supply it. The live sample `7497764716677758977` yields the complete text, Friends of NASA, the displayed relative publication time and eight images. LinkedIn safety redirects in archived text are unwrapped to their destinations without redirect tracking parameters. The targeted Chromium E2E passes through the actual extension, local API, eight image uploads and reopening the note with source hosts blocked, using the same workerd internal API address to bypass intermittent development proxy 503s. The full-suite attempt hit a proxy 503; its rerun stalled in the earlier Instagram browser flow and was interrupted, so this run does not claim a full-suite E2E pass. Test notes and tokens were cleaned up.

2026-10-11: Added signed-out LinkedIn UGC posts. Public cards declare both `data-activity-urn` and `data-attributed-urn`, while JSON-LD uses the activity URL. The reader matches the requested UGC identity through the card-root declaration and retains the requested source identity. Anonymous HTTP responses contain the full body, exact publication time and eight images; login is not required. Incorrect attribution IDs and links inside commentary remain rejected. The signed-out sample passes a targeted Chromium E2E through the actual extension and local API, including eight archived images displayed after reopening with source hosts blocked. The consecutive multi-state test did not finish, so this does not claim a full-suite E2E pass.

2026-10-11: Compared signed-in and signed-out clips of the same LinkedIn post in the local instance: body text, eight images and their order match. Removed author profile metadata (such as follower counts) accidentally prepended to the post; the same words within actual commentary remain intact. Signed-in and signed-out bodies share cleaning and Markdown conversion: normalize line breaks, redirects, hashtag links and bold styling added by LinkedIn to link labels. JSON-LD supplies full text only when visible commentary is incomplete. Both real-page samples produce identical body Markdown and link destinations in Chromium, retaining eight images each; the regression test directly compares both bodies. Publication times retain the exact or relative values supplied by each page. Existing notes are not rewritten automatically.

2026-10-11: Fixed readable caption matching for Threads `DeMqtuYgkaL`, whose visible link label is shortened. Compare the caption link against the actual href only within the exact post card and timestamp-permalink boundary; wrong targets remain rejected. The live reader yields the full caption, NASA, original publication time and one video cover. The video is not downloaded.

## Substack Notes and rendered articles

Save Substack Note detail URLs `https://substack.com/@{handle}/note/c-{id}` from the toolbar or their page context menu. Bind to the original author path, Note ID and header permalink, preferring the complete detail over a truncated recommendation card for the same post. Keep rendered paragraphs, formatting, author, source time and loaded attachments; exclude avatars, reactions, replies and sidebars. Hidden or truncated content fails explicitly. This adapter covers these detail URLs; feed context-menu targeting is not claimed.

Substack newsletter articles use the page-clip entry point. Recognize Substack subdomains and custom domains carrying Substack stylesheet markers. Keep the article title, subtitle, body, sections, images and captions; remove subscription widgets, share buttons and heading-link controls. Selection takes precedence. Only current-page content is read; paid articles and special media embeds remain unverified.

2026-10-11: Tested the user-provided Ted Gioia Note `c-357811021`, whose signed-out page exposes five complete paragraphs and one attachment; source publication time comes from its JSON-LD. Live extraction excludes replies and sidebars. Also tested the public One Useful Thing article `the-dot-and-the-swarm` on its custom domain, retaining opening/final paragraphs, three sections and three images. Both sanitized structural samples pass targeted Chromium E2E through the real extension, local API, all image uploads and reopened editor images after source blocking. An additional Note audit downloads its actual Substack CDN image independently (65,583 bytes), verifies identical SHA-256 after archiving, and displays it after reopening with sources blocked. Article attachment testing uses a controlled download source. Test notes and tokens were cleaned up. The full platform E2E suite was not rerun; this does not establish acceptance of every Substack page or all browser runtimes.

## Medium rendered articles

Medium continues to use the generic page-clip entry point, with added story-block extraction. Retain the displayed title, subtitle, body, sections, images and captions; exclude member notices, reaction counts, highlighting controls and image-viewer prompts. Recognize Medium hosts and custom domains with Medium site metadata. Do not fetch hidden paid content. Selection still takes precedence.

2026-10-11: Tested the user-provided story `a2ce2e6de88e`; its Medium URL redirects to `scottbatson.dev`. The current browser can read the full body. Live extraction retains its opening and final paragraphs, Slow work/Writing sections, two images and captions. This article and the Threads sample above pass a targeted Chromium E2E through the actual extension and local API, including all image uploads and reopening notes with source hosts blocked. Image sources use a controlled local server, so this does not establish live CDN transfer or acceptance of every Medium story. The test uses the same workerd internal address to bypass intermittent development proxy 503s. Test notes and tokens were cleaned up. The full E2E suite was not rerun in this change.

## Earlier detail-page adapters

## Usage

Configure the extension's EdgeEver instance and API token, open a detail page, and save from the toolbar or its platform command in the page-background context menu.

| Platform | Detail page | Saved content |
| --- | --- | --- |
| Hacker News | Main posts at `https://news.ycombinator.com/item?id=…` | Title, available author and publication time, points at capture, body and original external link. Link-only posts are valid; linked articles are not fetched. |
| V2EX | `https://www.v2ex.com/t/…` or `https://v2ex.com/t/…` | Body, available author and publication time, every supplement with its number and available timestamp, excluding replies. |
| Xiaoyuzhou | `https://www.xiaoyuzhoufm.com/episode/…` | Episode title, podcast name, publication time, complete Show Notes, their timeline and explicitly named hosts, cover and body images. Timestamps without working links remain text. |

A text selection takes priority in the toolbar. Existing selection and image commands remain; the new commands use only the page context. Home pages, feeds, podcast pages, profiles and HN comment pages are outside these dedicated adapters; open a detail page first.

Platform notes receive `web-clip` and `hacker-news`, `v2ex` or `xiaoyuzhou` tags. Source URLs omit tracking parameters, reply pagination and anchors. Publication and capture times are separate. Date-only and relative times keep their precision; missing fields are omitted.

Capture, publication and supplement times use the browser system timezone at capture, formatted as `yyyy-MM-dd HH:mm:ss` without timezone labels or fractional seconds. In an Asia/Shanghai system environment, V2EX’s `2023-12-13T13:25:31+08:00` becomes `2023-12-13 13:25:31`. Known instants are converted to the system timezone; unknown zones retain their source wall clock, and date-only or relative values keep their original information. HN timestamps without a zone have been checked against Unix timestamps from its official API, so the HN reader appends `Z`. These times are saved as body text and do not change with later device timezone changes. Existing video notes record only the local capture date. V2EX supplements use their number as a heading and put the timestamp in a separate plain paragraph. Formatting changes apply to new clips; existing notes remain unchanged.

An unreadable recognized detail page is not saved as a generic whole page. Follow the error to sign in, wait for loading, expand the text, or reopen the intended page before retrying. Xiaoyuzhou metadata is saved with “This episode has no Show Notes” only when confirmed empty; a read failure does not mean empty content. Audio is not downloaded or transcribed, and no summary is generated.

## Images and feedback

The body is saved first, followed by the existing image-copy workflow: up to 30 images, 20 MiB per image, 60 MiB combined, and a 45-second overall budget.

- Notes without images or with every image copied report success. Images are described as archived only after every image is copied.
- Download, upload, rewrite or budget failures preserve the note and report “Text saved. Some images still use external links.” Images beyond the 30-image limit count as uncopied.
- If the user edits the note during copying, their version is retained. The clip does not overwrite it or create another note.

Image archival means that EdgeEver instance resources can serve the images, not a new promise of complete offline client access.

## Verification record

The PR code baseline is upstream `96626ef2`; the development extension version is `0.1.17`, without a store version bump. Earlier verification records below describe the previous local batch.

Earlier detail-page checks passed:

```sh
bun run test:extension
bun run typecheck
bun run typecheck:mobile
bun run build:web
bun run build:extension
bun run build:extension:firefox
bun run lint:extension:firefox
bunx playwright test tests/e2e/web-clipper-html-safety.spec.ts tests/e2e/web-clipper-platforms.spec.ts tests/e2e/web-clipper-page-images.spec.ts --reporter=line
```

**136 extension tests** and **3 Chromium E2E tests pass**, along with root/mobile typechecking, the Web build and Chromium/Firefox extension builds. Firefox lint reports **0 errors, 0 notices and 2 warnings**. Lint and Chromium results do not establish Firefox runtime acceptance.

2026-10-09 follow-up: HN commit `16e11216` saved publication times without a timezone. The sample's `1715879518` from the [official API](https://hacker-news.firebaseio.com/v0/item/40380738.json) corresponds to `2024-05-16T17:11:58Z`. The HN reader now retains that UTC marker, with explicit zones, date-only values and relative times verified unchanged. Three `cross-world extension resource mismatch` warnings reproduced in the installed Ego Chromium extension's settings page were eliminated by scoping `modulePreload: false` to the extension build. Settings and popup pages load normally, and Test connection successfully returns notebooks.

The Xiaoyuzhou `UNSAFE_VAR_ASSIGNMENT` warning is fixed by reusing the existing Domino dependency to parse completeness data in a JavaScript-only DOM. It still saves only content from the page DOM. The injected script grows by about 236 KB, without new dependencies or permissions.

2026-10-10: the Readability patch added solely to remove third-party warnings, its registrations and dedicated tests were removed. The locked, unmodified `@mozilla/readability@0.6.0` dependency was reinstalled. Its two static warnings for article retries and `<noscript>` image parsing remain visible; no lint rules are suppressed. The caller only passes a detached document copy with scripts, embeds and `<noscript>` already removed. [Readability does not sanitize untrusted HTML](https://github.com/mozilla/readability#security), and its output must not be inserted directly into a page as safe HTML.

After removing the patch, 135 extension tests and 3 Chromium E2E tests passed again. The Show Notes test disallows browser HTML assignment and parsing, then verifies that script, event, image, iframe, audio and video probes cause no code execution or resource requests. A control image in the live page successfully triggers a request and event. The other two E2E tests cover generic page-image saving and persistence of platform notes and archived images. This runtime evidence covers Chromium.

- DOM fixtures retain relevant structures from the public pages below, removing unrelated content and sensitive parameters. Sources and expectations are recorded in `apps/extension/fixtures/platforms/sources.json`. Derived boundary variants are synthetic tests, not live samples.
- Coverage includes metadata, supplements, code/images, unsafe HTML, time precision, empty content, expansion timeouts, selection priority, message correlation, permissions, navigation, partial images, limits and edit conflicts.
- Playwright 1.62.1 loads the real extension in Chromium / Chrome for Testing **151.0.7922.34**, saves all three samples through the local API, verifies success and unreadable failure paths, and reopens notes in the Web editor. After closing the source page and blocking external sources, the Xiaoyuzhou cover still renders from the instance attachment. Only the temporary test extension receives fixed test-host permissions; the shipping manifest adds none. Test notes and tokens were cleaned up.
- The existing generic page-image E2E passes. Extension tests also cover selection, image, X, Reddit, Xiaohongshu, Zhihu, GitHub, YouTube and Bilibili code; their live sites were not individually replayed.
- Independent correctness, simplification and design reviews have no unresolved substantive findings. Fixes cover cleaned-empty selections falling through to whole articles, title-whitespace false mismatches, and stale data after Xiaoyuzhou client navigation.

Live sampling used a signed-out Ego Chromium browser reporting Chrome/152.0.0.0 in its UA. These steps run the built extraction script; persistence is verified separately by the local-instance E2E above.

| Sample | Expected and observed |
| --- | --- |
| [HN post 40380738](https://news.ycombinator.com/item?id=40380738) | Successfully retains `jnnnthnn`, the original time, the full main post through its final paragraph and the external link, excluding comments. |
| [HN comment 40384810](https://news.ycombinator.com/item?id=40384810) | Correctly reports unreadable and refuses it as a main post. |
| [V2EX 1000000](https://www.v2ex.com/t/1000000) | Direct HTTP sampling and fixture tests retain the body and two ordered, dated supplements, excluding replies. Live browser navigation timed out; saving on this live site remains unverified. |
| [Xiaoyuzhou episode 25](https://www.xiaoyuzhoufm.com/episode/62ad4ae5f9b62781ea058a02) | Preserves timestamps and the final music credit. Full notes are already loaded before expansion, so no extra click is needed. |
| [Xiaoyuzhou episode 161](https://www.xiaoyuzhoufm.com/episode/6a8ef24e1352af56ff3c83f3) | After navigating from episode 25 via its podcast page, bootstrap `__NEXT_DATA__` still has the old ID. Validating the DOM against the current route's loaded episode data yields the new ID, title and body without old content. |

The complete live-site save workflow with the extension loaded in each of Chrome, Edge and Firefox is **still pending**. Firefox Android is also unverified, so this batch must not be marked fully accepted yet. A 2026-10-09 check confirmed that the initial HN implementation was merged through [PR #505](https://github.com/tianma-if/edgeever/pull/505). This PR includes the HN time fix, preload fix and V2EX/Xiaoyuzhou implementations.


## Local review on 2026-10-11

The review corrected a truncated Instagram parent caption by saving the complete loaded per-slide captions, retaining independent parent text. It also bound Meta readability and context-menu targeting to the same post card, excluded hidden Facebook/Bluesky/LinkedIn bodies, removed an unsupported Bluesky image-count guess based on ordinary fractions, and stopped recognized unreadable Medium/Substack articles from falling back to whole-page extraction. Article identity and Markdown conversion now reuse shared helpers. The previous Instagram checks did not assert the final slide text; the new regression and Chromium editor check do.

The end-to-end fixture suite covers all 15 samples through the real extension, local API, image archiving and reopening with source hosts blocked, plus unreadable/hidden refusal and cleanup. It uses the same workerd directly for extension, API assertions and editor API requests because the local development proxy intermittently times out. This verifies the local business flow, not the proxy or live CDN behavior across every site/browser. The HTML safety browser check also passes. Firefox is build/lint checked only; there is no new Firefox runtime acceptance in this review.
