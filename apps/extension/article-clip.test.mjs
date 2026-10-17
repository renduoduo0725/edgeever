import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createDocument } from "@mixmark-io/domino";
import { readArticle } from "./src/article-clip.ts";
import { readJike } from "./src/jike-clip.ts";
import { readDouban, doubanCommentTarget } from "./src/douban-clip.ts";
import { isPlatformClip, platformTarget, socialPlatform } from "./src/platform-clip.ts";
import { markdownToDoc } from "../../packages/shared/src/content.ts";

const urls = {
  wechat:"https://mp.weixin.qq.com/s/TC-ONpL3PGklsD0yhtcuBQ",sspai:"https://sspai.com/post/92653",juejin:"https://juejin.cn/post/6972051526416072717",
  jike:"https://m.okjike.com/originalPosts/66ac89b0314f5cced41012d3","jike-grid":"https://m.okjike.com/originalPosts/6715e824d9dc81724c2ec74d","jike-long":"https://m.okjike.com/originalPosts/64c9dd9a2edae6abdc610605",
  "douban-book":"https://book.douban.com/review/16093028/","douban-movie":"https://movie.douban.com/review/17798662/","douban-music":"https://music.douban.com/review/17855287/","douban-note":"https://www.douban.com/note/814698224/",
};
const fixture=(name)=>createDocument(readFileSync(new URL(`./fixtures/platforms/${name}.html`,import.meta.url),"utf8"));
const read=(name,doc=fixture(name))=>name.startsWith("jike") ? readJike(doc,urls[name]) : name.startsWith("douban") ? readDouban(doc,platformTarget(urls[name]),urls[name]) : readArticle(doc,urls[name],"公众号");

test("article URLs normalize aliases and tracking, retaining only WeChat query identity/signature",()=>{
  for (const url of Object.values(urls)) expect(platformTarget(url+"?from=share#comments")?.url).toBe(url);
  const long="https://mp.weixin.qq.com/s?__biz=MzA%3D%3D&mid=123&idx=1&sn=abc&scene=21&pass_ticket=unused";
  expect(platformTarget(long)).toEqual({platform:"wechat",id:"MzA==/123/1",url:"https://mp.weixin.qq.com/s?__biz=MzA%3D%3D&mid=123&idx=1&sn=abc"});
  expect(platformTarget(long.replace("&sn=abc", ""))?.platform).toBe("wechat");
  expect(platformTarget(long+"&mid=456")).toBeNull();
  expect(platformTarget(urls.jike.replace("m.okjike.com/originalPosts", "web.okjike.com/originalPost"))?.url).toBe(urls.jike);
  for (const url of [urls.wechat.replace("mp.weixin.qq.com","mp.weixin.qq.com.evil.test"),urls.sspai+"/extra",urls.juejin.replace("https:","http:"),urls["douban-book"].replace("https://","https://u:p@"),"https://mp.weixin.qq.com/","https://sspai.com/","https://juejin.cn/","https://web.okjike.com/"]) expect(platformTarget(url)).toBeNull();
});

for(const [name,author,images] of [["wechat","陈云亮",21],["sspai","北鸮",9],["juejin","小和山的菜鸟们",2],["jike","汐笺",1],["jike-grid","彗星咻咻咻",9],["jike-long","泛函",1],["douban-book","完颜打骨折",6],["douban-movie","希音",2],["douban-note","孩子气概",6],["douban-music",null,3]]) {
  test(`${name}: real DOM retains own text/author/images and satisfies the save contract`,()=>{
    const result=read(name); expect(result.ok).toBe(true);
    if(author) expect(result.clip.author).toBe(author);
    expect([...result.clip.markdown.matchAll(/!\[/g)]).toHaveLength(images);
    expect(isPlatformClip(result.clip,platformTarget(urls[name]))).toBe(true);
    expect(result.clip.markdown).not.toMatch(/javascript:|<script|写留言|收集各项错误|检查视图/);
  });
}

test("WeChat keeps its account, author, declared cover and lazy image URLs while excluding share/reward controls",()=>{
  const result=read("wechat");
  expect(result.clip.markdown).toContain("公众号: 大数据架构之道");
  expect(result.clip.markdown).toContain("选择模型进行对话");
  expect(result.clip.markdown).toContain("https://mmbiz.qpic.cn/");
  expect(result.clip.markdown).not.toContain("喜欢作者");
  expect(result.clip.markdown).not.toContain("wx_lazy=1");
  expect(result.clip.publishedAt).toEqual({value:"2025-02-22T23:02:00",precision:"datetime"});
});

test("Sspai retains its update as a quote with displayed time, bold title and complete body after the original article",()=>{
  const doc=fixture("sspai"),original=doc.body.outerHTML,result=read("sspai",doc);
  expect(result.ok).toBe(true);
  expect(result.clip.markdown).toContain("> 以下内容于 10:00更新\n>\n> **中国大陆推出睡眠呼吸暂停迹象提示功能**\n>\n> 2026 年 10 月 14 日，Apple 在中国大陆正式推出 Apple Watch 睡眠呼吸暂停迹象提示功能，文章根据相关信息更新并重推。");
  expect(result.clip.markdown.indexOf("> **中国大陆推出")).toBeGreaterThan(result.clip.markdown.indexOf("手腕上的「心率检测」靠谱吗"));
  expect(result.clip.markdown.match(/中国大陆推出睡眠呼吸暂停迹象提示功能/g)).toHaveLength(1);
  expect(result.clip.publishedAt).toEqual({value:"2024-10-10",precision:"date"});
  expect(result.clip.markdown).not.toContain("42位派友已充电");
  expect(doc.body.outerHTML).toBe(original);
});

test("Sspai update blocks stay scoped and ordered, keeping rich content while omitting hidden or missing metadata",()=>{
  const doc=fixture("sspai"),updates=doc.querySelector('.update__details__wrapper');
  const later=doc.querySelector('.update-details-item').cloneNode(true);later.id='update-1';
  later.querySelector('.update-title').textContent='后续更正';
  later.querySelector('.update-date').textContent='以下内容于 昨天 18:30更新';
  later.querySelector('.update-body').innerHTML='<p>补充说明 <a href="https://example.test/source">官方来源</a></p><pre><code class="language-js">const corrected = true;</code></pre><img data-src="https://example.test/update.png">';
  later.insertAdjacentHTML('beforeend','<button>不应保存的互动控件</button><p>不应保存的推荐信息</p>');updates.appendChild(later);
  const unrelated=later.cloneNode(true);unrelated.querySelector('.update-body').textContent='其他区域的同名更新';doc.body.appendChild(unrelated);
  const result=read('sspai',doc);expect(result.ok).toBe(true);
  expect(result.clip.markdown.indexOf('> **后续更正**')).toBeGreaterThan(result.clip.markdown.indexOf('> **中国大陆推出'));
  for(const text of ['以下内容于 昨天 18:30更新','[官方来源](https://example.test/source)','> ```js\n> const corrected = true;','> ![](https://example.test/update.png)']) expect(result.clip.markdown).toContain(text);
  for(const text of ['不应保存的互动控件','不应保存的推荐信息','其他区域的同名更新']) expect(result.clip.markdown).not.toContain(text);
  expect(result.clip.markdown.match(/!\[/g)).toHaveLength(10);
  later.querySelector('.update-title').remove();later.querySelector('.update-date').setAttribute('hidden','');
  const optional=read('sspai',doc);expect(optional.ok).toBe(true);expect(optional.clip.markdown).toContain('补充说明');expect(optional.clip.markdown).not.toContain('昨天 18:30');
  updates.setAttribute('style','display:none');
  const hidden=read('sspai',doc);expect(hidden.ok).toBe(true);expect(hidden.clip.markdown).not.toContain('2026 年 10 月 14 日');expect(hidden.clip.markdown).not.toContain('补充说明');
});

test("Sspai authors remain within the selected article, retaining coauthors and optional absence",()=>{
  const doc=fixture("sspai"),article=doc.querySelector("article.normal-article"),own=article.querySelector('.article__header__author');
  const outside=own.cloneNode(true);outside.querySelectorAll('.ss__user__nickname > span').forEach(node=>node.textContent='OTHER ARTICLE AUTHOR');doc.body.insertBefore(outside,article);
  const coauthor=own.cloneNode(true);coauthor.querySelectorAll('.ss__user__nickname > span').forEach(node=>node.textContent='合著者');own.after(coauthor);
  const hidden=own.cloneNode(true);hidden.querySelectorAll('.ss__user__nickname > span').forEach(node=>node.textContent='HIDDEN AUTHOR');hidden.style.display='none';own.after(hidden);
  const result=read('sspai',doc);expect(result.ok).toBe(true);expect(result.clip.author).toBe('北鸮, 合著者');
  expect(result.clip.publishedAt).toEqual({value:'2024-10-10',precision:'date'});
  Array.from(article.querySelectorAll('.article__header__author')).forEach(node=>node.remove());
  const optional=read('sspai',doc);expect(optional.ok).toBe(true);expect(optional.clip.author).toBeUndefined();
});

test("WeChat removes the article's own follow banner, decorative dividers, ad widgets and trailing recommendation",()=>{
  const doc=fixture("wechat"),original=doc.body.outerHTML,result=read("wechat",doc);
  expect(result.ok).toBe(true);
  for(const noise of ["点击上方蓝字","关于我们","分割线","现阶段的AI没有推理能力","DRPKCGMAPjK","iaic5Jv7oDhWHr79"]) expect(result.clip.markdown).not.toContain(noise);
  for(const text of ["什么是Deepseek V3","model='deepseek-reasoner'","点击右上角","选择模型进行对话","至此，可以体验由华为云昇腾AI芯片提供的满血版DeepSeek R1"]) expect(result.clip.markdown).toContain(text);
  for(const model of ["DeepSeek-R1-671B-32K","DeepSeek-V3-671B-32K","DeepSeek-R1-671B-8K","DeepSeek-V3-671B-8K","DeepSeek-V3-671B-4K","DeepSeek-R1-671B-4K"]) expect(result.clip.markdown).toContain(model);
  const clean=fixture("wechat");clean.querySelector("mp-common-cpsad").innerHTML='<p>广告短剧：立即观看</p><img src="https://example.test/ad-cover.png">';
  expect(read("wechat",clean).clip.markdown).not.toContain("广告短剧");expect(read("wechat",clean).clip.markdown).not.toContain("ad-cover.png");
  expect(doc.body.outerHTML).toBe(original);
});

test("WeChat keeps tutorial actions, quoted follow wording, meaningful GIFs and inline article references",()=>{
  const doc=fixture("wechat"),body=doc.querySelector("#js_content");
  body.innerHTML='<p>教程示例：点击上方蓝字是常见的关注话术。</p><blockquote><p>点击上方蓝字，关注我们</p></blockquote><pre><code>点击上方蓝字，关于我们</code></pre><p>点击右上角“注册”，按要求填写即可。</p><p><img class="__bg_gif" alt="模型推理过程" data-src="https://example.test/reasoning.gif"></p><p>参见 <a href="https://mp.weixin.qq.com/s/reference">相关教程</a>，继续下面的步骤。</p><section><a href="https://mp.weixin.qq.com/s/inline"><span class="h5_image_link"><img src="https://example.test/inline.png"></span>文章引用</a></section><p>正文在引用之后继续。</p><p><a href="https://example.test/conclusion">结论来源</a></p>';
  const result=read("wechat",doc);expect(result.ok).toBe(true);
  for(const text of ["点击上方蓝字是常见的关注话术","关注我们","关于我们","点击右上角","reasoning.gif","[相关教程]","文章引用","inline.png","正文在引用之后继续","[结论来源]"]) expect(result.clip.markdown).toContain(text);
});

test("WeChat restores the real article's styled sections and nested step headings without changing its title",()=>{
  const doc=fixture("wechat"),original=doc.body.outerHTML,result=read("wechat",doc);
  expect(result.ok).toBe(true);
  expect(result.clip.title).toBe("华为云DeepSeek-R1&V3满血版体验：10分钟让你轻松掌握AI大模型应用技巧！");
  expect(result.clip.markdown.match(/^#{2,6} .+$/gm).map(line=>line.replace(/\s+/g,' '))).toEqual([
    "## 什么是Deepseek V3","## 什么是DeepSeek R1","## 华为云ModelAart Studio（MaaS）",
    "### 第一步：注册华为云账号","### 第二步：领取免费tokens","### 第三步：安装cherry studio","### 第四步：配置并使用cherry studio",
  ]);
  expect(result.clip.markdown.match(/!\[/g)).toHaveLength(21);
  expect(doc.body.outerHTML).toBe(original);
});

test("WeChat keeps bold prose, ordinary numbered actions, quotes, code and captions out of inferred headings",()=>{
  const doc=fixture("wechat"),body=doc.querySelector("#js_content");
  body.innerHTML='<p style="font-size:14px">这是一段说明正文。它用于解释下面的操作和普通排版，包含足够的实际内容。</p><p style="font-size:14px"><strong>这是一段完整加粗的正文。</strong></p><p style="font-size:14px"><span style="font-size:24px">首</span>字放大，其余还是正文。</p><p style="font-size:16px">这一段字号略大，但仍是正文说明。</p><p>1.点击添加模型</p><p>第一步：完成注册，再继续操作。</p><p>第二步：检查输入，然后确认。</p><blockquote><p style="font-size:24px">引用中的排版</p></blockquote><pre><code>第一步：代码示例</code></pre><figure><figcaption><p style="font-size:24px">图片说明</p></figcaption></figure><h4>原有四级标题</h4>';
  const result=read("wechat",doc);expect(result.ok).toBe(true);
  expect(result.clip.markdown.match(/^#{1,6} .+$/gm)).toEqual(['#### 原有四级标题']);
  expect(result.clip.markdown).toContain('**这是一段完整加粗的正文。**');
  for(const text of ['1.点击添加模型','第一步：完成注册','第二步：检查输入','引用中的排版','第一步：代码示例','图片说明']) expect(result.clip.markdown).toContain(text);
});

test("WeChat preserves distinct typography levels and leaves a lone step label as prose",()=>{
  const doc=fixture("wechat"),body=doc.querySelector("#js_content");
  body.innerHTML='<p style="font-size:14px">这里是文章正文，说明各个章节的内容与操作，普通段落保持原样。</p><p style="font-size:24px">主要章节</p><p style="font-size:15pt">章节下的主题</p><p>第一步：只有一条的操作说明</p><h4>已有小节</h4>';
  const result=read("wechat",doc);expect(result.ok).toBe(true);
  expect(result.clip.markdown.match(/^#{1,6} .+$/gm)).toEqual(['## 主要章节','### 章节下的主题','#### 已有小节']);
  expect(result.clip.markdown).toContain('\n\n第一步：只有一条的操作说明');
});

test("optional article metadata does not reject readable content; hidden metadata remains absent",()=>{
  for(const name of ["wechat","sspai","juejin"]) {
    const doc=fixture(name); for(const n of Array.from(doc.querySelectorAll('meta,link,#js_name,#js_author_name,.article__header__author,.author-info-block'))) n.remove();
    expect(read(name,doc).ok).toBe(true);
  }
  const doc=fixture("wechat");doc.querySelector("#js_author_name").setAttribute("hidden","");
  expect(read("wechat",doc).clip.author).toBeUndefined();
});

test("Juejin code language, indentation and literal fence content survive UI cleanup",()=>{
  const result=read("juejin");
  expect(result.clip.markdown).toContain("```javascript\nlet readFile = (path, callBack) => {");
  expect(result.clip.markdown).toContain("  setTimeout(function () {");
  expect(result.clip.markdown).not.toContain("复制代码");
  expect(result.clip.publishedAt).toEqual({value:"2021-06-10T06:41:24.000Z",precision:"datetime"});
});

test("Juejin's comparison table retains every header, row, cell and inline link in the editor document",()=>{
  const source=fixture('juejin'),result=read('juejin',source);
  expect(result.ok).toBe(true);
  const tables=markdownToDoc(result.clip.markdown).content.filter(node=>node.type==='table');
  expect(tables).toHaveLength(1);
  const text=node=>node.text || (node.content || []).map(text).join('');
  expect(tables[0].content.map(row=>row.content.map(text))).toEqual(Array.from(source.querySelector('table').rows).map(row=>Array.from(row.cells).map(cell=>cell.textContent.trim())));
  expect(tables[0].content[0].content.map(cell=>cell.type)).toEqual(['tableHeader','tableHeader','tableHeader']);
  expect(JSON.stringify(tables[0])).toContain(new URL(source.querySelector('table a').getAttribute('href')).href);
});

test("known article identity conflicts and hidden article bodies never become whole-page captures",()=>{
  for(const [name,selector] of [["wechat","#js_content"],["sspai",".article__main__content"],["juejin",".article-viewer"]]) {
    const doc=fixture(name);doc.querySelector(selector).setAttribute("hidden","");expect(read(name,doc)).toEqual({ok:false,reason:"unreadable"});
    const wrong=fixture(name); const declared=wrong.querySelector('link[rel="canonical"],meta[property="og:url"]');declared.setAttribute(declared.tagName==='META'?'content':'href',urls[name]+"/extra");expect(read(name,wrong)).toEqual({ok:false,reason:"changed"});
  }
});

test("Jike uses the public original picture URL, retaining nine ordered images and a complete long post",()=>{
  expect(read("jike").clip.markdown).toContain("/meta-keep-list/");
  expect(read("jike").clip.markdown).not.toContain("thumbnail/");
  const grid=read("jike-grid"); expect([...grid.clip.markdown.matchAll(/!\[/g)]).toHaveLength(9);
  const long=read("jike-long");expect(long.ok).toBe(true);expect(long.clip.markdown).toContain("《世界尽头的咖啡馆》和《斯坦福大学人生设计课》");
  expect(long.clip.markdown).not.toContain("?s=");
});

test("Jike missing media, truncated text or stale post metadata fail before saving",()=>{
  const doc=fixture("jike-grid");doc.querySelector(".image-item").remove();expect(read("jike-grid",doc)).toEqual({ok:false,reason:"incomplete"});
  const short=fixture("jike-long");short.querySelector(".text").textContent="我在即刻写东西";expect(read("jike-long",short)).toEqual({ok:false,reason:"incomplete"});
  const wrong=fixture("jike");const state=wrong.querySelector("#__NEXT_DATA__"),data=JSON.parse(state.textContent);data.props.pageProps.post.id="6715e824d9dc81724c2ec74d";state.textContent=JSON.stringify(data);expect(read("jike",wrong)).toEqual({ok:false,reason:"changed"});
});

test("Douban reviews and diary exclude controls and do not label edit time as original publication",()=>{
  expect(read("douban-book").clip.markdown).not.toContain("来自豆瓣App");
  expect(read("douban-book").clip.markdown).not.toContain("有关键情节透露");
  expect(read("douban-book").clip.publishedAt).toBeUndefined();
  expect(read("douban-note").clip.publishedAt).toEqual({value:"2021-10-14T22:06:17",precision:"datetime"});
});

test("Douban book review retains its seven displayed paragraphs and all six image positions",()=>{
  const doc=fixture('douban-book'),original=doc.body.outerHTML,result=read('douban-book',doc);
  const text=node=>node.text || (node.content || []).map(text).join('');
  const expected=Array.from(doc.querySelectorAll('.review-content p')).flatMap(p=>p.textContent.split(/\n\s*\n/));
  const paragraphs=markdownToDoc(result.clip.markdown).content.filter(node=>node.type==='paragraph').map(text);
  expect(expected).toHaveLength(7);expect(paragraphs.slice(1)).toEqual(expected);
  expect(result.clip.markdown).toContain('\n\n在路上，我遇到了瓦尔泽');
  expect(result.clip.markdown).toContain('\n\n有人说，他写的是西方的散文');
  expect(result.clip.markdown.match(/!\[/g)).toHaveLength(6);
  expect(result.clip.markdown.indexOf('p11097735.webp')).toBeGreaterThan(result.clip.markdown.indexOf('在路上'));
  expect(result.clip.markdown.indexOf('p11097735.webp')).toBeLessThan(result.clip.markdown.indexOf('《散步》是'));
  expect(doc.body.outerHTML).toBe(original);
});

test("Douban paragraph breaks preserve nested emphasis, links and literal code without splitting code's own blank lines",()=>{
  const doc=fixture('douban-book');
  doc.querySelector('.review-content').innerHTML='<p>首段<strong>加粗\n\n仍然加粗<a href="https://example.test/source">链接</a></strong>第二段\n\n末段<code>alpha\n\nbeta</code></p>';
  const result=read('douban-book',doc);
  expect(result.clip.markdown).toContain('首段**加粗**\n\n**仍然加粗[链接](https://example.test/source)**第二段\n\n末段');
  expect(result.clip.markdown).toContain('`alpha beta`');
});

test("Douban music review preserves each displayed single newline as a hard break",()=>{
  const doc=fixture('douban-music'),original=doc.body.outerHTML,result=read('douban-music',doc);
  const expected=doc.querySelector('.review-content p').textContent;
  const lines=expected.split(/\r?\n/);
  expect(lines.length).toBeGreaterThan(3);
  const text=node=>node.text || (node.content || []).map(child=>child.type==='hardBreak'?'\n':text(child)).join('');
  const paragraph=markdownToDoc(result.clip.markdown).content.find(node=>node.type==='paragraph' && text(node).startsWith(lines[0]));
  expect(text(paragraph)).toBe(lines.map(line=>line.trim()).join('\n'));
  expect(paragraph.content.filter(node=>node.type==='hardBreak')).toHaveLength(lines.length-1);
  expect(result.clip.markdown.match(/!\[/g)).toHaveLength(3);
  expect(doc.body.outerHTML).toBe(original);
});

test("Douban short comments bind to the chosen own permalink and do not capture neighbouring comments",()=>{
  const doc=fixture("douban-comments"),page="https://book.douban.com/subject/36864764/comments/",card=doc.querySelector(".comment-item");
  const target=doubanCommentTarget(card,page);expect(target.url).toBe("https://book.douban.com/comment/4237804504/");
  expect(platformTarget(page)).toBeNull();expect(socialPlatform(page)).toBe("douban");
  const result=readDouban(doc,target,page);expect(result.ok).toBe(true);expect(result.clip.title).toBe("散步 · 就绪雀");
  expect(result.clip.markdown).toContain("有很多没必要写的句子");expect(result.clip.markdown).not.toContain("翻译的存在感太明显了");
  card.querySelector('.comment-time').setAttribute('href','/comment/4259416906/');expect(doubanCommentTarget(card,page)).toBeNull();
});


test("Jike declared content cannot lose its entire text or links, and media cannot be replaced by duplicates",()=>{
  for(const mode of ["remove","hidden"]){const doc=fixture("jike-grid"),text=doc.querySelector('.text');if(mode==="remove")text.remove();else text.setAttribute('hidden','');expect(read("jike-grid",doc)).toEqual({ok:false,reason:"incomplete"});}
  const links=fixture("jike-long");for(const link of Array.from(links.querySelectorAll('.text a[href]')))link.remove();expect(read("jike-long",links)).toEqual({ok:false,reason:"incomplete"});
  const wrong=fixture("jike-long");wrong.querySelector('.text a[href]').setAttribute('href','https://m.okjike.com/originalPosts/6715e824d9dc81724c2ec74d');expect(read("jike-long",wrong)).toEqual({ok:false,reason:"incomplete"});
  const images=fixture("jike-grid"),first=images.querySelector('.image-item img').getAttribute('src');for(const img of Array.from(images.querySelectorAll('.image-item img')))img.setAttribute('src',first);expect(read("jike-grid",images)).toEqual({ok:false,reason:"incomplete"});
});

test("hidden visual date and rating fields are omitted while optional short-comment time does not gate text",()=>{
  const doc=fixture("douban-book");doc.querySelector('.main-meta').textContent='';const time=doc.createElement('span');time.setAttribute('content','2024-07-31');time.setAttribute('hidden','');time.textContent='2024-07-31 17:37:35';doc.querySelector('.main-meta').appendChild(time);
  const rating=doc.querySelector('.main-title-rating');rating.setAttribute('title','HIDDEN RATING');rating.setAttribute('hidden','');const result=read('douban-book',doc);expect(result.clip.publishedAt).toBeUndefined();expect(result.clip.markdown).not.toContain('HIDDEN RATING');
  for(const action of ['remove','href']){const list=fixture('douban-comments'),card=list.querySelector('.comment-item'),time=card.querySelector('.comment-time');if(action==='remove')time.remove();else time.removeAttribute('href');const target=doubanCommentTarget(card,'https://book.douban.com/subject/36864764/comments/');const saved=readDouban(list,target,'https://book.douban.com/subject/36864764/comments/');expect(saved.ok).toBe(true);expect(saved.clip.markdown).toContain('/subject/36864764/comments/#c-4237804504');}
});

const jikeFeedUrl='https://m.okjike.com/topics/63579abb6724cc583b9bba9a';
test('Jike topic feed binds each real card by its own author/text and keeps only that post',async()=>{
 const {jikeCardTarget}=await import('./src/jike-clip.ts');const d=fixture('jike-feed'),cards=Array.from(d.querySelectorAll('.post-item-li'));
 const first=jikeCardTarget(cards[0],jikeFeedUrl),second=jikeCardTarget(cards[1],jikeFeedUrl);
 expect(first.id).toBe('6aceee92141b85b292eb4e27');expect(second.id).toBe('6ace942f756bbb66581c3f96');
 const firstRead=readJike(d,jikeFeedUrl,first);expect(firstRead.ok).toBe(true);expect(firstRead.clip.markdown).toContain('42章经');expect(firstRead.clip.markdown).toContain('世界第一');expect(firstRead.clip.markdown).not.toContain('JimHuiHui');
 const r=readJike(d,jikeFeedUrl,second);expect(r.ok).toBe(true);expect(r.clip.author).toBe('JimHuiHui');expect(r.clip.markdown).toContain('护城河');expect(r.clip.markdown).not.toContain('Ambi');expect(r.clip.tags).toEqual(['web-clip','jike']);expect(r.clip.markdown.match(/!\[/g)).toHaveLength(1);
 const s=d.querySelector('script'),v=JSON.parse(s.textContent);v.props.pageProps.posts.reverse();s.textContent=JSON.stringify(v);
 expect(jikeCardTarget(cards[1],jikeFeedUrl)).toEqual(second);
 v.props.pageProps.posts.push({...v.props.pageProps.posts[0],id:'6715e824d9dc81724c2ec74d'});s.textContent=JSON.stringify(v);
 expect(jikeCardTarget(cards[1],jikeFeedUrl)).toBeNull();
});
test('Jike topic cards never derive a target from body references, changed authors or hidden content',async()=>{
 const {jikeCardTarget}=await import('./src/jike-clip.ts');
 for(const change of [card=>card.querySelector('.avatar').setAttribute('href','/users/other'),card=>card.querySelector('.avatar').setAttribute('href','https://unrelated.example'+card.querySelector('.avatar').getAttribute('href')),card=>card.querySelector('.text').textContent='Different post',card=>card.style.display='none',card=>card.querySelector('.image-item').remove()]) {
  const d=fixture('jike-feed'),card=d.querySelectorAll('.post-item-li')[1];change(card);expect(jikeCardTarget(card,jikeFeedUrl)).toBeNull();
 }
});
test('the compiled Jike pointer listener marks only the card under the context-menu event',async()=>{
 const {createWindow}=await import('@mixmark-io/domino'),{runInNewContext}=await import('node:vm'),{bundleTestScripts}=await import('./bundle-test-scripts.mjs');
 const w=createWindow(readFileSync(new URL('./fixtures/platforms/jike-feed.html',import.meta.url),'utf8'),jikeFeedUrl);
 runInNewContext(bundleTestScripts(['social-target'])[0],{document:w.document,location:w.location,URL,Element:w.Element,Node:w.Node});
 const cards=w.document.querySelectorAll('.post-item-li'),event=w.document.createEvent('Event');event.initEvent('contextmenu',true,true);cards[1].querySelector('.text').dispatchEvent(event);
 expect(w.document.querySelectorAll('[data-edgeever-social-target]')).toHaveLength(1);expect(cards[1].getAttribute('data-edgeever-social-target')).toBe('https://m.okjike.com/originalPosts/6ace942f756bbb66581c3f96');
 cards[0].querySelector('.text').dispatchEvent(event);expect(cards[1].hasAttribute('data-edgeever-social-target')).toBe(false);
});

test('article metadata retains source date precision and normalized own headlines',async()=>{
 const {mediumContent}=await import('./src/medium-content.ts'),{substackContent}=await import('./src/substack-content.ts');
 const medium=fixture('medium-article');medium.querySelector('script').remove();expect(mediumContent(medium,'https://scottbatson.dev/what-should-programmers-do-while-the-ai-writes-code-a2ce2e6de88e').publishedAt).toEqual({value:'2026-08-31',precision:'date'});
 const d=fixture('substack-article'),s=d.querySelector('script'),v=JSON.parse(s.textContent);v.headline='The  Dot and the Swarm';d.querySelector('h1').textContent=v.headline;s.textContent=JSON.stringify(v);
 expect(substackContent(d,'https://www.oneusefulthing.org/p/the-dot-and-the-swarm').author).toBe('Ethan Mollick');
});
test('only a visible real Substack paywall blocks whole-article extraction',async()=>{
 const {substackContent}=await import('./src/substack-content.ts'),{substackPaywall}=await import('./src/article-platform.ts'),d=fixture('substack-paywall'),url='https://www.lennysnewsletter.com/p/how-to-build-ai-product-sense';
 expect(substackPaywall(d)).toBe(true);expect(substackContent(d,url)).toBeNull();d.querySelector('.paywall').style.display='none';expect(substackPaywall(d)).toBe(false);expect(substackContent(d,url)).not.toBeNull();
});

test('Substack paywall text follows descendant visibility in the serialized probe',async()=>{
 const {substackContent}=await import('./src/substack-content.ts'),{substackPaywall}=await import('./src/article-platform.ts');
 const url='https://www.lennysnewsletter.com/p/how-to-build-ai-product-sense';
 for(const wrapper of ['hidden','aria-hidden="true"','style="display:none"','style="visibility:hidden"']) {
  const d=fixture('substack-paywall'),gate=d.querySelector('.paywall');gate.innerHTML=`<div ${wrapper}>${gate.innerHTML}</div>`;
  expect(substackPaywall(d)).toBe(false);expect(substackContent(d,url)).not.toBeNull();
 }
 const d=fixture('substack-paywall'),gate=d.querySelector('.paywall');
 gate.style.visibility='hidden';gate.innerHTML=`<div style="visibility:visible">${gate.innerHTML}</div>`;
 expect(substackPaywall(d)).toBe(true);expect(substackContent(d,url)).toBeNull();
 // executeScript serializes the probe without its module's closure.
 const {runInNewContext}=await import('node:vm');
 expect(runInNewContext(`(${substackPaywall.toString()})(document)`,{document:d})).toBe(true);
});

test('Jike clickable image controls retain every confirmed original image',()=>{
 for(const tag of ['div','button','img']) {
  const d=fixture('jike-grid');
  for(const node of Array.from(d.querySelectorAll('.image-item'))) {
   node.setAttribute('role','button');
   if(tag==='button') {const button=d.createElement('button');node.replaceWith(button);button.appendChild(node);}
   if(tag==='img') node.querySelector('img').setAttribute('role','button');
  }
  const r=read('jike-grid',d);
  expect(r.ok).toBe(true);expect(r.clip.markdown.match(/!\[/g)).toHaveLength(9);
  const originals=JSON.parse(d.querySelector('#__NEXT_DATA__').textContent).props.pageProps.post.pictures.map(p=>p.picUrl);
  for(const url of originals) expect(r.clip.markdown).toContain(url);
 }
});

test('article metadata retains a visible relative publication value when no machine date exists',async()=>{
 const {mediumContent}=await import('./src/medium-content.ts'),d=fixture('medium-article');d.querySelector('script').remove();d.querySelector('[data-testid="storyPublishDate"]').textContent='2 days ago';
 expect(mediumContent(d,'https://scottbatson.dev/what-should-programmers-do-while-the-ai-writes-code-a2ce2e6de88e').publishedAt).toEqual({value:'2 days ago',precision:'relative'});
});
