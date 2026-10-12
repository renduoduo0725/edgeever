import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

test.use({ channel: "chromium" });

const extensionRoot = fileURLToPath(new URL("../../apps/extension/", import.meta.url));
const fixture = readFileSync(new URL("../../apps/extension/fixtures/platforms/xiaoyuzhou.html", import.meta.url), "utf8");
const readers = (await build({
  stdin: {
    contents: 'import { readXiaoyuzhou } from "./src/xiaoyuzhou-clip"; globalThis.clipReaders = { readXiaoyuzhou };',
    resolveDir: extensionRoot, sourcefile: "html-safety.ts",
  },
  bundle: true, platform: "browser", format: "iife", write: false,
})).outputFiles[0].text;

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await page.addScriptTag({ content: readers });
});

test("Show Notes validation does not execute markup or request embedded resources", async ({ page }) => {
  const requests: string[] = [];
  await page.route("https://clip-probe.test/**", async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
  const result = await page.evaluate((html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelector(".sn-content article")!.innerHTML = "<p>Visible Show Notes</p>";
    const stateNode = doc.querySelector("#__NEXT_DATA__")!;
    const state = JSON.parse(stateNode.textContent!);
    state.props.pageProps.episode.shownotes = '<p>Visible Show Notes</p></template>'
      + '<script>globalThis.probeExecutions++</script>'
      + '<img hidden src="https://clip-probe.test/image" onerror="globalThis.probeExecutions++">'
      + '<iframe src="https://clip-probe.test/frame"></iframe>'
      + '<audio autoplay src="https://clip-probe.test/audio"></audio>'
      + '<video autoplay src="https://clip-probe.test/video"></video>'
      + '<svg onload="globalThis.probeExecutions++"></svg>';
    stateNode.textContent = JSON.stringify(state);
    (window as any).probeExecutions = 0;
    // The validator must use its own parser, not another browser HTML sink.
    const innerHTML = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML")!;
    const NativeParser = window.DOMParser;
    Object.defineProperty(Element.prototype, "innerHTML", { ...innerHTML, set() { throw new Error("Unexpected browser HTML assignment"); } });
    (window as any).DOMParser = class { constructor() { throw new Error("Unexpected browser HTML parser"); } };
    try {
      return (window as any).clipReaders.readXiaoyuzhou(doc,
        "https://www.xiaoyuzhoufm.com/episode/62ad4ae5f9b62781ea058a02",
        { podcast: "Podcast", noShowNotes: "No Show Notes" });
    } finally {
      Object.defineProperty(Element.prototype, "innerHTML", innerHTML);
      window.DOMParser = NativeParser;
    }
  }, fixture);
  expect(result.ok).toBe(true);
  expect(result.clip.markdown).toContain("Visible Show Notes");
  expect(result.clip.markdown).not.toContain("clip-probe.test");
  // A live control proves that request and event monitoring are functioning.
  await page.evaluate(() => new Promise<void>((resolve) => {
    const image = document.createElement("img");
    image.onerror = () => { (window as any).probeExecutions++; resolve(); };
    image.src = "https://clip-probe.test/control";
    document.body.appendChild(image);
  }));
  expect(requests).toEqual(["https://clip-probe.test/control"]);
  expect(await page.evaluate(() => (window as any).probeExecutions)).toBe(1);
});
