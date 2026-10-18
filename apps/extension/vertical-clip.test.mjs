import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createDocument, createWindow } from "@mixmark-io/domino";
import { bundleTestScripts } from "./bundle-test-scripts.mjs";
import { isPlatformClip, platformElementHidden, platformHtmlMarkdown, platformReadableCopy, platformTarget } from "./src/platform-clip.ts";
import { bossLoginRequired, readBoss } from "./src/boss-clip.ts";
import { readXueqiu, xueqiuCardTarget } from "./src/xueqiu-clip.ts";
import { readXiaoyuzhou } from "./src/xiaoyuzhou-clip.ts";

const bossUrl = "https://www.zhipin.com/job_detail/0d7e760b0a0e7c3a0nF939S0E1NU.html";
const xueqiuUrl = "https://xueqiu.com/5636485254/253443400";
const fixtureText = (name) => readFileSync(new URL(`./fixtures/platforms/${name}.html`, import.meta.url), "utf8");
const fixture = (name) => createDocument(fixtureText(name));

test("vertical detail identities discard tracking but reject foreign hosts, duplicate paths and credentials", () => {
  expect(platformTarget(bossUrl + "?lid=tracking#salary")).toEqual({ platform: "boss", id: "0d7e760b0a0e7c3a0nF939S0E1NU", url: bossUrl });
  expect(platformTarget(xueqiuUrl.replace("xueqiu.com", "www.xueqiu.com") + "?from=share#comments")).toEqual({ platform: "xueqiu", id: "5636485254/253443400", url: xueqiuUrl });
  for (const url of [bossUrl.replace("www.zhipin.com", "www.zhipin.com.evil.test"), bossUrl.replace("https:", "http:"), bossUrl.replace("https://", "https://u:p@"), bossUrl.replace(".html", "/extra.html"), "https://www.zhipin.com/web/geek/job", xueqiuUrl.replace("xueqiu.com", "xueqiu.com:444"), xueqiuUrl.replace("5636485254", "0"), xueqiuUrl + "/extra", "https://xueqiu.com/S/SH600438"]) {
    expect(platformTarget(url)).toBeNull();
  }
});

test("BOSS real readable job keeps complete requirements, salary, location and company; excludes hidden noise and controls", () => {
  const result = readBoss(fixture("boss"), bossUrl);
  expect(result.ok).toBe(true);
  expect(result.clip).toMatchObject({ title: "AI平台开发工程师", author: "超聚变技术有限公司", tags: ["web-clip", "boss"] });
  for (const text of ["25-50K·13薪", "深圳 5-10年 本科", "5、熟悉OCR技术", "130个国家和地区", "深圳福田区博今国际A座", "节日福利", "五险一金"]) expect(result.clip.markdown).toContain(text);
  for (const text of ["立即沟通", "登录/注册", "竞争力分析", "点击查看地图", "boss", "BOSS直聘描述"]) expect(result.clip.markdown).not.toContain(text);
  expect(result.clip.publishedAt).toBeUndefined(); // Page update date is not a publication date.
  expect(isPlatformClip(result.clip, platformTarget(bossUrl))).toBe(true);
});

test("BOSS rejects the actual signed-out preview and mismatched canonical identity", () => {
  expect(readBoss(fixture("boss-login-required"), bossUrl)).toEqual({ ok: false, reason: "unreadable" });
  const doc = fixture("boss");
  doc.querySelector('link[rel="canonical"]').setAttribute("href", bossUrl.replace("E1NU", "E1NV"));
  expect(readBoss(doc, bossUrl)).toEqual({ ok: false, reason: "changed" });
});

test("BOSS optional metadata and company introduction do not gate an otherwise readable job", () => {
  for (const selector of ['link[rel="canonical"]', '.sider-company', '.job-detail-company', '.info-primary p', '.salary']) {
    const doc = fixture("boss"); doc.querySelector(selector).remove();
    const result = readBoss(doc, bossUrl);
    expect(result.ok).toBe(true);
    expect(result.clip.markdown).toContain("5、熟悉OCR技术");
  }
  const doc = fixture("boss"); doc.querySelector('.salary').textContent = "薪资可谈";
  expect(readBoss(doc, bossUrl).clip.markdown).toContain("薪资可谈");
});

test("BOSS hides optional company information instead of refusing the complete job", () => {
  const doc = fixture("boss");
  doc.querySelector('.sider-company').setAttribute('hidden', '');
  doc.querySelector('.job-detail-company').setAttribute('hidden', '');
  const result = readBoss(doc, bossUrl);
  expect(result.ok).toBe(true); expect(result.clip.author).toBeUndefined();
  expect(result.clip.markdown).not.toContain('超聚变');
});

test("visibility overrides retain readable descendants while hidden text and images stay excluded", () => {
  const doc = createDocument('<div id="body"><div style="visibility:hidden">Hidden text<img src="https://example.test/hidden.png"><span style="visibility:visible">Visible child text</span></div></div>');
  expect(platformElementHidden(doc.querySelector('span'))).toBe(false);
  const markdown = platformHtmlMarkdown(platformReadableCopy(doc.querySelector('#body')), 'https://example.test/');
  expect(markdown).toContain('Visible child text'); expect(markdown).not.toContain('Hidden text'); expect(markdown).not.toContain('hidden.png');
  const restricted = fixture('boss-login-required');
  const wrapper = restricted.querySelector('.zp-more-info-layer-wrapper'), label = restricted.querySelector('.zp-more-info-layer-text');
  wrapper.style.visibility = 'hidden'; label.style.visibility = 'visible';
  expect(bossLoginRequired(restricted)).toBe(true);
  label.style.visibility = 'hidden'; label.innerHTML = '<span style="visibility:visible">登录查看完整内容</span>';
  expect(bossLoginRequired(restricted)).toBe(true); expect(readBoss(restricted, bossUrl).ok).toBe(false);
  label.style.visibility = 'visible'; label.innerHTML = '<span hidden>登录查看完整内容</span>';
  expect(bossLoginRequired(restricted)).toBe(false);
});

test("the BOSS login hint uses only its visible job-preview layer, not unrelated login controls or hidden leftovers", () => {
  const doc = fixture("boss-login-required");
  expect(bossLoginRequired(doc)).toBe(true);
  doc.querySelector(".zp-more-info-layer-wrapper").setAttribute("style", "display:none");
  expect(bossLoginRequired(doc)).toBe(false);
  doc.querySelector(".zp-more-info-layer-wrapper").removeAttribute("style");
  doc.querySelector(".zp-more-info-layer-text").setAttribute("hidden", "");
  expect(bossLoginRequired(doc)).toBe(false);
  const readable = fixture("boss");
  readable.body.innerHTML += '<aside class="zp-more-info-layer-wrapper">登录查看完整内容</aside>';
  expect(bossLoginRequired(readable)).toBe(false);
});

for (const selector of [".job-banner", ".job-sec-text"]) test(`BOSS does not read a hidden ${selector}`, () => {
  const doc = fixture("boss"); doc.querySelector(selector).setAttribute("hidden", "");
  expect(readBoss(doc, bossUrl).ok).toBe(false);
});

test("Xueqiu real article keeps author, original post time, all images and only its explicitly linked stock tags", () => {
  const result = readXueqiu(fixture("xueqiu"), platformTarget(xueqiuUrl), xueqiuUrl);
  expect(result.ok).toBe(true);
  expect(result.clip).toMatchObject({ author: "--大圣--", publishedAt: { value: "2023-06-16T23:54:12.000Z", precision: "datetime" }, tags: ["web-clip", "xueqiu", "投资", "SH600438", "SH601012", "SH688472"] });
  expect(result.clip.markdown).toContain("及时高效响应全球客户和市场");
  expect(result.clip.markdown.match(/!\[/g)).toHaveLength(3);
  for (const text of ["用的陕汽的重卡送货", "来源：雪球App", "打赏作者", "热门话题"]) expect(result.clip.markdown).not.toContain(text);
  expect(isPlatformClip(result.clip, platformTarget(xueqiuUrl))).toBe(true);
  expect(isPlatformClip({ ...result.clip, tags: [...result.clip.tags, "invented ticker"] }, platformTarget(xueqiuUrl))).toBe(false);
});

test("stock tags ignore hidden references, plain mentions, comments and unrelated links", () => {
  const doc = fixture("xueqiu"), body = doc.querySelector(".article__bd__detail");
  body.innerHTML += '<p>Plain AAPL and SH999999</p><p hidden><a href="/S/AAPL">AAPL</a></p><p><a href="https://evil.test/S/MSFT">MSFT</a></p>';
  expect(readXueqiu(doc, platformTarget(xueqiuUrl), xueqiuUrl).clip.tags).toEqual(["web-clip", "xueqiu", "投资", "SH600438", "SH601012", "SH688472"]);
  body.querySelectorAll("a[href]").forEach((a) => a.removeAttribute("href"));
  expect(readXueqiu(doc, platformTarget(xueqiuUrl), xueqiuUrl).clip.tags).toEqual(["web-clip", "xueqiu", "投资"]);
});

test("Xueqiu stocks cannot come from controls or scripts removed from the saved body", () => {
  const doc = fixture("xueqiu"), body = doc.querySelector('.article__bd__detail');
  body.innerHTML += '<button><a href="/S/AAPL">Removed AAPL</a></button><form><a href="/S/MSFT">Removed MSFT</a></form>';
  const result = readXueqiu(doc, platformTarget(xueqiuUrl), xueqiuUrl);
  expect(result.clip.tags).not.toContain('AAPL'); expect(result.clip.tags).not.toContain('MSFT');
  expect(result.clip.markdown).not.toContain('Removed');
});

test("Xueqiu readable detail does not require author and time links; conflicts and source identity still bind it", () => {
  const target = platformTarget(xueqiuUrl), doc = fixture('xueqiu');
  const card = doc.querySelector('.article__container'), time = doc.querySelector('a.time');
  time.parentElement.appendChild(time.cloneNode(true));
  expect(xueqiuCardTarget(card)?.url).toBe(xueqiuUrl);
  expect(readXueqiu(doc, target, xueqiuUrl).ok).toBe(true);
  doc.querySelectorAll('a.time').forEach(n=>n.remove());
  doc.querySelector('.article__author a.name').removeAttribute('href');
  const result = readXueqiu(doc, target, xueqiuUrl);
  expect(result.ok).toBe(true); expect(result.clip.author).toBe('--大圣--'); expect(result.clip.publishedAt).toBeUndefined();
  expect(readXueqiu(doc, target, xueqiuUrl.replace('253443400','253443401'))).toEqual({ok:false,reason:'changed'});
});

test("unproven expand classes and hidden controls do not mark a complete Xueqiu detail as truncated", () => {
  const doc = fixture('xueqiu');
  doc.querySelector('.article__bd__detail').innerHTML += '<button class="read-more" hidden>Show more</button><p class="show-more-info">Ordinary visible paragraph</p>';
  const result = readXueqiu(doc, platformTarget(xueqiuUrl), xueqiuUrl);
  expect(result.ok).toBe(true); expect(result.clip.markdown).toContain('Ordinary visible paragraph');
});

test("the real feed's five-digit Hong Kong stock link keeps its leading zero when present in a readable post", () => {
  const feed = fixture("xueqiu-feed"), doc = fixture("xueqiu");
  const stock = feed.querySelector('a[href="https://xueqiu.com/S/09992"]');
  expect(stock).toBeTruthy();
  doc.querySelector(".article__bd__detail").appendChild(stock.cloneNode(true));
  const result = readXueqiu(doc, platformTarget(xueqiuUrl), xueqiuUrl);
  expect(result.clip.tags).toContain("09992");
  expect(isPlatformClip(result.clip, platformTarget(xueqiuUrl))).toBe(true);
});

test("Xueqiu stays within the persisted tag limit while retaining all explicit stock links in the body", () => {
  const doc = fixture("xueqiu"), target = platformTarget(xueqiuUrl);
  doc.querySelector(".article__bd__detail").innerHTML = Array.from({ length: 30 }, (_, i) => `<p><a href="/S/SH${600000 + i}">Stock ${i}</a></p>`).join("");
  const result = readXueqiu(doc, target, xueqiuUrl);
  expect(result.clip.tags).toHaveLength(24);
  expect(result.clip.tags.slice(3)).toHaveLength(21);
  expect(result.clip.markdown).toContain("SH600029");
  expect(isPlatformClip(result.clip, target)).toBe(true);
  expect(isPlatformClip({ ...result.clip, tags: [...result.clip.tags, "SH600030"] }, target)).toBe(false);
});

test("body links and a mismatched author cannot prove Xueqiu parent identity; modified time is not publication time", () => {
  const doc = fixture("xueqiu"), target = platformTarget(xueqiuUrl);
  const time = doc.querySelector(".article__author a.time");
  time.firstChild.textContent = "修改于";
  expect(readXueqiu(doc, target, xueqiuUrl).clip.publishedAt).toBeUndefined();
  time.href = xueqiuUrl.replace("253443400", "253443401");
  doc.querySelector(".article__bd__detail").innerHTML += `<a href="${xueqiuUrl}">Referenced post</a>`;
  expect(readXueqiu(doc, target, xueqiuUrl).ok).toBe(false);
  time.href = xueqiuUrl;
  doc.querySelector(".article__author a.name").href = "/999";
  expect(readXueqiu(doc, target, xueqiuUrl).ok).toBe(false);
});

for (const selector of [".article__container", ".article__bd__detail"]) test(`Xueqiu rejects hidden ${selector}`, () => {
  const doc = fixture("xueqiu"); doc.querySelector(selector).setAttribute("aria-hidden", "true");
  expect(readXueqiu(doc, platformTarget(xueqiuUrl), xueqiuUrl).ok).toBe(false);
});

for (const classic of [false, true]) test(`Xueqiu ${classic ? 'classic signed-in' : 'module'} feed pointer targets only its own header; preview requires its detail`, () => {
  const html = classic ? fixtureText("xueqiu-feed").replace(/(?:style_)?(timeline__item__(?:main|info)|date-and-source|user-name)_[\w-]+/g, '$1') : fixtureText("xueqiu-feed");
  const window = createWindow(html, "https://www.xueqiu.com/");
  const [script] = bundleTestScripts(["social-target"]);
  runInContext(script, createContext({ document: window.document, location: window.location, Element: window.Element, Node: window.Node, URL }));
  const cards = [...window.document.querySelectorAll('.timeline__item__main, [class*="timeline__item__main_"]')];
  expect(cards).toHaveLength(2);
  const target = xueqiuCardTarget(cards[0]);
  expect(target.url).toBe("https://xueqiu.com/6114376649/411862401");
  const body = cards[0].querySelector('[class*="timeline__item__content_"]');
  body.innerHTML += `<a href="${xueqiuUrl}">Referenced article</a>`;
  body.lastChild.dispatchEvent(new window.Event("contextmenu", { bubbles: true }));
  expect(cards[0].getAttribute("data-edgeever-social-target")).toBe(target.url);
  expect(readXueqiu(window.document, target, "https://www.xueqiu.com/")).toEqual({ ok: false, reason: "not-target" });
  cards[1].querySelector('[class*="timeline__item__content_"]').dispatchEvent(new window.Event("contextmenu", { bubbles: true }));
  expect(cards[0].hasAttribute("data-edgeever-social-target")).toBe(false);
  expect(cards[1].hasAttribute("data-edgeever-social-target")).toBe(true);
});

test("Xiaoyuzhou rejects a hidden Show Notes body even with complete loaded state", () => {
  const doc = fixture("xiaoyuzhou"); doc.querySelector(".sn-content article").setAttribute("hidden", "");
  expect(readXiaoyuzhou(doc, "https://www.xiaoyuzhoufm.com/episode/62ad4ae5f9b62781ea058a02", {})).toEqual({ ok: false, reason: "unreadable" });
});

test("Xiaoyuzhou real explicit hosts stay with the complete episode timeline and podcast name", () => {
  const doc = fixture("xiaoyuzhou-hosts");
  const result = readXiaoyuzhou(doc, "https://www.xiaoyuzhoufm.com/episode/612375e57f89405077cbeb3b", { podcast: "Podcast" });
  expect(result.ok).toBe(true);
  for (const text of ["下课以后", "1:10", "5:16", "7:04", "11:08", "14:56", "16:42", "阿丁、毛毛", "蜻蜓FM等平台收听"]) expect(result.clip.markdown).toContain(text);
  expect(result.clip.author).toBeUndefined(); // Episode hosts are the explicit Show Notes text, not podcast authors.
});

test("Xiaoyuzhou loaded state never restores hidden descendants or title", () => {
  const url = "https://www.xiaoyuzhoufm.com/episode/62ad4ae5f9b62781ea058a02";
  const doc = fixture("xiaoyuzhou"), body = doc.querySelector(".sn-content article");
  body.innerHTML = `<div style="display:none">${body.innerHTML}</div>`;
  expect(readXiaoyuzhou(doc, url, {}).ok).toBe(false);
  const hiddenTitle = fixture("xiaoyuzhou"); hiddenTitle.querySelector("h1").setAttribute("hidden", "");
  expect(readXiaoyuzhou(hiddenTitle, url, {}).ok).toBe(false);
});

test("Xiaoyuzhou accepts readable Show Notes restored inside a visibility-hidden container", () => {
  const doc = fixture("xiaoyuzhou"), body = doc.querySelector(".sn-content article");
  body.style.visibility = "hidden";
  body.innerHTML = `<div style="visibility:visible">${body.innerHTML}</div>`;
  expect(readXiaoyuzhou(doc, "https://www.xiaoyuzhoufm.com/episode/62ad4ae5f9b62781ea058a02", {podcast:"Podcast"}).ok).toBe(true);
});

test("hidden Xueqiu permalink cannot target a feed card; detail metadata remains optional", () => {
  const doc = fixture("xueqiu"), target = platformTarget(xueqiuUrl);
  doc.querySelector("a.time time").setAttribute("hidden", "");
  expect(readXueqiu(doc, target, xueqiuUrl).clip.publishedAt).toBeUndefined();
  doc.querySelector("a.time").setAttribute("hidden", "");
  expect(xueqiuCardTarget(doc.querySelector(".article__container"))).toBeNull();
  expect(readXueqiu(doc, target, xueqiuUrl).clip.publishedAt).toBeUndefined();
});

test("BOSS hidden section headings cannot leak into Markdown", () => {
  const doc = fixture("boss"), heading = doc.querySelector(".job-detail-company h3");
  heading.setAttribute("hidden", ""); heading.textContent = "Hidden heading sentinel";
  expect(readBoss(doc, bossUrl).clip.markdown).not.toContain("Hidden heading sentinel");
});
