import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Script, createContext, runInContext } from "node:vm";
import { createWindow, createDocument } from "@mixmark-io/domino";
import { bundleTestScripts } from "./bundle-test-scripts.mjs";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

test('Medium page capture retains story blocks and both images without article controls',async()=>{
  const html=await readFile(new URL('./fixtures/platforms/medium-article.html',import.meta.url),'utf8');
  const url='https://medium.com/@scott.batson_76410/what-should-programmers-do-while-the-ai-writes-code-a2ce2e6de88e';
  const [source]=bundleTestScripts(["capture"]);
  const capture=(body,selection=false,sourceUrl=url)=>{
    const w=createWindow(body,sourceUrl);let page;
    w.DOMParser=class { parseFromString(value){return createDocument(value);} };
    w.getSelection=()=>selection?{rangeCount:1,toString:()=> 'Selected paragraph',getRangeAt:()=>({cloneContents:()=>{const f=w.document.createDocumentFragment(),p=w.document.createElement('p');p.textContent='Selected paragraph';f.appendChild(p);return f;}})}:null;
    const context=createContext({window:w,document:w.document,location:w.location,URL,chrome:{i18n:{getMessage:k=>k},runtime:{sendMessage:m=>{page=m.page;}}}});
    runInContext(source,context);return page;
  };
  const page=capture(html);expect(page.title).toBe('What Should Programmers Do While the AI Writes Code?');
  expect(page.markdown).toContain('Most every programmer');expect(page.markdown).toContain('10 times as meaningful');
  expect(page.markdown).toContain('## Slow work');expect(page.markdown).toContain('## Writing');
  expect(page.markdown).toContain('Photo by me');expect(page.markdown.match(/!\[/g)).toHaveLength(2);
  for(const noise of ['Top highlight','Member-only story','Follow','8.3K','Press enter or click'])expect(page.markdown).not.toContain(noise);
  expect(capture(html,true).markdown).toBe('Selected paragraph');
  const custom=capture(html,false,'https://scottbatson.dev/what-should-programmers-do-while-the-ai-writes-code-a2ce2e6de88e');
  expect(custom.markdown).toBe(page.markdown);expect(custom.title).toBe(page.title);
  for(const attribute of ['hidden','aria-hidden="true"']) {
    const hidden=html.replace('<article',`<article ${attribute}`);
    expect(capture(hidden)).toEqual({error:'unreadable'});
    expect(capture(hidden,true).markdown).toBe('Selected paragraph');
  }
  const unsafe=html.replace('</article>','<p data-selectable-paragraph><a href="javascript:alert(1)">Unsafe</a></p></article>');
  expect(capture(unsafe).markdown).not.toContain('javascript:');
});

test('Substack article capture retains sections and images on custom domains without subscription UI',async()=>{
  const html=await readFile(new URL('./fixtures/platforms/substack-article.html',import.meta.url),'utf8');
  const [source]=bundleTestScripts(["capture"]);
  const capture=(body,url,selection=false)=>{
    const w=createWindow(body,url);let page;
    w.DOMParser=class { parseFromString(value){return createDocument(value);} };
    w.getSelection=()=>selection?{rangeCount:1,toString:()=> 'Selected paragraph',getRangeAt:()=>({cloneContents:()=>{const f=w.document.createDocumentFragment(),p=w.document.createElement('p');p.textContent='Selected paragraph';f.appendChild(p);return f;}})}:null;
    runInContext(source,createContext({window:w,document:w.document,location:w.location,URL,chrome:{i18n:{getMessage:k=>k},runtime:{sendMessage:m=>{page=m.page;}}}}));return page;
  };
  const url='https://www.oneusefulthing.org/p/the-dot-and-the-swarm';
  const page=capture(html,url);
  expect(page.title).toBe('The Dot and the Swarm');
  for(const content of ['Benefitting from the Bitter Lesson','Nope.','# Dots and Muse','# Swarms','# A Not-Entirely-Bitter Lesson','very cool pre-order bonus'])expect(page.markdown).toContain(content);
  expect(page.markdown.match(/!\[/g)).toHaveLength(3);
  for(const noise of ['Subscribe','Share','Comments and recommendations','One Useful Thing'])expect(page.markdown).not.toContain(noise);
  expect(capture(html,url,true).markdown).toBe('Selected paragraph');
  expect(capture(html,'https://oneusefulthing.substack.com/p/the-dot-and-the-swarm').markdown).toBe(page.markdown);
  const preview=html.replace('Nope.','Visible paid preview.');
  expect(capture(preview,url).markdown).toContain('Visible paid preview.');
  for(const attribute of ['hidden','aria-hidden="true"']) {
    const d=createDocument(html);d.querySelector('.body.markup').setAttribute(attribute.split('=')[0],attribute==='hidden'?'':'true');
    expect(capture(d.documentElement.outerHTML,url)).toEqual({error:'unreadable'});
    expect(capture(d.documentElement.outerHTML,url,true).markdown).toBe('Selected paragraph');
  }
});

test("the injected page capture is a standalone classic script", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "edgeever-capture-"));
  try {
    await execFileAsync(process.execPath, [
      fileURLToPath(new URL("../../node_modules/vite/bin/vite.js", import.meta.url)),
      "build",
      "--config",
      fileURLToPath(new URL("./vite.config.ts", import.meta.url)),
      "--outDir",
      outDir,
      "--logLevel",
      "silent",
    ]);

    const capture = await readFile(join(outDir, "assets/capture.js"), "utf8");
    expect(() => new Script(capture)).not.toThrow();
    expect(capture).toContain("capturedPage");
    const platform = await readFile(join(outDir, "assets/capture-platform.js"), "utf8");
    expect(() => new Script(platform)).not.toThrow();
    expect(platform).toContain("pagePlatformRead");
    const feedback = await readFile(join(outDir, "assets/clip-feedback.js"), "utf8");
    expect(() => new Script(feedback)).not.toThrow();
    expect(feedback).toContain("data-sonner-toaster");
    // UI dependencies belong only to the feedback bundle, never image reading.
    const image = await readFile(join(outDir, "assets/capture-image.js"), "utf8");
    expect(() => new Script(image)).not.toThrow();
    expect(image).not.toContain("data-sonner-toaster");
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
