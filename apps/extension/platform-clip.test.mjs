import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createDocument } from "@mixmark-io/domino";
import { platformTarget, platformHtmlMarkdown, publishedTimeText, clipDateTimeText } from "./src/platform-clip.ts";
import { readHackerNews } from "./src/hacker-news-clip.ts";
import { readV2ex } from "./src/v2ex-clip.ts";
import { readXiaoyuzhou } from "./src/xiaoyuzhou-clip.ts";

const labels = {
  score: "Points at capture", externalLink: "Linked page", supplement: "Supplement",
  podcast: "Podcast", noShowNotes: "This episode has no Show Notes", relativeTime: "relative time as displayed",
};
const hnUrl = "https://news.ycombinator.com/item?id=40380738";
const vUrl = "https://www.v2ex.com/t/1000000";
const xUrl = "https://www.xiaoyuzhoufm.com/episode/62ad4ae5f9b62781ea058a02";
test("LinkedIn UGC permalinks retain their URN type and never alias an activity ID", () => {
  const id="7497764716677758977";
  const expected={platform:"linkedin",id:`ugcPost:${id}`,url:`https://www.linkedin.com/feed/update/urn:li:ugcPost:${id}/`};
  expect(platformTarget(`https://www.linkedin.com/posts/nasa-space-astronomy-ugcPost-${id}-qmKO/?trk=share`)).toEqual(expected);
  expect(platformTarget(expected.url)).toEqual(expected);
  expect(platformTarget(expected.url.replace("ugcPost","activity")).id).not.toBe(expected.id);
  for(const url of [expected.url.replace("ugcPost","other"),expected.url.replace("www.linkedin.com","www.linkedin.com.evil.test")]) expect(platformTarget(url)).toBeNull();
});
const fixture = (name) => createDocument(readFileSync(new URL(`./fixtures/platforms/${name}.html`, import.meta.url), "utf8"));
const state = (doc, change) => {
  const node = doc.querySelector("#__NEXT_DATA__");
  const data = JSON.parse(node.textContent);
  change(data.props.pageProps.episode, data);
  node.textContent = JSON.stringify(data);
};

test("detail URLs retain identity and discard tracking, pagination and comment anchors", () => {
  expect(platformTarget(`${hnUrl}&utm_source=x#40384810`)).toEqual({ platform: "hacker-news", id: "40380738", url: hnUrl });
  expect(platformTarget("https://v2ex.com/t/1000000?p=2#reply99")).toEqual({ platform: "v2ex", id: "1000000", url: vUrl });
  expect(platformTarget(`${xUrl}?utm_source=share#comments`)).toEqual({ platform: "xiaoyuzhou", id: "62ad4ae5f9b62781ea058a02", url: xUrl });
  for (const url of ["https://news.ycombinator.com/", "https://www.v2ex.com/go/python", "https://www.xiaoyuzhoufm.com/podcast/62ad4ae5f9b62781ea058a02", `${hnUrl}&id=1`, "https://news.ycombinator.com.evil.test/item?id=1", "https://u:p@news.ycombinator.com/item?id=1", "http://news.ycombinator.com/item?id=1", "https://news.ycombinator.com/item?id=0", "https://www.v2ex.com.evil.test/t/1000000", "https://u:p@www.v2ex.com/t/1000000", "http://www.v2ex.com/t/1000000"]) {
    expect(platformTarget(url)).toBeNull();
  }
});

test("HN real DOM keeps text and external link together, metadata and no comments", () => {
  const result = readHackerNews(fixture("hacker-news"), hnUrl, labels);
  expect(result.ok).toBe(true);
  expect(result.clip).toMatchObject({ platform: "hacker-news", id: "40380738", url: hnUrl, author: "jnnnthnn", publishedAt: { value: "2024-05-16T17:11:58Z", precision: "datetime" }, tags: ["web-clip", "hacker-news"] });
  expect(result.clip.title).toStartWith("Show HN: I built a LLM-powered Ask HN");
  expect(result.clip.markdown).toContain("Hi HN!");
  expect(result.clip.markdown).toContain("Ollama on your machine!");
  expect(result.clip.markdown).toContain("Linked page: [https://hackersearch.net/ask](https://hackersearch.net/ask)");
  expect(result.clip.markdown).toContain("Points at capture: 92");
  expect(result.clip.markdown).not.toContain("Matching the HN style");
});

test("HN allows Ask text and link-only posts and omits missing metadata", () => {
  const text = fixture("hacker-news");
  text.querySelector(".titleline a").setAttribute("href", "item?id=40380738");
  text.querySelector(".score").remove(); text.querySelector(".age").remove();
  const ask = readHackerNews(text, hnUrl, labels);
  expect(ask.ok).toBe(true);
  expect(ask.clip.markdown).not.toContain("Linked page:");
  expect(ask.clip.markdown).not.toContain("Points at capture:");
  expect(ask.clip.publishedAt).toBeUndefined();
  const link = fixture("hacker-news"); link.querySelector(".toptext").remove();
  expect(readHackerNews(link, hnUrl, labels).clip.markdown).toContain("Linked page:");
});

test("HN keeps explicit timezones and date-only or relative precision", () => {
  for (const [title, text, expected] of [
    ["2024-05-16T17:11:58Z", "", { value: "2024-05-16T17:11:58Z", precision: "datetime" }],
    ["2024-05-17T01:11:58+08:00", "", { value: "2024-05-17T01:11:58+08:00", precision: "datetime" }],
    ["2024-05-16", "", { value: "2024-05-16", precision: "date" }],
    ["", "2 hours ago", { value: "2 hours ago", precision: "relative" }],
  ]) {
    const doc = fixture("hacker-news");
    const age = doc.querySelector(".age");
    age.setAttribute("title", title); age.textContent = text;
    expect(readHackerNews(doc, hnUrl, labels).clip.publishedAt).toEqual(expected);
  }
});

test("HN rejects comment, deleted, unreadable and mismatched main posts", () => {
  const doc = fixture("hacker-news");
  expect(readHackerNews(doc, hnUrl.replace("40380738", "40384810"), labels).ok).toBe(false);
  doc.querySelector(".titleline").remove();
  expect(readHackerNews(doc, hnUrl, labels).ok).toBe(false);
  const deleted = fixture("hacker-news"); deleted.querySelector(".titleline a").textContent = "[deleted]";
  expect(readHackerNews(deleted, hnUrl, labels).ok).toBe(false);
});

test("publication text retains date-only, relative and unknown-zone values", () => {
  for (const value of ["2023-12-13T13:25:31-00:00", "2023-12-13T13:25:31.123456"]) {
    expect(publishedTimeText({ value, precision: "datetime" }, labels.relativeTime)).toBe("2023-12-13 13:25:31");
  }
  expect(publishedTimeText({ value: "2023-12-13", precision: "date" }, labels.relativeTime)).toBe("2023-12-13");
  expect(publishedTimeText({ value: "2 天前", precision: "relative" }, labels.relativeTime)).toBe(`2 天前 (${labels.relativeTime})`);
});

test("V2EX real DOM keeps both supplements and their times, excluding replies", () => {
  const result = readV2ex(fixture("v2ex"), `${vUrl}?p=2#reply12`, labels);
  expect(result.ok).toBe(true);
  expect(result.clip).toMatchObject({ title: "程序员如何从公司上班转型", author: "toubi", url: vUrl, publishedAt: { value: "2023-12-13T13:25:31+08:00", precision: "datetime" }, tags: ["web-clip", "v2ex"] });
  expect(result.clip.markdown).toContain("环境不好");
  expect(result.clip.markdown).toContain("Supplement 1");
  expect(result.clip.markdown).toContain(clipDateTimeText("2023-12-13T14:47:02+08:00"));
  expect(result.clip.markdown).toContain("Supplement 2");
  expect(result.clip.markdown).toContain(clipDateTimeText("2023-12-14T15:00:40+08:00"));
  expect(result.clip.markdown.indexOf("从今天开始转型")).toBeLessThan(result.clip.markdown.indexOf("看看大家多久后能来还愿"));
  expect(result.clip.markdown).not.toContain("抱歉跑个题");
});

test("V2EX handles body-only and supplement-only topics, and rejects login or stale pages", () => {
  const doc = fixture("v2ex");
  Array.from(doc.querySelectorAll(".subtle")).forEach((node) => node.remove());
  expect(readV2ex(doc, vUrl, labels).ok).toBe(true);
  const supplements = fixture("v2ex"); supplements.querySelector(".cell .topic_content").remove();
  expect(readV2ex(supplements, vUrl, labels).clip.markdown).toContain("Supplement 2");
  doc.querySelector(".topic_content").remove();
  doc.querySelector(".header").insertAdjacentHTML("afterend", '<div class="cell"><a href="/signin">请先登录</a></div>');
  expect(readV2ex(doc, vUrl, labels).ok).toBe(false);
  expect(readV2ex(fixture("v2ex"), vUrl.replace("1000000", "1000001"), labels).ok).toBe(false);
});

test("publication precision remains date or relative text instead of capture time", () => {
  const doc = fixture("v2ex"); const span = doc.querySelector("small.gray span[title]");
  span.setAttribute("title", "2023-12-13");
  expect(readV2ex(doc, vUrl, labels).clip.publishedAt).toEqual({ value: "2023-12-13", precision: "date" });
  span.removeAttribute("title"); span.textContent = "2 天前";
  expect(readV2ex(doc, vUrl, labels).clip.publishedAt).toEqual({ value: "2 天前", precision: "relative" });
});

test("Xiaoyuzhou real DOM already contains full notes before expansion", () => {
  const doc = fixture("xiaoyuzhou"); const result = readXiaoyuzhou(doc, xUrl, labels);
  expect(doc.querySelector(".expand")).not.toBeNull();
  expect(result.ok).toBe(true);
  expect(result.clip).toMatchObject({ title: "025. 快！抓紧时间拖延！", publishedAt: { value: "2022-06-18T03:47:48.686Z", precision: "datetime" }, completeness: "complete", tags: ["web-clip", "xiaoyuzhou"] });
  expect(result.clip.author).toBeUndefined();
  expect(result.clip.markdown).toContain("双城FM");
  expect(result.clip.markdown).toContain("54:30");
  expect(result.clip.markdown).toContain("韦礼安");
  expect(result.clip.markdown).toContain("![025.");
  expect(result.clip.markdown).not.toContain("timestamp=");
  expect(result.clip.markdown).not.toContain("cosmos:");
  expect(result.clip.markdown).not.toContain("宝子姐生日快乐");
  expect(result.clip.markdown).not.toContain("audio");
  doc.querySelector(".expand-wrap").remove();
  expect(readXiaoyuzhou(doc, xUrl, labels)).toEqual(result);
});

test("Xiaoyuzhou distinguishes incomplete/unreadable notes from confirmed empty notes", () => {
  const doc = fixture("xiaoyuzhou");
  doc.querySelector(".sn-content article").innerHTML = "<p>只有预览</p>";
  expect(readXiaoyuzhou(doc, xUrl, labels)).toEqual({ ok: false, reason: "incomplete" });
  doc.querySelector(".sn-content article").innerHTML = "";
  expect(readXiaoyuzhou(doc, xUrl, labels).ok).toBe(false);
  state(doc, (e) => { e.shownotes = ""; });
  const empty = readXiaoyuzhou(doc, xUrl, labels);
  expect(empty.ok).toBe(true);
  expect(empty.clip.completeness).toBe("no-shownotes");
  expect(empty.clip.markdown).toContain(labels.noShowNotes);
  doc.querySelector("#__NEXT_DATA__").remove();
  expect(readXiaoyuzhou(doc, xUrl, labels).ok).toBe(false);
});

test("Xiaoyuzhou keeps a >1h timeline, valid links, explicit hosts and images without inventing a second TOC", () => {
  const doc = fixture("xiaoyuzhou");
  const html = '<p>主播：Alice 和 Bob</p><p><a class="timestamp" data-timestamp="3662">01:01:02</a> 章节</p><p><a href="https://example.com/chapter">已验证链接</a></p><img src="https://example.com/body.png">';
  doc.querySelector(".sn-content article").innerHTML = html;
  state(doc, (e) => { e.shownotes = html; });
  const result = readXiaoyuzhou(doc, xUrl, labels);
  expect(result.ok).toBe(true);
  expect(result.clip.markdown.match(/01:01:02/g)).toHaveLength(1);
  expect(result.clip.markdown).toContain("主播：Alice 和 Bob");
  expect(result.clip.markdown).toContain("[已验证链接](https://example.com/chapter)");
  expect(result.clip.markdown).toContain("https://example.com/body.png");
});

test("Xiaoyuzhou rejects mismatched state, title and navigation identities", () => {
  const doc = fixture("xiaoyuzhou");
  expect(readXiaoyuzhou(doc, xUrl.replace(/02$/, "03"), labels).ok).toBe(false);
  state(doc, (e) => { e.eid = "62ad4ae5f9b62781ea058a03"; });
  expect(readXiaoyuzhou(doc, xUrl, labels).ok).toBe(false);
  const stale = fixture("xiaoyuzhou"); stale.querySelector("h1").textContent = "新单集";
  expect(readXiaoyuzhou(stale, xUrl, labels).ok).toBe(false);
});

test("Xiaoyuzhou compares titles with the same whitespace normalization", () => {
  const doc = fixture("xiaoyuzhou");
  const title = "  播客 EP. 01  为什么工作\u00a0";
  doc.querySelector("h1").textContent = title;
  state(doc, (episode) => { episode.title = title; });
  expect(readXiaoyuzhou(doc, xUrl, labels).clip.title).toBe("播客 EP. 01 为什么工作");
});

test("Xiaoyuzhou uses the current route's bound state after client navigation leaves stale bootstrap JSON", () => {
  const doc = fixture("xiaoyuzhou");
  const id = "6a8ef24e1352af56ff3c83f3", title = "161. 新单集", shownotes = "<p>当前单集全文</p>";
  const url = `https://www.xiaoyuzhoufm.com/episode/${id}`;
  doc.querySelector('link[rel="canonical"]').setAttribute("href", url);
  doc.querySelector("h1").textContent = title;
  doc.querySelector(".sn-content article").innerHTML = shownotes;
  const state = { pageUrl: url, queryId: id, eid: id, title, shownotes };
  const result = readXiaoyuzhou(doc, url, labels, state);
  expect(result.ok).toBe(true);
  expect(result.clip.id).toBe(id);
  expect(result.clip.markdown).toContain("当前单集全文");
  expect(result.clip.markdown).not.toContain("韦礼安");
  expect(readXiaoyuzhou(doc, url, labels, { ...state, pageUrl: xUrl }).ok).toBe(false);
  expect(readXiaoyuzhou(doc, url, labels, { ...state, eid: "wrong" }).ok).toBe(false);
});

test("HTML cleanup preserves semantic content and code language on a copy", () => {
  const doc = createDocument('<div id="body"><h2>正文</h2><blockquote>引用</blockquote><ul><li>条目</li></ul><pre><code class="language-js">const x = `safe`;\n```</code></pre><a href="/article">链接</a><img data-src="//images.example.com/a.png" onerror="evil()"><script>bad()</script><a href="javascript:evil()">危险链接</a><iframe src="/evil"></iframe><button>分享</button></div>');
  const body = doc.querySelector("#body"); const before = body.outerHTML;
  const markdown = platformHtmlMarkdown(body, "https://www.v2ex.com/t/1000000");
  expect(markdown).toContain("## 正文");
  expect(markdown).toContain("> 引用");
  expect(markdown).toMatch(/-\s+条目/);
  expect(markdown).toContain("````js\nconst x = `safe`;\n```\n````");
  expect(markdown).toContain("[链接](https://www.v2ex.com/article)");
  expect(markdown).toContain("https://images.example.com/a.png");
  for (const unwanted of ["javascript:", "evil()", "bad()", "分享", "onerror", "<iframe"]) expect(markdown).not.toContain(unwanted);
  expect(body.outerHTML).toBe(before);
});
