import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createDocument } from "@mixmark-io/domino";
import { platformTarget, platformHtmlMarkdown, publishedTimeText, clipDateTimeText } from "./src/platform-clip.ts";
import { readHackerNews } from "./src/hacker-news-clip.ts";
import { readV2ex } from "./src/v2ex-clip.ts";
import { readXiaoyuzhou } from "./src/xiaoyuzhou-clip.ts";
import { markdownToDoc } from "../../packages/shared/src/content.ts";
import { pageImageRefs, replacePageImageUrls } from "./src/page-images.ts";

test("clipped literal alphabetic list prefixes survive the stored document without losing words",()=>{
 const doc=createDocument('<p>Dr. Nancy Grace Roman:<br>Mr. Someone</p><p>II. Literal heading</p><ol><li>Actual numbered item</li></ol><pre><code>Dr. exact code\nII. unchanged</code></pre>');
 const markdown=platformHtmlMarkdown(doc.body,'https://example.test');
 const parsed=markdownToDoc(markdown),nodes=[];const walk=n=>{nodes.push(n);(n.content||[]).forEach(walk)};walk(parsed);
 const text=nodes.filter(n=>n.type==='text').map(n=>n.text).join('');
 expect(text).toContain('Dr. Nancy Grace Roman:');expect(text).toContain('Mr. Someone');expect(text).toContain('II. Literal heading');
 expect(nodes.filter(n=>n.type==='orderedList')).toHaveLength(1);
 expect(nodes.find(n=>n.type==='listItem').content[0].content[0].text).toBe('Actual numbered item');
 expect(nodes.find(n=>n.type==='codeBlock').content[0].text).toBe('Dr. exact code\nII. unchanged');
});

test("rich table cells retain their grid, line breaks, inline code and archived images",()=>{
  const doc=createDocument('<table><tr><th>内容</th><th>代码</th></tr><tr><td><p>首段<br>次行</p><ul><li>one</li><li>two<img src="https://example.test/cell.png"></li></ul><blockquote>引用</blockquote></td><td><pre><code class="language-js">  a || b;\n\n\nconst tag = `&lt;br&gt;`;</code></pre></td></tr></table>');
  const markdown=platformHtmlMarkdown(doc.body,'https://example.test');
  expect(markdown).not.toContain('joplin-table-wrapper');expect(markdown).not.toContain('<table');
  expect(pageImageRefs(markdown,'https://example.test')).toEqual([{href:'https://example.test/cell.png',url:'https://example.test/cell.png'}]);
  const parsed=markdownToDoc(replacePageImageUrls(markdown,[{href:'https://example.test/cell.png',resourceId:'cell'}]));
  const table=parsed.content.find(node=>node.type==='table');expect(table.content).toHaveLength(2);expect(table.content[1].content).toHaveLength(2);
  const nodes=[];const walk=node=>{nodes.push(node);(node.content || []).forEach(walk);};walk(table);
  expect(nodes.filter(node=>node.type==='hardBreak').length).toBeGreaterThanOrEqual(5);
  expect(nodes.find(node=>node.type==='image').attrs.src).toBe('/api/v1/resources/cell/blob');
  const code=nodes.filter(node=>node.marks?.some(mark=>mark.type==='code')).map(node=>node.text);
  expect(code).toContain('  a || b;');expect(code).toContain('const tag = `<br>`;');
  const text=nodes.filter(node=>node.type==='text').map(node=>node.text).join('');
  expect(text).toContain('引用');expect(text).not.toContain('<br><br>');expect(text).not.toContain('```js');
});

test("table code keeps literal backslash-pipe runs and adjacent columns without adding characters",()=>{
  const text=node=>node.text || (node.content || []).map(text).join('');
  for(const kind of ['code','pre']) for(const count of [0,1,2,3,4]) for(const pipes of ['|','||']) {
    const literal=`${kind==='pre'?'  \t':''}a ${'\\'.repeat(count)}${pipes} b & <br>${kind==='pre'?'\t  ':''}`;
    const doc=createDocument('<table><tr><th>Code</th><th>Next</th></tr><tr><td id="code"></td><td>end</td></tr></table>');
    const code=doc.createElement(kind);code.textContent=literal;doc.querySelector('#code').appendChild(code);
    const table=markdownToDoc(platformHtmlMarkdown(doc.body,'https://example.test')).content.find(node=>node.type==='table');
    expect(table.content[1].content).toHaveLength(2);
    expect(table.content[1].content.map(text)).toEqual([literal,'end']);
  }
});

test("HTML row spans retain column association and additional header rows remain data",()=>{
  const doc=createDocument('<table><thead><tr><th>A</th><th>B</th></tr><tr><th>sub A</th><th>sub B</th></tr></thead><tbody><tr><td rowspan="2">both</td><td>row1</td></tr><tr><td>row2</td></tr></tbody></table>');
  const original=doc.body.outerHTML,markdown=platformHtmlMarkdown(doc.body,'https://example.test');
  const text=node=>node.text || (node.content || []).map(text).join('');
  const table=markdownToDoc(markdown).content.find(node=>node.type==='table');
  expect(table.content.map(row=>row.content.map(text))).toEqual([['A','B'],['sub A','sub B'],['both','row1'],['both','row2']]);
  expect(doc.body.outerHTML).toBe(original);
});

test("colspan headings form valid GFM and vertical spans stop at their row group",()=>{
  const text=node=>node.text || (node.content || []).map(text).join('');
  const cases=[
    ['<table><thead><tr><th colspan="2">Group</th><th>Other</th></tr></thead><tbody><tr><td colspan="2">Value</td><td>Final</td></tr></tbody></table>',[['Group','','Other'],['Value','','Final']]],
    ['<table><tr><th>A</th><th>B</th></tr><tbody><tr><td rowspan="0">group1</td><td>one</td></tr><tr><td>two</td></tr></tbody><tbody><tr><td>group2</td><td>three</td></tr></tbody></table>',[['A','B'],['group1','one'],['group1','two'],['group2','three']]],
  ];
  for(const [html,expected] of cases){const table=markdownToDoc(platformHtmlMarkdown(createDocument(html).body,'https://example.test')).content.find(node=>node.type==='table');expect(table?.content.map(row=>row.content.map(text))).toEqual(expected);}
  const code=markdownToDoc(platformHtmlMarkdown(createDocument('<table><tr><th>Code</th></tr><tr><td><pre>first\n  \nlast</pre></td></tr></table>').body,'https://example.test'));
  const nodes=[];const walk=node=>{nodes.push(node);(node.content || []).forEach(walk);};walk(code);
  expect(nodes.filter(node=>node.marks?.some(mark=>mark.type==='code')).map(node=>node.text)).toEqual(['first','  ','last']);
});

test("table conversion retains repeated pipes in prose and code and escapes literal HTML captions",()=>{
  const doc=createDocument('<table><caption>&lt;img src=x onerror=alert(1)&gt;</caption><thead><tr><th>表达式</th><th>说明</th></tr></thead><tbody><tr><td>左 || 右，<code>a || b</code></td><td>逻辑或</td></tr></tbody></table>');
  const markdown=platformHtmlMarkdown(doc.body,'https://example.test');
  expect(markdown).not.toContain('<img');
  const parsed=markdownToDoc(markdown),table=parsed.content.find(node=>node.type==='table');
  expect(table?.content).toHaveLength(2);
  const text=node=>node.text || (node.content || []).map(text).join('');
  expect(text(table.content[1].content[0])).toBe('左 || 右，a || b');
  expect(text(parsed.content[0])).toBe('<img src=x onerror=alert(1)>');
  expect(text(table.content[1].content[1])).toBe('逻辑或');
  expect(platformHtmlMarkdown(createDocument('<p>正文</p><table></table>').body,'https://example.test')).toBe('正文');
});

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

test("V2EX omits invisible article descendants and metadata without requiring optional fields",()=>{
  const doc=fixture('v2ex'),body=doc.querySelector('.topic_content'),original=body.textContent;
  const hidden=doc.createElement('p');hidden.style.display='none';hidden.textContent='HIDDEN BODY SENTINEL';body.appendChild(hidden);
  doc.querySelector('small.gray a').setAttribute('hidden','');doc.querySelector('small.gray span').style.display='none';
  const result=readV2ex(doc,vUrl,labels);expect(result.ok).toBe(true);
  expect(result.clip.markdown).not.toContain('HIDDEN BODY SENTINEL');expect(result.clip.markdown).toContain('环境不好');expect(result.clip.markdown).toContain('Supplement 2');
  expect(result.clip.author).toBeUndefined();expect(result.clip.publishedAt).toBeUndefined();expect(body.textContent).toBe(original+'HIDDEN BODY SENTINEL');
  doc.querySelector('h1').style.display='none';expect(readV2ex(doc,vUrl,labels)).toEqual({ok:false,reason:'unreadable'});
});

test("V2EX retains visible descendants restored within an otherwise invisible supplement",()=>{
  const doc=fixture('v2ex'),supplement=doc.querySelector('.subtle');supplement.style.visibility='hidden';supplement.querySelector('.topic_content').style.visibility='visible';
  const result=readV2ex(doc,vUrl,labels);expect(result.ok).toBe(true);expect(result.clip.markdown).toContain('从今天开始转型');expect(result.clip.markdown).toContain('看看大家多久后能来还愿');
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

test('clipped CJK bold ending in punctuation remains bold next to unspaced prose',()=>{
 const source='<p><strong>一定要尊重市场规律，某队没法改变规律！</strong>只是起到稳定市场的功能。</p><p>Literal **words** stay literal.</p><pre><code>**exact！**code</code></pre>';
 const doc=createDocument(source),before=doc.body.innerHTML;
 const parsed=markdownToDoc(platformHtmlMarkdown(doc.body,'https://example.test'));
 const nodes=[];const walk=n=>{nodes.push(n);(n.content||[]).forEach(walk)};walk(parsed);
 const paragraph=parsed.content[0];expect(paragraph.content.map(n=>n.text||'').join('')).toBe('一定要尊重市场规律，某队没法改变规律！只是起到稳定市场的功能。');
 expect(paragraph.content.some(n=>n.text==='一定要尊重市场规律，某队没法改变规律'&&n.marks?.some(m=>m.type==='bold'))).toBe(true);
 expect(parsed.content[1].content.map(n=>n.text||'').join('')).toBe('Literal **words** stay literal.');
 expect(nodes.find(n=>n.type==='codeBlock').content[0].text).toBe('**exact！**code');expect(doc.body.innerHTML).toBe(before);
});
