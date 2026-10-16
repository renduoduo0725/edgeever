import { E2E_STORAGE_STATE_PATH } from "./global-setup";
import { chromium, expect, request as playwrightRequest, test, type BrowserContext, type Worker } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
  { name: "xueqiu-feed", url: "https://www.xueqiu.com/", title: "$泡泡玛特(09992)$之前我一直在说，投资一定要祛魅，不要神化任何一个所谓的投资大佬。雪球上有个网友跟段永平开了个玩笑，说能不能借他一个亿去买纳指ETF。段永平直接回了一句：你当我弱智啊。就这一句回复，其实就能看出来一个人的格局和胸怀。", text: "把自己的真金白银押在别人的嘴上，早晚是要付出代价的。", excluded: "DETAIL HIDDEN SENTINEL", imageCount: 1, targetUrl: "https://xueqiu.com/2754211668/411841572" },
  { name: "linkedin-person", url: "https://www.linkedin.com/posts/maddyahmad_softwareengineering-artificialintelligence-share-7456582751698190336-6NVK/", title: "AI isn't coming for software engineers, but it is definitely reshaping what great engineers look like.".slice(0,100), text: "What technology are you focusing on in 2026", excluded: "3 度+", imageCount: 0 },
  { name: "jike-feed", url: "https://m.okjike.com/topics/63579abb6724cc583b9bba9a", title: "今天和朋友聊了很久，关于 AI 对游戏、影视以及整个内容行业的影响。越聊越觉得，我们现在正站在一个很有意思的历史节点上。聊天内容过长，我已经重新整理，补充部分论证例子，讨论如下：01｜我们正在经历一场被压缩到 1–2 年的“雅达利大崩溃”。", text: "护城河", excluded: "Ambi", imageCount: 1, targetUrl: "https://m.okjike.com/originalPosts/6ace942f756bbb66581c3f96", realCdn: true },
  { name: "wechat", url: "https://mp.weixin.qq.com/s/TC-ONpL3PGklsD0yhtcuBQ", title: "华为云DeepSeek-R1&V3满血版体验：10分钟让你轻松掌握AI大模型应用技巧！", text: "选择模型进行对话", excluded: "点击上方蓝字", imageCount: 21 },
  { name: "jike", url: "https://m.okjike.com/originalPosts/66ac89b0314f5cced41012d3", title: "AI 分析了我的即刻动态，给出了这个结论。绝了。@评论尸 提供的 Prompt。", text: "提供的 Prompt", excluded: "热门评论", imageCount: 1 },
  { name: "jike-grid", url: "https://m.okjike.com/originalPosts/6715e824d9dc81724c2ec74d", title: "又凑了九张赤坎游客照📷", text: "九张赤坎游客照", excluded: "热门评论", imageCount: 9 },
  { name: "jike-long", url: "https://m.okjike.com/originalPosts/64c9dd9a2edae6abdc610605", title: "我在即刻写东西的核心原则是，怕什么真理无穷，进一步有一步的欢喜。当我每次取得一点点微小的进步，我都会快速地将自己的方法、启发和心得分享出来。这才是即刻涨粉的正道，既有利于你的成长，又有利于平台的发展，互利共赢。希望能激励到更多人分享自己的所", text: "《世界尽头的咖啡馆》和《斯坦福大学人生设计课》", excluded: "热门评论", imageCount: 1 },
  { name: "sspai", url: "https://sspai.com/post/92653", title: "已经能测夜间体征的 Apple Watch，为什么要再做一个睡眠呼吸暂停提醒", text: "手腕上的「心率检测」靠谱吗", excluded: "作者提示", imageCount: 9 },
  { name: "juejin", url: "https://juejin.cn/post/6972051526416072717", title: "JavaScript异步发展历史", text: "let readFile", excluded: "复制代码", imageCount: 2 },
  { name: "douban-book", url: "https://book.douban.com/review/16093028/", title: "行走在文字间，是我与这个世界达成的和解", text: "直到精疲力尽", excluded: "有关键情节透露", imageCount: 6 },
  { name: "douban-movie", url: "https://movie.douban.com/review/17798662/", title: "假如没有越狱成功，安迪也仍是自由的", text: "To be honest", excluded: "有关键情节透露", imageCount: 2 },
  { name: "douban-music", url: "https://music.douban.com/review/17855287/", title: "回来击穿他的肚脐眼", text: "Ink乐评", excluded: "有关键情节透露", imageCount: 3 },
  { name: "douban-note", url: "https://www.douban.com/note/814698224/", title: "雨中小镇", text: "我和我身边的人", excluded: "赞赏", imageCount: 6 },
  { name: "xiaoyuzhou-hosts", url: "https://www.xiaoyuzhoufm.com/episode/612375e57f89405077cbeb3b", title: "第0期｜教培行业凉了，为什么我们选择开始做教育？", text: "阿丁、毛毛", excluded: "登录/注册", imageCount: 1 },
  { name: "boss", url: "https://www.zhipin.com/job_detail/0d7e760b0a0e7c3a0nF939S0E1NU.html", title: "AI平台开发工程师", text: "5、熟悉OCR技术", excluded: "立即沟通", imageCount: 0 },
  { name: "xueqiu", url: "https://xueqiu.com/5636485254/253443400", title: "通威太阳能（组件）盐城基地首车组件顺利发运", text: "及时高效响应全球客户和市场", excluded: "用的陕汽的重卡送货", imageCount: 3 },
  { name: "hacker-news", url: "https://news.ycombinator.com/item?id=40380738", title: "Show HN: I built a LLM-powered Ask HN: like Perplexity, but for HN comments", text: "Ollama on your machine!", excluded: "Matching the HN style", imageCount: 0 },
  { name: "v2ex", url: "https://www.v2ex.com/t/1000000", title: "程序员如何从公司上班转型", text: "看看大家多久后能来还愿", excluded: "抱歉跑个题", imageCount: 0 },
  { name: "xiaoyuzhou", url: "https://www.xiaoyuzhoufm.com/episode/62ad4ae5f9b62781ea058a02", title: "025. 快！抓紧时间拖延！", text: "韦礼安", excluded: "宝子姐生日快乐", imageCount: 1 },
  { name: "facebook", url: "https://www.facebook.com/NASA/posts/pfbid0dPToN66CzcAHGMoaNe3jszH4FfBKvqkE5gogCNJkTxXDPsSGYrGvcVwsLgByyMQQl", title: "Brewing up baby stars ⭐NASA's James Webb Space Telescope's unique view reveals many previously hidde", text: "in the red cloud", excluded: "That eight-pronged diffraction pattern", imageCount: 1 },
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
  const backgroundPath=join(directory,"assets/background.js");
  // Expose only the registered menu callback in this temporary test build.
  // Pointer, capture and persistence still use the production bundle.
  writeFileSync(backgroundPath,`const menuListener=chrome.contextMenus.onClicked.addListener.bind(chrome.contextMenus.onClicked);chrome.contextMenus.onClicked.addListener=(listener)=>{globalThis.__edgeeverTestMenuClick=listener;menuListener(listener);};\n${readFileSync(backgroundPath,"utf8")}`);
  const manifestPath = join(directory, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  // The test cannot grant activeTab by clicking browser chrome. Give only this
  // temporary build the sampled hosts, image host and local instance access.
  manifest.host_permissions = ["http://127.0.0.1/*", "https://cdnv2.ruguoapp.com/*", "https://www.lennysnewsletter.com/*", ...platforms.map((entry)=>`${new URL(entry.url).origin}/*`)];
  writeFileSync(manifestPath, JSON.stringify(manifest));

  let sourceBlocked = false;
  const imageServer = createServer((_req,res) => { res.writeHead(sourceBlocked ? 503 : 200, { "Content-Type": "image/png", "Access-Control-Allow-Origin": "*" }); res.end(sourceBlocked ? "blocked" : png); });
  await new Promise<void>((done)=>imageServer.listen(0,"127.0.0.1",done));
  const imageOrigin=`http://127.0.0.1:${(imageServer.address() as AddressInfo).port}`;
  // The internal workerd URL serves both the built Web app and its API. Use
  // that same origin for the editor, avoiding a request-forwarding test proxy.
  const builtInstanceUrl = process.env.EDGE_EVER_CLIPPER_TEST_INSTANCE_URL;
  const instanceUrl = builtInstanceUrl || baseURL;
  const request = await playwrightRequest.newContext({baseURL:instanceUrl,storageState:E2E_STORAGE_STATE_PATH,timeout:15_000});
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
      channel: "chromium", locale: "zh-CN", timezoneId: "Asia/Shanghai", args: [`--disable-extensions-except=${directory}`, `--load-extension=${directory}`, "--host-resolver-rules=MAP clipper.localhost 127.0.0.1"],
    });
    context.setDefaultTimeout(15_000);
    context.setDefaultNavigationTimeout(15_000);
    const cookies=JSON.parse(readFileSync(E2E_STORAGE_STATE_PATH,"utf8")).cookies;
    await context.addCookies(cookies);
    await context.addCookies(cookies.filter((cookie:any)=>cookie.domain === "127.0.0.1").map((cookie:any)=>({...cookie,domain:"clipper.localhost"})));
    const worker: Worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    await worker.evaluate((settings) => chrome.storage.local.set(settings), { instanceUrl: instanceUrl!, token, notebookId: "" });
    const article = context.pages()[0] ?? await context.newPage();
    let failure = false;
    let currentPlatform: typeof platforms[number] | undefined;
    const sourceRequests: string[] = [];
    const imageUrls = new Map<string,number>();
    await context.route(/^https:\/\//, async (route) => {
      const url = route.request().url();
      // Native players may preload their source when the fixture renders.
      // Clipper fetches still count, including an accidental audio download.
      if(route.request().resourceType() !== "media") sourceRequests.push(url);
      if (sourceBlocked) { await route.abort(); return; }
      const feedDetail=currentPlatform?.name === "xueqiu-feed" && url === "https://www.xueqiu.com/2754211668/411841572";
      const platform = currentPlatform?.url === url || feedDetail ? currentPlatform : undefined;
      if (!platform) {
        if(currentPlatform?.realCdn && new URL(url).hostname === "cdnv2.ruguoapp.com") await route.continue();
        else await route.abort();
        return;
      }
      const articlePlatform = platform.name === "medium-article" || platform.name === "substack-article";
      let html = failure && platform.name === "boss" ? readFileSync(join(repositoryRoot, "apps/extension/fixtures/platforms/boss-login-required.html"), "utf8") : failure && platform.name !== "xueqiu-feed" ? articlePlatform
        ? readFileSync(join(repositoryRoot, `apps/extension/fixtures/platforms/${feedDetail ? "xueqiu-feed-detail-second" : platform.name}.html`), "utf8").replace("<article", "<article hidden")
        : "<html><body><h1>Sign in</h1><p>Unrelated comments</p></body></html>"
        : platform.realCdn ? readFileSync(join(repositoryRoot, `apps/extension/fixtures/platforms/${feedDetail ? "xueqiu-feed-detail-second" : platform.name}.html`), "utf8")
        : readFileSync(join(repositoryRoot, `apps/extension/fixtures/platforms/${feedDetail ? "xueqiu-feed-detail-second" : platform.name}.html`), "utf8")
           .replace(/https:\/\/(?:mmbiz\.qpic\.cn|cdnv2\.ruguoapp\.com|cdnfile\.sspai\.com|img-blog\.csdnimg\.cn|img[0-9]\.doubanio\.com|image\.xyzcdn\.net|xqimg\.imedao\.com|bts-image\.xyzcdn\.net|cdn\.bsky\.app|[^/]+\.fbcdn\.net|[^/]+\.cdninstagram\.com|media\.licdn\.com|miro\.medium\.com|substackcdn\.com(?=\/image\/))\/[^"\s<]+/g, (original) => `${imageOrigin}/${new URL(original).hostname}${new URL(original).pathname}?image=${imageUrls.get(original) || (()=>{const id=imageUrls.size+1;imageUrls.set(original,id);return id;})()}`);
      if(feedDetail) html=html.replace('</head>',`<style>.detail-hidden-sentinel{display:none}${failure ? '.article__bd__detail{display:none}' : ''}</style></head>`)
        .replace('class="article__bd__detail">','class="article__bd__detail"><p class="detail-hidden-sentinel">DETAIL HIDDEN SENTINEL</p>')
        .replace('</body>','<script>parent.document.documentElement.dataset.detailScriptRan="yes";</script></body>');
      await route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    });
    const senderPromise = context.waitForEvent("page");
    await worker.evaluate(() => chrome.windows.create({ url: chrome.runtime.getURL("options.html"), focused: false }));
    const sender = await senderPromise; await sender.waitForLoadState();
    const activate = async (url: string) => {
      await worker.evaluate(async (targetUrl) => {
        const [tab] = await chrome.tabs.query({ url: targetUrl });
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
      }, url);
    };
    const save = async (url: string) => {
      await activate(url);
      return sender.evaluate(() => chrome.runtime.sendMessage({ type: "captureCurrentPage" }));
    };
    const checkBossPopup = async (url: string, needsLogin: boolean) => {
      await activate(url);
      await sender.goto(worker.url().replace(/\/assets\/background\.js$/, '/popup.html'));
      await expect(sender.locator('#capture-mode')).toHaveText(needsLogin ? '需登录' : '已适配');
      await expect(sender.locator('#capture-context')).toHaveAttribute('data-kind', needsLogin ? 'login-required' : 'adapted');
      if (needsLogin) {
        await expect(sender.locator('#status')).toContainText('请在网站登录并刷新');
        await expect(sender.locator('#capture-context .lucide-check')).toHaveCount(0);
        await expect(sender.locator('#save')).toBeEnabled();
        await sender.screenshot({path:'/tmp/edgeever-p2-boss-login-popup.png'});
      }
    };
    for (const platform of platforms) {
      currentPlatform = platform;
      console.log("Verifying",platform.name);
      const before = (await (await request.get("/api/v1/memos?limit=100")).json()).memos as Array<{ id: string }>;
      const oldIds = new Set(before.map((memo) => memo.id));
      await article.goto(platform.url);
      if (platform.name === 'boss') await checkBossPopup(platform.url, false);
      let saved;
      if(platform.targetUrl) {
        if(platform.name === "xueqiu-feed") await article.locator('a[class*="date-and-source_"][href="/2754211668/411841572"]').dispatchEvent("contextmenu");
        else await article.locator(".post-item-li").nth(1).locator(".text").dispatchEvent("contextmenu");
        await expect(article.locator("[data-edgeever-social-target]")).toHaveAttribute("data-edgeever-social-target",platform.targetUrl);
        expect((await save(platform.url)).ok).toBe(false);
        await worker.evaluate(async ({url,menu})=>{
          const [tab]=await chrome.tabs.query({url});
          (globalThis as any).__edgeeverTestMenuClick({menuItemId:menu,pageUrl:url,frameId:0},tab);
        },{url:platform.url,menu:platform.name === "xueqiu-feed" ? "save-xueqiu" : "save-jike"});
        await expect.poll(async()=> (await (await request.get("/api/v1/memos?limit=100")).json()).memos.filter((memo:any)=>!oldIds.has(memo.id)).length).toBe(1);
        // Image rewriting happens after creation; wait for its resource URL.
        await expect.poll(async()=> {
          const notes=(await (await request.get("/api/v1/memos?limit=100")).json()).memos;
          const note=notes.find((memo:any)=>!oldIds.has(memo.id));
          if(!note) return false;
          if(!memoIds.includes(note.id)) memoIds.push(note.id);
          const {memo}=await (await request.get(`/api/v1/memos/${note.id}`)).json();
          return memo.contentMarkdown.includes('/api/v1/resources/');
        }).toBe(true);
        saved={ok:true};
      } else saved = await save(platform.url);
      console.log("Saved",platform.name,saved);
      expect(saved.ok).toBe(true);
      const after = (await (await request.get("/api/v1/memos?limit=100")).json()).memos as Array<{ id: string; title: string }>;
      const note = after.find((memo) => !oldIds.has(memo.id) && memo.title === platform.title);
      memoIds.push(...after.filter((memo) => !oldIds.has(memo.id) && !memoIds.includes(memo.id)).map((memo) => memo.id));
      expect(note, platform.name).toBeTruthy();
      const detail = await request.get(`/api/v1/memos/${note!.id}`);
      expect(detail.ok()).toBe(true);
      const { memo } = await detail.json();
      expect(memo.contentMarkdown).toContain(platform.text);
      expect(memo.contentMarkdown).not.toContain(platform.excluded);
      if(platform.name === "douban-book") {
        expect(memo.contentMarkdown).toContain("\n\n在路上，我遇到了瓦尔泽");
        expect(memo.contentMarkdown).toContain("\n\n有人说，他写的是西方的散文");
      }
      if(platform.name === "sspai") {
        expect(memo.contentMarkdown).toContain("> **中国大陆推出睡眠呼吸暂停迹象提示功能**");
        expect(memo.contentMarkdown).toContain("> 2026 年 10 月 14 日，Apple 在中国大陆正式推出");
      }
      if(platform.name === "wechat") {
        expect(memo.contentMarkdown).toContain("## 什么是Deepseek V3");
        expect(memo.contentMarkdown).toMatch(/^###\s+第一步：注册华为云账号$/m);
      }
      if (platform.name === "juejin") expect(memo.contentMarkdown).toContain("```javascript\nlet readFile = (path, callBack) => {");
      expect(memo.contentMarkdown).toContain(platform.name === "linkedin" ? "https://www.linkedin.com/feed/update/urn:li:activity:7497764718095323136/"
        : platform.name === "linkedin-person" ? "https://www.linkedin.com/feed/update/urn:li:share:7456582751698190336/" : platform.name.startsWith("linkedin-ugc") ? "https://www.linkedin.com/feed/update/urn:li:ugcPost:7497764716677758977/" : platform.targetUrl || platform.url);
      expect(memo.contentMarkdown).toMatch(/抓取时间: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\b/);
      if (platform.name === "linkedin-person") {
        expect(memo.contentMarkdown).toContain("作者: Mohammad Ahmed · Technical Lead - Backend at Dizzaract");
        expect(memo.contentMarkdown).toContain("5 个月前");
      }
      if (platform.name === "boss") {
        for (const text of ["25-50K·13薪", "深圳 5-10年 本科", "130个国家和地区", "深圳福田区博今国际A座", "五险一金"]) expect(memo.contentMarkdown).toContain(text);
      }
      if (platform.name === "xueqiu-feed") {
        expect(memo.tags).toEqual(expect.arrayContaining(["web-clip","xueqiu","投资","09992","NTES"]));
        await expect(article.locator('iframe[sandbox="allow-same-origin"]')).toHaveCount(0);
        expect(await article.evaluate(()=>document.documentElement.dataset.detailScriptRan)).toBeUndefined();
      }
      if (platform.name === "xueqiu") {
        expect(memo.tags).toEqual(expect.arrayContaining(["web-clip", "xueqiu", "投资", "SH600438", "SH601012", "SH688472"]));
        expect(memo.contentMarkdown).toContain("2023-06-17 07:54:12");
      }
      if (platform.name === "medium-article" || platform.name === "substack-article") {
        expect(memo.tags).toEqual(expect.arrayContaining(["web-clip",platform.name === "medium-article" ? "medium" : "substack"]));
        expect(memo.contentMarkdown).toContain(platform.name === "medium-article" ? "Scott Batson" : "Ethan Mollick");
        expect(memo.contentMarkdown).toContain(platform.name === "medium-article" ? "2026-09-01 02:48:46" : "2026-10-01 18:54:12");
      }
      if (platform.name === "xiaoyuzhou") {
        for (const stamp of ["02:52", "08:00", "14:20", "19:20", "30:43", "34:00", "38:52", "54:30"]) expect(memo.contentMarkdown).toContain(stamp);
      }
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
          if(platform.realCdn) {
            expect(blob.headers()["content-type"]).toContain("image/jpeg");
            expect(createHash("md5").update(await blob.body()).digest("base64")).toBe("OwtQdRowjgnW2tBYjA4j2A==");
          } else expect(Buffer.from(await blob.body()).equals(png)).toBe(true);
        }
      }
      const preview = await context.newPage();
      const verifyWarmOffline=platform.realCdn && !!builtInstanceUrl;
      const webUrl=verifyWarmOffline ? instanceUrl!.replace("127.0.0.1","clipper.localhost") : instanceUrl!;
      await preview.goto(webUrl);
      if(verifyWarmOffline) {
        // The default Vite development server intentionally disables the PWA.
        // A configured built instance must register its actual Service Worker.
        await expect.poll(()=>preview.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
      }
      await preview.getByRole("button", { name: "全部笔记", exact: true }).click();
      await preview.getByPlaceholder("搜索笔记").fill(platform.title);
      await preview.locator(`[data-memo-id="${note!.id}"]`).locator("button").first().click();
      const editor = preview.locator(".ProseMirror");
      await expect(editor).toContainText(platform.text);
      if(platform.name === "douban-book") {
        await expect(editor.locator("p").filter({hasText:"在路上，我遇到了瓦尔泽"})).toHaveText(/^在路上，我遇到了瓦尔泽/);
        await expect(editor.locator("p").filter({hasText:"有人说，他写的是西方的散文"})).toHaveText(/^有人说，他写的是西方的散文/);
      }
      if(platform.name === "juejin") {
        const table=editor.locator("table");
        await expect(table).toHaveCount(1);
        await expect(table.locator("tr")).toHaveCount(5);
        await expect(table.locator("th")).toHaveText(["发展史","优点","缺点"]);
        for(const [index,label] of ["callback","promise","generator","async/await"].entries()) {
          await expect(table.locator("tr").nth(index+1).locator("td")).toHaveCount(3);
          await expect(table.locator("tr").nth(index+1).locator("td").first()).toHaveText(label);
        }
        await expect(table.locator("a")).toHaveText("事件循环");
      }
      if(platform.name === "sspai") {
        const update=editor.locator("blockquote").filter({hasText:"中国大陆推出睡眠呼吸暂停迹象提示功能"});
        await expect(update).toHaveCount(1);
        await expect(update.locator("strong")).toHaveText("中国大陆推出睡眠呼吸暂停迹象提示功能");
        await expect(update).toContainText("以下内容于 10:00更新");
        await expect(update).toContainText("2026 年 10 月 14 日，Apple 在中国大陆正式推出");
      }
      if(platform.name === "wechat") {
        await expect(editor.locator("h2").filter({hasText:"什么是Deepseek V3"})).toHaveCount(1);
        await expect(editor.locator("h3").filter({hasText:"第一步：注册华为云账号"})).toHaveCount(1);
      }
      // Code-copy buttons are added by EdgeEver's editor after loading. They
      // are not part of the archived article or its source-site controls.
      const articleText = await editor.evaluate(element => {
        const copy = element.cloneNode(true) as Element;
        copy.querySelectorAll(".edgeever-code-copy-button").forEach(button => button.remove());
        return copy.textContent || "";
      });
      expect(articleText).not.toContain(platform.excluded);
      await expect(editor.locator("p").filter({ hasText: "抓取时间:" })).toContainText(/抓取时间: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
      if (platform.name === "v2ex") {
        await expect(editor).toContainText("2023-12-13 14:47:02");
        await expect(editor).toContainText("2023-12-14 15:00:40");
      }
      if (platform.imageCount) {
        // ProseMirror inserts source-less separator images around inline
        // content; count the article images, excluding those editor controls.
        const images = editor.locator("img:not(.ProseMirror-separator)");
        await expect(images).toHaveCount(platform.imageCount);
        for (let index=0;index<platform.imageCount;index++) {
          const image=images.nth(index);
          await image.evaluate((element) => element.scrollIntoView({block:"center"}));
          await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
        }
      }
      if(verifyWarmOffline) {
        const paths=[...memo.contentMarkdown.matchAll(/!\[[^\]]*\]\((\/api\/v1\/resources\/[^/)]+\/blob)\)/g)].map((match:any)=>match[1]);
        await expect.poll(()=>preview.evaluate(async paths=>{
          const cache=await caches.open("edgeever-resource-blobs");
          return Promise.all(paths.map(path=>cache.match(path).then(Boolean)));
        },paths)).toEqual(paths.map(()=>true));
        const mirrored=await preview.evaluate(id=>new Promise<boolean>((resolve,reject)=>{
          const open=indexedDB.open("edgeever-local");open.onerror=()=>reject(open.error);
          open.onsuccess=()=>{const db=open.result,get=db.transaction("memos").objectStore("memos").getAll();
            get.onsuccess=()=>{resolve(get.result.some((memo:any)=>memo.id===id));db.close();};get.onerror=()=>reject(get.error);};
        }),note!.id);
        expect(mirrored).toBe(true);
        // Prepare the cached all-notes list online; searching is a separate
        // query lifecycle, while this case verifies reopening a cached note.
        await preview.getByPlaceholder("搜索笔记").fill("");
        // The current note list virtualizes rows; verify the two rows needed
        // for switching away and back rather than counting the whole dataset.
        await expect(preview.locator(`[data-memo-id="${note!.id}"]`)).toHaveCount(1);
        await expect(preview.locator(`[data-memo-id]:not([data-memo-id="${note!.id}"])`).first()).toBeVisible();
        await context.setOffline(true);
        try {
          expect(await preview.evaluate(()=>navigator.onLine)).toBe(false);
          expect(await preview.evaluate(async()=>{try{await fetch("/api/v1/auth/session");return false;}catch{return true;}})).toBe(true);
          await preview.locator(`[data-memo-id]:not([data-memo-id="${note!.id}"])`).first().locator("button").first().click();
          await expect.poll(()=>editor.evaluateAll((nodes,text)=>nodes.some(node=>node.textContent?.includes(text)),platform.text)).toBe(false);
          await preview.locator(`[data-memo-id="${note!.id}"]`).locator("button").first().click();
          await expect(editor).toContainText(platform.text);
          const images=editor.locator("img:not(.ProseMirror-separator)");await expect(images).toHaveCount(platform.imageCount);
          await expect.poll(()=>images.first().evaluate(img=>(img as HTMLImageElement).naturalWidth > 0)).toBe(true);
          await preview.getByPlaceholder("搜索笔记").fill('6ace942f756bbb66581c3f96');
          await expect(preview.locator('[data-memo-id]')).toHaveCount(1);
          await preview.locator(`[data-memo-id="${note!.id}"]`).locator("button").first().click();
          await expect(editor).toContainText(platform.text);
          console.log("Verified real CDN archival and warm Web offline reopen",platform.name);
        } finally {await context.setOffline(false);}
      }
      await preview.close();
      sourceBlocked = false;
      // Recognized articles also refuse hidden content without a fallback note.
      failure = true;
      await article.goto(platform.url);
      if (platform.name === 'boss') await checkBossPopup(platform.url, true);
      if(platform.name === "xueqiu-feed") {
        await article.locator('a[class*="date-and-source_"][href="/2754211668/411841572"]').dispatchEvent("contextmenu");
        await worker.evaluate(async url=>{const [tab]=await chrome.tabs.query({url});(globalThis as any).__edgeeverTestMenuClick({menuItemId:"save-xueqiu",pageUrl:url,frameId:0},tab);},platform.url);
        await expect(article.locator('#edgeever-clipper-toast [data-sonner-toast][data-type="error"]')).toBeVisible();
        await expect(article.locator('iframe[sandbox="allow-same-origin"]')).toHaveCount(0);
      } else expect((await save(platform.url)).ok).toBe(false);
      const unchanged = (await (await request.get("/api/v1/memos?limit=100")).json()).memos as Array<{ id: string }>;
      expect(unchanged.filter((memo) => !oldIds.has(memo.id)).map((memo) => memo.id)).toEqual([note!.id]);
      failure = false;
    }
    currentPlatform={name:'substack-paywall',url:'https://www.lennysnewsletter.com/p/how-to-build-ai-product-sense',title:'How to build AI product sense',text:'',excluded:'',imageCount:0};
    const beforePaywall=(await (await request.get("/api/v1/memos?limit=100")).json()).memos.map((memo:any)=>memo.id);
    await article.goto(currentPlatform.url);await activate(currentPlatform.url);
    await sender.goto(worker.url().replace(/\/assets\/background\.js$/, '/popup.html'));
    await expect(sender.locator('#capture-mode')).toHaveText('内容受限');
    await expect(sender.locator('#capture-context')).toHaveAttribute('data-kind','content-restricted');
    await expect(sender.locator('#status')).toContainText('受限预览');
    await sender.screenshot({path:'/tmp/edgeever-p2-substack-restricted-popup.png'});
    expect((await save(currentPlatform.url)).ok).toBe(false);
    expect((await (await request.get("/api/v1/memos?limit=100")).json()).memos.map((memo:any)=>memo.id)).toEqual(beforePaywall);
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
