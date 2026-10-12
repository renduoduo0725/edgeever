import { clipDateTimeText } from "./src/clip-time.ts";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { bundleTestScripts } from "./bundle-test-scripts.mjs";
import { createWindow } from "@mixmark-io/domino";

const [background, captureScript, pageCaptureScript] = bundleTestScripts(["background", "capture-platform", "capture"]);
const urls = {
  "substack-note": "https://substack.com/@tedgioia/note/c-357811021",
  "hacker-news": "https://news.ycombinator.com/item?id=40380738",
  v2ex: "https://www.v2ex.com/t/1000000",
  xiaoyuzhou: "https://www.xiaoyuzhoufm.com/episode/62ad4ae5f9b62781ea058a02",
  facebook: "https://www.facebook.com/NASA/posts/pfbid0dPToN66CzcAHGMoaNe3jszH4FfBKvqkE5gogCNJkTxXDPsSGYrGvcVwsLgByyMQQl",
  instagram: "https://www.instagram.com/p/DeAYvsnn4la/",
  threads: "https://www.threads.com/@nasa/post/DZceA72Drjf",
  bluesky: "https://bsky.app/profile/bsky.app/post/3mhgg5ja5gc2w",
  linkedin: "https://www.linkedin.com/posts/friends-of-nasa_nasa-space-astronomy-activity-7497764718095323136-NRvr",

};
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

// Execute the actual bundled background and injected script. Only browser APIs
// and the instance's HTTP boundary are mocked; extraction and saving are real.
const harness = (options = {}) => {
  const platform = options.platform || "hacker-news";
  const pageUrl = options.pageUrl || urls[platform];
  let currentUrl = pageUrl;
  const window = createWindow(readFileSync(new URL(`./fixtures/platforms/${platform}.html`, import.meta.url), "utf8"), pageUrl);
  window.getSelection = () => null;
  options.prepare?.(window.document, window);
  const calls = { creates: [], uploads: [], saves: [], injections: [], feedback: [], requests: [], rejectedMessages: [] };
  let onMessage, onClick, menuDone;
  const json = (value, status = 200) => Response.json(value, { status });
  const fetchMock = async (url, init) => {
    calls.requests.push(String(url));
    const path = new URL(url).pathname;
    if (String(url).startsWith("https://edgeever.test")) {
      if (path === "/api/v1/notebooks") {
        options.notebookRequested?.();
        if (options.notebookGate) await options.notebookGate;
        if (options.navigateDuringNotebookLookup) currentUrl = "https://www.v2ex.com/t/1000001";
        return json({ notebooks: [{ id: "nb_inbox", slug: "inbox" }] });
      }
      if (path === "/api/v1/memos") {
        calls.creates.push(JSON.parse(init.body));
        return json({ memo: { id: "memo_1", revision: 1, contentHash: "original" } }, 201);
      }
      if (path.endsWith("/resources")) {
        calls.uploads.push(init.body);
        return options.failUpload ? json({ error: { message: "upload failed" } }, 500) : json({ resource: { id: `res_${calls.uploads.length}` } });
      }
      if (path.endsWith("/edit-sessions")) return json({ editSession: { id: "session", baseRevision: options.editConflict ? 2 : 1, baseContentHash: options.editConflict ? "user-edited" : "original" } });
      if (path.endsWith("/save")) {
        if (options.failRewrite) return json({ error: { message: "conflict" } }, 409);
        calls.saves.push(JSON.parse(init.body)); return json({});
      }
      throw new Error(`Unexpected instance request: ${path}`);
    }
    return options.failDownload ? new Response("Forbidden", { status: 403 }) : new Response(png, { headers: { "content-type": "image/png" } });
  };
  let pageContext;
  const chrome = {
    i18n: { getMessage: (key, substitution) => key === "saveFailedWithReason" ? `${key}: ${substitution}` : key },
    runtime: {
      id: "extension-under-test",
      onInstalled: { addListener() {} }, onMessage: { addListener(listener) { onMessage = listener; } },
      openOptionsPage: async () => {},
      sendMessage: async (message) => {
        if (options.spoofMessages && message.type === "pagePlatformRead") {
          for (const overrides of [{ tab: { id: 999 } }, { frameId: 3 }, { id: "other-extension" }]) {
            const fake = { ...message, result: { ok: true, clip: { ...message.result.clip, title: "Wrong sender" } } };
            onMessage(fake, { id: chrome.runtime.id, tab: { id: 7 }, frameId: 0, url: currentUrl, ...overrides }, () => {});
            calls.rejectedMessages.push(overrides);
          }
          onMessage({ ...message, requestId: "unrelated", result: { ok: false } }, { id: chrome.runtime.id, tab: { id: 7 }, frameId: 0, url: currentUrl }, () => {});
        }
        onMessage(message, { id: chrome.runtime.id, tab: { id: 7 }, frameId: 0, url: currentUrl }, () => {});
      },
    },
    storage: { local: { get: async () => ({ instanceUrl: "https://edgeever.test", token: "test-token", notebookId: "" }) } },
    permissions: { contains: async () => !options.denyInstance },
    tabs: { query: async () => [{ id: 7, url: currentUrl }], get: async () => ({ id: 7, url: currentUrl }) },
    windows: { onRemoved: { addListener() {} } },
    contextMenus: { onClicked: { addListener(listener) { onClick = listener; } } },
    scripting: { executeScript: async ({ func, args = [], files, target }) => {
      calls.injections.push({ files, target });
      if (options.denyScripting) throw new Error("Cannot access contents of the page. Missing host permission.");
      if (func) {
        if (args[0]?.action === "toast") { calls.feedback.push(args[0]); if (calls.feedback.length > 1) menuDone?.(args[0]); return []; }
        pageContext.__args = args;
        return [{ result: await runInContext(`(${func.toString()})(...__args)`, pageContext) }];
      }
      if (files?.[0] === "assets/capture-platform.js") runInContext(captureScript, pageContext);
      else if (files?.[0] === "assets/capture.js") runInContext(pageCaptureScript, pageContext);
      else if (files?.[0] !== "assets/capture-image.js") throw new Error(`Unexpected generic fallback: ${files}`);
      return [];
    } },
    action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async () => {} },
  };
  pageContext = createContext({ window, document: window.document, location: { get href() { return currentUrl; } }, URL, chrome, setTimeout, clearTimeout, setInterval, clearInterval, fetch: fetchMock, AbortSignal, Blob, Uint8Array });
  runInContext(background, createContext({ chrome, fetch: fetchMock, URL, crypto, setTimeout, clearTimeout, setInterval, clearInterval, AbortSignal, AbortController, Blob, File, FormData, Uint8Array, ArrayBuffer, Response }));
  return {
    document: window.document,
    calls,
    toolbar: () => new Promise((resolve) => onMessage({ type: "captureCurrentPage" }, { id: chrome.runtime.id }, resolve)),
    menu: () => new Promise((resolve) => { menuDone = resolve; onClick({ menuItemId: `save-${platform}`, pageUrl, frameId: 0 }, { id: 7, url: pageUrl }); }),
  };
};

for (const platform of Object.keys(urls)) {
  test(`${platform}: toolbar and dedicated menu save the same note through the real parser`, async () => {
    const toolbar = harness({ platform }); const menu = harness({ platform });
    expect((await toolbar.toolbar()).ok).toBe(true);
    await menu.menu();
    expect(toolbar.calls.creates).toHaveLength(1);
    expect(menu.calls.creates).toHaveLength(1);
    const normalize = (note) => ({ ...note, contentMarkdown: note.contentMarkdown.replace(/capturedAtLabel: [^\n]+/, "capturedAtLabel: <capture time>") });
    expect(normalize(menu.calls.creates[0])).toEqual(normalize(toolbar.calls.creates[0]));
    expect(toolbar.calls.creates[0].tags).toEqual(["web-clip", platform]);
    expect(toolbar.calls.creates[0].notebookId).toBe("nb_inbox");
    expect(toolbar.calls.creates[0].contentMarkdown).toMatch(/capturedAtLabel: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\b/);
    if (platform === "v2ex") {
      expect(toolbar.calls.creates[0].contentMarkdown).toContain("platformPublishedAtLabel: " + clipDateTimeText("2023-12-13T13:25:31+08:00"));
      expect(toolbar.calls.creates[0].contentMarkdown).toContain(clipDateTimeText("2023-12-13T14:47:02+08:00"));
      expect(toolbar.calls.creates[0].contentMarkdown).toContain(clipDateTimeText("2023-12-14T15:00:40+08:00"));
    }
    expect(toolbar.calls.requests.some((url) => /\.(mp3|m4a|mp4)(\?|$)/.test(url))).toBe(false);
  });
}

test("a new platform toolbar still saves a valid selection instead of its full article", async () => {
  const h = harness({ platform: "v2ex", prepare: (doc, window) => {
    window.getSelection = () => ({ rangeCount: 1, toString: () => "Only this passage", getRangeAt: () => ({ cloneContents: () => {
      const fragment = doc.createDocumentFragment(); const p = doc.createElement("p"); p.textContent = "Only this passage"; fragment.appendChild(p); return fragment;
    } }) });
  } });
  expect((await h.toolbar()).ok).toBe(true);
  expect(h.calls.creates[0].tags).toEqual(["web-clip"]);
  expect(h.calls.creates[0].contentMarkdown).toContain("Only this passage");
  expect(h.calls.creates[0].contentMarkdown).not.toContain("环境不好");
});

test("Xiaoyuzhou saves the current client route using MAIN-world props while bootstrap JSON stays old", async () => {
  const id = "6a8ef24e1352af56ff3c83f3";
  const pageUrl = `https://www.xiaoyuzhoufm.com/episode/${id}`;
  const h = harness({ platform: "xiaoyuzhou", pageUrl, prepare: (doc, window) => {
    const episode = { eid: id, title: "Current route episode", shownotes: "<p>New route's complete notes</p>" };
    doc.querySelector("h1").textContent = episode.title;
    doc.querySelector(".sn-content article").innerHTML = episode.shownotes;
    doc.querySelector('link[rel="canonical"]').setAttribute("href", pageUrl);
    window.next = { router: { pathname: "/episode/[id]", query: { id }, components: { "/episode/[id]": { props: { pageProps: { episode } } } } } };
  } });
  expect((await h.toolbar()).ok).toBe(true);
  expect(h.calls.creates[0].title).toBe("Current route episode");
  expect(h.calls.creates[0].contentMarkdown).toContain("New route's complete notes");
  expect(h.calls.creates[0].contentMarkdown).not.toContain("韦礼安");
});

test("request, extension, tab and frame correlation reject unrelated responses", async () => {
  const h = harness({ spoofMessages: true });
  expect((await h.toolbar()).ok).toBe(true);
  expect(h.calls.rejectedMessages).toHaveLength(3);
  expect(h.calls.creates).toHaveLength(1);
  expect(h.calls.creates[0].title).toStartWith("Show HN");
});

for (const failure of ["failDownload", "failUpload", "failRewrite", "editConflict"]) {
  test(`${failure}: keeps the saved body, reports external images, and never creates twice`, async () => {
    const h = harness({ platform: "xiaoyuzhou", [failure]: true });
    expect(await h.toolbar()).toEqual({ ok: true, message: "platformImagesPartial" });
    expect(h.calls.creates).toHaveLength(1);
    expect(h.calls.saves).toHaveLength(0);
    expect(h.calls.creates[0].contentMarkdown).toContain("xyzcdn.net");
  });
}

test("images beyond the limit count towards partial status after 30 successful uploads", async () => {
  const h = harness({ platform: "v2ex", prepare: (doc) => {
    const body = doc.querySelector(".topic_content");
    body.innerHTML += Array.from({ length: 32 }, (_, i) => `<img src="https://images.test/${i}.png">`).join("");
  } });
  expect(await h.toolbar()).toEqual({ ok: true, message: "platformImagesPartial" });
  expect(h.calls.uploads).toHaveLength(30);
  expect(h.calls.creates).toHaveLength(1);
  expect(h.calls.saves[0].contentMarkdown).toContain("/api/v1/resources/res_1/blob");
  expect(h.calls.saves[0].contentMarkdown).toContain("https://images.test/31.png");
});

test("no Show Notes is a successful, explicitly qualified note", async () => {
  const h = harness({ platform: "xiaoyuzhou", prepare: (doc) => {
    doc.querySelector(".sn-content article").innerHTML = "";
    const state = doc.querySelector("#__NEXT_DATA__"); const data = JSON.parse(state.textContent);
    data.props.pageProps.episode.shownotes = ""; state.textContent = JSON.stringify(data);
  } });
  expect(await h.toolbar()).toEqual({ ok: true, message: "platformSavedWithImages platformNoShowNotes" });
  expect(h.calls.creates[0].contentMarkdown).toContain("platformNoShowNotes");
});

for (const platform of Object.keys(urls)) {
  test(`${platform}: unreadable content never falls back to a whole-page note`, async () => {
    const h = harness({ platform, prepare: (doc) => { doc.body.innerHTML = "<h1>Sign in</h1><p>Comments and recommendations</p>"; } });
    expect(await h.toolbar()).toEqual({ ok: false, message: "platformUnreadable" });
    expect(h.calls.creates).toHaveLength(0);
  });
}

test("navigation while resolving the notebook cancels the old content before creation", async () => {
  const h = harness({ platform: "v2ex", navigateDuringNotebookLookup: true });
  expect(await h.toolbar()).toEqual({ ok: false, message: "platformPageChanged" });
  expect(h.calls.creates).toHaveLength(0);
});

for (const [option, message] of [["denyInstance", "instancePermissionRequired"], ["denyScripting", "pageAccessDenied"]]) {
  test(`${option}: gives an actionable permission error without creating a note`, async () => {
    const h = harness({ [option]: true });
    expect(await h.toolbar()).toEqual({ ok: false, message });
    expect(h.calls.creates).toHaveLength(0);
  });
}


test("queued social menu clips freeze each clicked post before a later right-click", async()=>{
 let release,started;const notebookGate=new Promise(r=>release=r),notebookStarted=new Promise(r=>started=r);
 const h=harness({platform:"bluesky",pageUrl:"https://bsky.app/profile/bsky.app",notebookGate,notebookRequested:started,prepare:doc=>{doc.body.replaceWith(createWindow(readFileSync(new URL('./fixtures/platforms/bluesky-feed.html',import.meta.url),'utf8')).document.body);}});
 const cards=Array.from(h.document.querySelectorAll('[data-testid^="feedItem-by-"]'));
 const urls=cards.slice(0,3).map(card=>Array.from(card.querySelectorAll('a[href]')).map(a=>a.getAttribute('href')).find(href=>/^\/profile\/[^/]+\/post\/[^/]+$/.test(href))).map(path=>'https://bsky.app'+path);
 expect(urls).toHaveLength(3);
 cards[0].setAttribute('data-edgeever-social-target',urls[0]);const first=h.menu();await notebookStarted;
 cards[0].removeAttribute('data-edgeever-social-target');cards[1].setAttribute('data-edgeever-social-target',urls[1]);const second=h.menu();
 await new Promise(r=>setTimeout(r,0));cards[1].removeAttribute('data-edgeever-social-target');cards[2].setAttribute('data-edgeever-social-target',urls[2]);release();
 for(let n=0;n<200 && h.calls.creates.length<2;n++) await new Promise(r=>setTimeout(r,5));
 expect(h.calls.creates).toHaveLength(2);expect(h.calls.creates[0].contentMarkdown).toContain(urls[0]);expect(h.calls.creates[1].contentMarkdown).toContain(urls[1]);
 await Promise.race([Promise.all([first,second]),new Promise(r=>setTimeout(r,50))]);
});

for(const action of ['toolbar','menu']) test(`Bluesky ${action} saves rendered link destinations without hidden text`,async()=>{
 const h=harness({platform:'bluesky',prepare:doc=>{
  doc.querySelector('[data-word-wrap="1"]').innerHTML='<span hidden>HIDDEN TITLE SECRET</span>Read <a href="https://example.test/complete-article?id=123">example.test/complete...</a><span aria-hidden="true">HIDDEN BODY SECRET</span>';
 }});
 const response=await h[action]();if(action==='toolbar')expect(response.ok).toBe(true);
 expect(h.calls.creates).toHaveLength(1);
 const memo=h.calls.creates[0];
 expect(memo.title).toBe('Read example.test/complete...');
 expect(memo.contentMarkdown).toContain('[example.test/complete...](https://example.test/complete-article?id=123)');
 expect(memo.contentMarkdown).not.toContain('SECRET');
});


for(const [platform,pageUrl,selector] of [
 ['medium-article','https://scottbatson.dev/example','article'],
 ['substack-article','https://www.oneusefulthing.org/p/the-dot-and-the-swarm','.body.markup'],
]) test(`${platform}: unreadable rendered article returns an error without creating a fallback note`,async()=>{
 const h=harness({platform,pageUrl,prepare:doc=>doc.querySelector(selector).setAttribute('hidden','')});
 const response=await h.toolbar();expect(response.ok).toBe(false);expect(response.message).toContain('platformUnreadable');expect(h.calls.creates).toHaveLength(0);expect(h.calls.uploads).toHaveLength(0);
});
