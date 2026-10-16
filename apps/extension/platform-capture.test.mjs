import { expect, test } from "bun:test";
import { markdownToDoc } from "../../packages/shared/src/content.ts";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { bundleTestScripts } from "./bundle-test-scripts.mjs";
import { createWindow } from "@mixmark-io/domino";

const [bundle] = bundleTestScripts(["capture-platform"]);
const xUrl = "https://www.xiaoyuzhoufm.com/episode/62ad4ae5f9b62781ea058a02";

const capture = async ({ fixture = "xiaoyuzhou", url = xUrl, expectedUrl = url, sourceUrl = expectedUrl, selectionFirst = false, prepare, detailLoad } = {}) => {
  const window = createWindow(readFileSync(new URL(`./fixtures/platforms/${fixture}.html`, import.meta.url), "utf8"), url);
  const doc = window.document;
  const location = { href: url };
  let notify = () => {};
  const calls = { messages: [], clicks: 0, disconnected: false, details: [] };
  prepare?.({ doc, window, location, changed: () => notify() });
  const append=doc.body.appendChild.bind(doc.body);
  Object.defineProperty(doc.body,'appendChild',{value:node=>{
    const value=append(node);
    if(node.tagName==='IFRAME') {
      calls.details.push(node);
      queueMicrotask(()=>{
        const detail=detailLoad?.(node);
        if(detail) {Object.defineProperty(node,'contentDocument',{value:detail});node.onload();}
      });
    }
    return value;
  }});
  const expand = doc.querySelector(".expand");
  expand?.addEventListener("click", () => { calls.clicks += 1; });
  let done;
  const result = new Promise((resolve) => { done = resolve; });
  runInNewContext(bundle, {
    window, document: doc, location, URL,
    __edgeeverPlatformClipPayload: { requestId: "capture-1", url: expectedUrl, sourceUrl, selectionFirst },
    setTimeout: (callback) => setTimeout(callback, 30), clearTimeout, setInterval, clearInterval,
    MutationObserver: class {
      constructor(callback) { notify = callback; }
      observe() {}
      disconnect() { calls.disconnected = true; }
    },
    chrome: {
      i18n: { getMessage: (key) => key },
      runtime: { sendMessage: (message) => { calls.messages.push(message); done(message.result); return Promise.resolve(); } },
    },
    AbortSignal,
    fetch: () => { throw new Error("Unexpected page or media fetch"); },
  });
  return { result: await result, calls };
};

test("the real page's fully loaded Show Notes do not need an expansion click", async () => {
  const { result, calls } = await capture();
  expect(result.ok).toBe(true);
  expect(result.clip.markdown).toContain("韦礼安");
  expect(calls.clicks).toBe(0);
  expect(calls.messages).toHaveLength(1);
  expect(calls.messages[0].requestId).toBe("capture-1");
});

const publicDetail = (fixture, url) => createWindow(readFileSync(new URL(`./fixtures/platforms/${fixture}.html`,import.meta.url),'utf8'),url).document;

for(const [id,fixture,images] of [['6114376649/411862401','xueqiu-feed-detail',0],['2754211668/411841572','xueqiu-feed-detail-second',1]]) test(`Xueqiu feed reads only selected ${id} through its script-disabled same-origin detail`,async()=>{
  const url='https://www.xueqiu.com/',expectedUrl='https://xueqiu.com/'+id;
  const original=publicDetail(fixture,'https://www.xueqiu.com/'+id);
  const finalParagraph=Array.from(original.querySelectorAll('.article__bd__detail p')).at(-1).textContent.trim().slice(-36);
  const {result,calls}=await capture({fixture:'xueqiu-feed',url,sourceUrl:url,expectedUrl,detailLoad:frame=>{
    expect(frame.src).toBe('https://www.xueqiu.com/'+id);expect(frame.getAttribute('sandbox')).toBe('allow-same-origin');
    return original;
  }});
  expect(result.ok).toBe(true);expect(result.clip.url).toBe(expectedUrl);expect(result.clip.markdown).toContain(images ? '把自己的真金白银押在别人的嘴上，早晚是要付出代价的。' : finalParagraph);
  expect(result.clip.markdown.match(/!\[/g) || []).toHaveLength(images);expect(calls.details).toHaveLength(1);
  expect(calls.details[0].isConnected).toBe(false);expect(calls.messages).toHaveLength(1);
});

for(const failure of ['challenge','wrong-url','load-error','timeout','navigation','recycled-card','hidden-card','body-reference']) test(`Xueqiu feed ${failure} cannot archive a preview or another post`,async()=>{
  const url='https://www.xueqiu.com/',id='6114376649/411862401',expectedUrl='https://xueqiu.com/'+id;
  let prepared;
  const {result,calls}=await capture({fixture:'xueqiu-feed',url,sourceUrl:url,expectedUrl,prepare:state=>{
    prepared=state;
    if(failure==='hidden-card')state.doc.querySelector('[class*="timeline__item__main_"]').style.display='none';
    if(failure==='body-reference')state.doc.querySelectorAll('a[class*="date-and-source_"]').forEach(a=>a.remove());
  },detailLoad:frame=>{
    if(failure==='load-error'){frame.onerror();return;}
    if(failure==='timeout')return;
    if(failure==='navigation')prepared.location.href='https://www.xueqiu.com/S/SH600438';
    if(failure==='recycled-card')prepared.doc.querySelectorAll('a[class*="date-and-source_"]').forEach(a=>a.setAttribute('href','/2754211668/411841572'));
    if(failure==='challenge')return createWindow('<html><body>Site verification</body></html>','https://www.xueqiu.com/'+id).document;
    return publicDetail('xueqiu-feed-detail',failure==='wrong-url'?'https://www.xueqiu.com/2754211668/411841572':'https://www.xueqiu.com/'+id);
  }});
  expect(result.ok).toBe(false);expect(result.clip).toBeUndefined();expect(calls.messages).toHaveLength(1);
  expect(calls.details).toHaveLength(['hidden-card','body-reference'].includes(failure)?0:1);
  for(const frame of calls.details)expect(frame.isConnected).toBe(false);
});

test('explicit Xueqiu feed selection precedes the public detail request',async()=>{
 const url='https://www.xueqiu.com/';
 const {result,calls}=await capture({fixture:'xueqiu-feed',url,sourceUrl:url,expectedUrl:'https://xueqiu.com/6114376649/411862401',selectionFirst:true,prepare:({doc,window})=>{
  window.getSelection=()=>({rangeCount:1,toString:()=> 'Selected preview text',getRangeAt:()=>({cloneContents:()=>{const fragment=doc.createDocumentFragment();fragment.appendChild(doc.createTextNode('Selected preview text'));return fragment;}})});
 }});
 expect(result.selection.markdown).toBe('Selected preview text');expect(calls.details).toHaveLength(0);
});

test("an incomplete DOM expands only the Show Notes control once and waits for complete text", async () => {
  const { result, calls } = await capture({ prepare: ({ doc, changed }) => {
    const notes = doc.querySelector(".sn-content article"); const full = notes.innerHTML;
    notes.innerHTML = "<p>preview</p>";
    doc.querySelector(".expand").addEventListener("click", () => { notes.innerHTML = full; changed(); });
  } });
  expect(result.ok).toBe(true);
  expect(result.clip.markdown).toContain("韦礼安");
  expect(calls.clicks).toBe(1);
  expect(calls.disconnected).toBe(true);
});

test("failed expansion is bounded and never returns the truncated text", async () => {
  const { result, calls } = await capture({ prepare: ({ doc }) => {
    doc.querySelector(".sn-content article").innerHTML = "<p>preview</p>";
  } });
  expect(result).toEqual({ ok: false, reason: "incomplete" });
  expect(calls.clicks).toBe(1);
  expect(calls.disconnected).toBe(true);
});

test("navigation during expansion rejects the old episode", async () => {
  const { result, calls } = await capture({ prepare: ({ doc, location, changed }) => {
    doc.querySelector(".sn-content article").innerHTML = "<p>preview</p>";
    doc.querySelector(".expand").addEventListener("click", () => { location.href = xUrl.replace(/02$/, "03"); changed(); });
  } });
  expect(result).toEqual({ ok: false, reason: "changed" });
  expect(calls.messages).toHaveLength(1);
});

test("toolbar selection wins over the platform article, while a page menu ignores the selection", async () => {
  const prepare = ({ doc, window }) => {
    window.getSelection = () => ({ rangeCount: 1, toString: () => "Selected passage", getRangeAt: () => ({ cloneContents: () => {
      const fragment = doc.createDocumentFragment();
      const p = doc.createElement("p"); p.textContent = "Selected passage"; fragment.appendChild(p); return fragment;
    } }) });
  };
  const toolbar = await capture({ selectionFirst: true, prepare });
  expect(toolbar.result.selection.markdown).toBe("Selected passage");
  expect(toolbar.result.clip).toBeUndefined();
  const menu = await capture({ selectionFirst: false, prepare });
  expect(menu.result.clip.markdown).toContain("韦礼安");
  expect(menu.result.selection).toBeUndefined();
});

test("an injection for another detail URL reports a page change without expansion", async () => {
  const { result, calls } = await capture({ expectedUrl: xUrl.replace(/02$/, "03") });
  expect(result).toEqual({ ok: false, reason: "changed" });
  expect(calls.clicks).toBe(0);
});

test("a text selection removed by HTML cleanup stays a selection as escaped plain text", async () => {
  const { result } = await capture({ selectionFirst: true, prepare: ({ doc, window }) => {
    window.getSelection = () => ({ rangeCount: 1, toString: () => "Only *this* text", getRangeAt: () => ({ cloneContents: () => {
      const fragment = doc.createDocumentFragment(); const button = doc.createElement("button");
      button.textContent = "Only *this* text"; fragment.appendChild(button); return fragment;
    } }) });
  } });
  const paragraph = markdownToDoc(result.selection.markdown).content[0];
  expect(paragraph.type).toBe("paragraph");
  expect(paragraph.content).toEqual([{ type: "text", text: "Only *this* text" }]);
  expect(result.clip).toBeUndefined();
});

test("Substack Note injection filters hidden CSS before checking complete content", async () => {
  const url="https://substack.com/@tedgioia/note/c-357811021";
  const {result,calls}=await capture({fixture:"substack-note",url,prepare:({doc})=>{
    doc.querySelector(".ProseMirror p").setAttribute("style","display:none");
  }});
  expect(result).toEqual({ok:false,reason:"incomplete"});
  expect(calls.messages).toHaveLength(1);
});


test("Jike long text expands through the actual injected bundle and retains link identities",async()=>{
  const {result,calls}=await capture({fixture:'jike-long',url:'https://m.okjike.com/originalPosts/64c9dd9a2edae6abdc610605',prepare:({doc,changed})=>{
    const body=doc.querySelector('.text'),full=body.innerHTML;body.innerHTML='<span>我在即刻写东西</span><button class="expand">展开全文</button>';
    body.querySelector('button').addEventListener('click',()=>{body.innerHTML=full;changed();});
  }});
  expect(result.ok).toBe(true);expect(result.clip.markdown).toContain('《世界尽头的咖啡馆》');expect(calls.clicks).toBe(1);expect(calls.disconnected).toBe(true);
});

for(const navigate of [false,true])test(`Jike expansion ${navigate?'navigation':'timeout'} refuses the partial post`,async()=>{
  const {result,calls}=await capture({fixture:'jike-long',url:'https://m.okjike.com/originalPosts/64c9dd9a2edae6abdc610605',prepare:({doc,location,changed})=>{
    const body=doc.querySelector('.text');body.innerHTML='<span>我在即刻写东西</span><button class="expand">展开全文</button>';
    if(navigate)body.querySelector('button').addEventListener('click',()=>{location.href='https://m.okjike.com/originalPosts/6715e824d9dc81724c2ec74d';changed();});
  }});
  expect(result).toEqual({ok:false,reason:navigate?'changed':'incomplete'});expect(calls.clicks).toBe(1);expect(calls.disconnected).toBe(true);
});
