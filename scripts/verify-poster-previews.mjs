// Run against `bun run dev`. Installed Chrome, isolated fixture, no note APIs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const origin = process.env.EDGE_EVER_BROWSER_TEST_URL ?? "http://127.0.0.1:5173";
const fixture = `${origin}/@fs${process.cwd()}/tests/browser/poster-previews.html`;
const manifest = JSON.parse(await readFile(new URL("../apps/web/src/assets/poster-template-previews/manifest.json", import.meta.url)));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const firstReady = page => page.waitForFunction(() => {
  const cards = [...document.querySelectorAll("[data-poster-template]")].slice(0, 6);
  return cards.length === 6 && cards.every(card => card.querySelector("img")?.naturalWidth > 0);
}, null, { timeout: 10_000 });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.addInitScript(() => {
    window.canvasAttempts = 0;
    const forbidden = () => { window.canvasAttempts++; throw new Error("Gallery tried to render a canvas"); };
    HTMLCanvasElement.prototype.getContext = forbidden;
    HTMLCanvasElement.prototype.toBlob = forbidden;
    URL.createObjectURL = forbidden;
  });
  const fontRequests = [];
  await page.route("**/*", route => {
    if (["font", "xhr"].includes(route.request().resourceType())) {
      fontRequests.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(fixture);
  await page.waitForFunction(() => window.posterPreviewTest);
  await firstReady(page);
  const firstSources = await page.locator('[data-poster-template] img').evaluateAll(images => images.map(image => image.getAttribute('src')));
  assert(firstSources.every(source => source.includes('.zh.webp') && !source.startsWith('blob:')));
  assert.equal(await page.getByText('载入版式…', { exact: true }).count(), 0);
  await page.screenshot({ path: "/tmp/edgeever-static-poster-previews.png" });
  console.log("PASS: visible static previews load with canvas disabled and fonts blocked");

  await page.getByRole('button', { name: 'All templates', exact: true }).click();
  assert.equal(await page.locator('[data-poster-template]').count(), manifest.templates.length);
  // Scroll each real card into view so lazy image loading is exercised too.
  for (const template of manifest.templates) {
    const image = page.locator(`[data-poster-template="${template.id}"] img`);
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(image => image.decode());
  }
  console.log(`PASS: all ${manifest.templates.length} Chinese thumbnails decode`);

  await page.evaluate(() => window.posterPreviewTest.mount(false));
  await firstReady(page);
  for (const template of manifest.templates) {
    const image = page.locator(`[data-poster-template="${template.id}"] img`);
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(image => image.decode());
    assert((await image.getAttribute('src')).includes('.en.webp'));
  }
  console.log(`PASS: all ${manifest.templates.length} English thumbnails decode`);

  const selected = page.locator('[data-poster-template="folio"]');
  await selected.focus();
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => window.posterPreviewTest.applied), ['folio']);
  await page.getByRole('textbox').fill('Minimal');
  assert.equal(await page.locator('[data-poster-template]').count(), 1);
  assert.equal(await page.locator('[data-poster-template]').getAttribute('data-poster-template'), 'minimal');
  console.log("PASS: search and keyboard template selection still work");

  await page.evaluate(() => window.posterPreviewTest.mount(true, undefined, false));
  await page.locator('[data-poster-template]').first().waitFor({ state: 'detached' });
  await page.evaluate(() => window.posterPreviewTest.mount(true, 'wechat'));
  await firstReady(page);
  assert.equal(await page.locator('[data-poster-template]').count(), manifest.templates.filter(template => template.recommended).length);
  assert.equal(await page.evaluate(() => window.canvasAttempts), 0);
  // CSS may request UI text fonts; none of the gallery's design fonts are loaded.
  assert.equal(fontRequests.filter(url => /poster-fonts|fontsource|jsdelivr|fonts\.googleapis/.test(url)).length, 0);
  assert.deepEqual(errors, []);
  console.log("PASS: reopening/platform changes use static images; zero canvas renders or design-font requests");
} finally {
  await browser.close();
}
