import { E2E_STORAGE_STATE_PATH } from "./global-setup";
import { chromium, expect, request as playwrightRequest, test, type BrowserContext, type Worker } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

declare const chrome: any;
const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const platforms = [
  { name: "hacker-news", url: "https://news.ycombinator.com/item?id=40380738", title: "Show HN: I built a LLM-powered Ask HN: like Perplexity, but for HN comments", text: "Ollama on your machine!", excluded: "Matching the HN style", imageCount: 0 },
  { name: "v2ex", url: "https://www.v2ex.com/t/1000000", title: "程序员如何从公司上班转型", text: "看看大家多久后能来还愿", excluded: "抱歉跑个题", imageCount: 0 },
  { name: "xiaoyuzhou", url: "https://www.xiaoyuzhoufm.com/episode/62ad4ae5f9b62781ea058a02", title: "025. 快！抓紧时间拖延！", text: "韦礼安", excluded: "宝子姐生日快乐", imageCount: 1 },
  { name: "facebook", url: "https://www.facebook.com/NASA/posts/pfbid0dPToN66CzcAHGMoaNe3jszH4FfBKvqkE5gogCNJkTxXDPsSGYrGvcVwsLgByyMQQl", title: "Brewing up baby stars NASA's James Webb Space Telescope's unique view reveals many previously hidden", text: "in the red cloud", excluded: "That eight-pronged diffraction pattern", imageCount: 1 },
  { name: "instagram", url: "https://www.instagram.com/p/DeAYvsnn4la/", title: "Swipe for countless stars", text: "Sagittarius B2", excluded: "smallsciencesociety", imageCount: 3 },
  { name: "instagram-slide-captions", url: "https://www.instagram.com/p/DeKe6teEpya/", title: "Warning: These slides may cause existential wonder ✨To celebrate World Space Week, today’s #GoogleDoodle spotlights a never-before-seen photo".slice(0,120), text: "how do astronomers turn raw space data into breathtaking images", excluded: "My first love", imageCount: 20 },
  { name: "threads", url: "https://www.threads.com/@nasa/post/DZceA72Drjf", title: "This is the second week of Moon Joy June, and the prompt is “Moon.” If you’re looking for some inspiration, we have a treat for you: four new and previously unseen images from our Artemis II mission!".slice(0,120), text: "Artemis Art Show topic!", excluded: "chronicxdecay", imageCount: 4 },
  { name: "threads-short-link", url: "https://www.threads.com/@nasa/post/DeMqtuYgkaL", title: "A LOT of Artemis II data just dropped! 🌖", text: "814GB", excluded: "热门", imageCount: 1 },
  { name: "substack-note", url: "https://substack.com/@tedgioia/note/c-357811021", title: "Ted Gioia · Substack Note", text: "experienced on a large screen", excluded: "The Honest Broker", imageCount: 1 },
  { name: "substack-article", url: "https://www.oneusefulthing.org/p/the-dot-and-the-swarm", title: "The Dot and the Swarm", text: "very cool pre-order bonus", excluded: "Subscribe", imageCount: 3 },
  { name: "medium-article", url: "https://scottbatson.dev/what-should-programmers-do-while-the-ai-writes-code-a2ce2e6de88e", title: "What Should Programmers Do While the AI Writes Code?", text: "10 times as meaningful", excluded: "Top highlight", imageCount: 2 },
  { name: "bluesky", url: "https://bsky.app/profile/bsky.app/post/3mhgg5ja5gc2w", title: "v1.119 is live!", text: "Bot labels are here", excluded: "Could you make it", imageCount: 1 },
  { name: "linkedin", url: "https://www.linkedin.com/posts/friends-of-nasa_nasa-space-astronomy-activity-7497764718095323136-NRvr", title: "Nancy Grace Roman Space Telescope: Launch Preparations | NASA Kennedy", text: "144.47 MB", excluded: "donRolando.com", imageCount: 8 },
  { name: "linkedin-ugc", url: "https://www.linkedin.com/posts/nasa-space-astronomy-ugcPost-7497764716677758977-qmKO/", title: "Nancy Grace Roman Space Telescope: Launch Preparations | NASA Kennedy", text: "144.47 MB", excluded: "private-tracking", imageCount: 8 },
  { name: "linkedin-ugc-guest", url: "https://www.linkedin.com/posts/nasa-space-astronomy-ugcPost-7497764716677758977-qmKO/", title: "Nancy Grace Roman Space Telescope: Launch Preparations | NASA Kennedy", text: "144.47 MB", excluded: "donRolando.com", imageCount: 8 },
];

test("platform clips persist through the extension and local API; archived images survive source blocking", async ({ baseURL }) => {
  test.setTimeout(180_000);
  execFileSync("bun", ["run", "build:extension"], { cwd: repositoryRoot, stdio: "pipe" });
  const directory = mkdtempSync(join(tmpdir(), "edgeever-platform-extension-"));
  const profile = mkdtempSync(join(tmpdir(), "edgeever-platform-browser-"));
  cpSync(join(repositoryRoot, "apps/extension/dist"), directory, { recursive: true });
  const manifestPath = join(directory, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  // The test cannot grant activeTab by clicking browser chrome. Give only this
  // temporary build the sampled hosts, image host and local instance access.
  manifest.host_permissions = ["http://127.0.0.1/*", ...platforms.map((entry)=>`${new URL(entry.url).origin}/*`)];
  writeFileSync(manifestPath, JSON.stringify(manifest));

  let sourceBlocked = false;
  const imageServer = createServer((_req,res) => { res.writeHead(sourceBlocked ? 503 : 200, { "Content-Type": "image/png", "Access-Control-Allow-Origin": "*" }); res.end(sourceBlocked ? "blocked" : png); });
  await new Promise<void>((done)=>imageServer.listen(0,"127.0.0.1",done));
  const imageOrigin=`http://127.0.0.1:${(imageServer.address() as AddressInfo).port}`;
  const request = await playwrightRequest.newContext({baseURL:process.env.EDGE_EVER_CLIPPER_TEST_INSTANCE_URL || baseURL,storageState:E2E_STORAGE_STATE_PATH,timeout:15_000});
  let context: BrowserContext | undefined;
  let tokenId = "";
  const memoIds: string[] = [];
  try {
    const tokenResponse = await request.post("/api/v1/api-tokens", { data: {
      name: "web-clipper-platform-e2e", scopes: ["read:memos", "write:memos", "read:resources", "write:resources", "read:notebooks"],
    } });
    expect(tokenResponse.status()).toBe(201);
    const { token, apiToken } = await tokenResponse.json(); tokenId = apiToken.id;
    context = await chromium.launchPersistentContext(profile, {
      channel: "chromium", locale: "zh-CN", timezoneId: "Asia/Shanghai", args: [`--disable-extensions-except=${directory}`, `--load-extension=${directory}`],
    });
    context.setDefaultTimeout(15_000);
    context.setDefaultNavigationTimeout(15_000);
    await context.addCookies(JSON.parse(readFileSync(E2E_STORAGE_STATE_PATH,"utf8")).cookies);
    if (process.env.EDGE_EVER_CLIPPER_TEST_INSTANCE_URL) {
      await context.route(`${new URL(baseURL!).origin}/api/**`,async(route)=> {
        const url=new URL(route.request().url());
        const direct=new URL(url.pathname+url.search,process.env.EDGE_EVER_CLIPPER_TEST_INSTANCE_URL);
        await route.fulfill({response:await route.fetch({url:direct.href,timeout:15_000})});
      });
    }
    const worker: Worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    await worker.evaluate((settings) => chrome.storage.local.set(settings), { instanceUrl: process.env.EDGE_EVER_CLIPPER_TEST_INSTANCE_URL || baseURL!, token, notebookId: "" });
    const article = context.pages()[0] ?? await context.newPage();
    let failure = false;
    let currentPlatform: typeof platforms[number] | undefined;
    const sourceRequests: string[] = [];
    const imageUrls = new Map<string,number>();
    await context.route(/^https:\/\//, async (route) => {
      const url = route.request().url(); sourceRequests.push(url);
      if (sourceBlocked) { await route.abort(); return; }
      const platform = currentPlatform?.url === url ? currentPlatform : undefined;
      if (!platform) { await route.abort(); return; }
      const articlePlatform = platform.name === "medium-article" || platform.name === "substack-article";
      const html = failure ? articlePlatform
        ? readFileSync(join(repositoryRoot, `apps/extension/fixtures/platforms/${platform.name}.html`), "utf8").replace("<article", "<article hidden")
        : "<html><body><h1>Sign in</h1><p>Unrelated comments</p></body></html>"
        : readFileSync(join(repositoryRoot, `apps/extension/fixtures/platforms/${platform.name}.html`), "utf8")
           .replace(/https:\/\/(?:bts-image\.xyzcdn\.net|cdn\.bsky\.app|[^/]+\.fbcdn\.net|[^/]+\.cdninstagram\.com|media\.licdn\.com|miro\.medium\.com|substackcdn\.com(?=\/image\/))\/[^"\s<]+/g, (original) => `${imageOrigin}/${new URL(original).hostname}${new URL(original).pathname}?image=${imageUrls.get(original) || (()=>{const id=imageUrls.size+1;imageUrls.set(original,id);return id;})()}`);
      await route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    });
    const senderPromise = context.waitForEvent("page");
    await worker.evaluate(() => chrome.windows.create({ url: chrome.runtime.getURL("options.html"), focused: false }));
    const sender = await senderPromise; await sender.waitForLoadState();
    const save = async (url: string) => {
      await worker.evaluate(async (targetUrl) => {
        const [tab] = await chrome.tabs.query({ url: targetUrl });
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
      }, url);
      return sender.evaluate(() => chrome.runtime.sendMessage({ type: "captureCurrentPage" }));
    };
    for (const platform of platforms) {
      currentPlatform = platform;
      console.log("Verifying",platform.name);
      const before = (await (await request.get("/api/v1/memos?limit=100")).json()).memos as Array<{ id: string }>;
      const oldIds = new Set(before.map((memo) => memo.id));
      await article.goto(platform.url);
      const saved = await save(platform.url);
      console.log("Saved",platform.name,saved);
      expect(saved.ok).toBe(true);
      const after = (await (await request.get("/api/v1/memos?limit=100")).json()).memos as Array<{ id: string; title: string }>;
      const note = after.find((memo) => !oldIds.has(memo.id) && memo.title === platform.title);
      memoIds.push(...after.filter((memo) => !oldIds.has(memo.id)).map((memo) => memo.id));
      expect(note, platform.name).toBeTruthy();
      const detail = await request.get(`/api/v1/memos/${note!.id}`);
      expect(detail.ok()).toBe(true);
      const { memo } = await detail.json();
      expect(memo.contentMarkdown).toContain(platform.text);
      expect(memo.contentMarkdown).not.toContain(platform.excluded);
      expect(memo.contentMarkdown).toContain(platform.name === "linkedin" ? "https://www.linkedin.com/feed/update/urn:li:activity:7497764718095323136/"
        : platform.name.startsWith("linkedin-ugc") ? "https://www.linkedin.com/feed/update/urn:li:ugcPost:7497764716677758977/" : platform.url);
      expect(memo.contentMarkdown).toMatch(/抓取时间: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\b/);
      if (platform.name === "v2ex") {
        expect(memo.contentMarkdown).toContain("2023-12-13 13:25:31");
        expect(memo.contentMarkdown).toContain("2023-12-13 14:47:02");
        expect(memo.contentMarkdown).toContain("2023-12-14 15:00:40");
      }
      if (platform.imageCount) {
        const resources = [...memo.contentMarkdown.matchAll(/!\[[^\]]*\]\(\/api\/v1\/resources\/([^/)]+)\/blob\)/g)] as RegExpMatchArray[];
        expect(resources, `${platform.name}: ${memo.contentMarkdown}`).toHaveLength(platform.imageCount);
        await article.goto("about:blank"); sourceBlocked = true;
        // With the source page gone and every external source host blocked,
        // reopen the saved note's image from the EdgeEver resource endpoint.
        for (const resource of resources) {
          const blob = await request.get(`/api/v1/resources/${resource[1]}/blob`);
          expect(blob.ok()).toBe(true);
          expect(Buffer.from(await blob.body()).equals(png)).toBe(true);
        }
      }
      const preview = await context.newPage();
      await preview.goto(baseURL!);
      await preview.getByRole("button", { name: "全部笔记", exact: true }).click();
      await preview.getByPlaceholder("搜索笔记").fill(platform.title);
      await preview.locator(`[data-memo-id="${note!.id}"]`).locator("button").first().click();
      const editor = preview.locator(".ProseMirror");
      await expect(editor).toContainText(platform.text);
      await expect(editor).not.toContainText(platform.excluded);
      await expect(editor.locator("p").filter({ hasText: "抓取时间:" })).toContainText(/抓取时间: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
      if (platform.name === "v2ex") {
        await expect(editor).toContainText("2023-12-13 14:47:02");
        await expect(editor).toContainText("2023-12-14 15:00:40");
      }
      if (platform.imageCount) {
        const images = editor.locator("img");
        await expect(images).toHaveCount(platform.imageCount);
        for (let index=0;index<platform.imageCount;index++) {
          const image=images.nth(index);
          await image.evaluate((element) => element.scrollIntoView({block:"center"}));
          await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
        }
      }
      await preview.close();
      sourceBlocked = false;
      // Recognized articles also refuse hidden content without a fallback note.
      failure = true;
      await article.goto(platform.url);
      expect((await save(platform.url)).ok).toBe(false);
      const unchanged = (await (await request.get("/api/v1/memos?limit=100")).json()).memos as Array<{ id: string }>;
      expect(unchanged.filter((memo) => !oldIds.has(memo.id)).map((memo) => memo.id)).toEqual([note!.id]);
      failure = false;
    }
    expect(sourceRequests.some((url) => /\.(mp3|m4a|mp4)(\?|$)/.test(url))).toBe(false);
  } finally {
    const cleanup = async (operation: () => Promise<unknown>) => {
      try { await operation(); } catch (error) { expect.soft(error, "E2E cleanup failed").toBeUndefined(); }
    };
    for (const id of memoIds) {
      await cleanup(async()=>expect.soft((await request.delete(`/api/v1/memos/${id}`)).ok()).toBe(true));
      await cleanup(async()=>expect.soft((await request.delete(`/api/v1/memos/${id}?permanent=1`)).ok()).toBe(true));
    }
    if (tokenId) await cleanup(async()=>expect.soft((await request.delete(`/api/v1/api-tokens/${tokenId}`)).ok()).toBe(true));
    await cleanup(()=>request.dispose());
    // Finished UI pages can still have plugin metadata requests in flight.
    await cleanup(async()=>context?.unrouteAll({behavior:"ignoreErrors"}));
    await cleanup(async()=>context?.close());
    imageServer.closeAllConnections();
    await cleanup(()=>new Promise<void>((done)=>imageServer.close(()=>done())));
    rmSync(directory, { recursive: true, force: true }); rmSync(profile, { recursive: true, force: true });
  }
});
