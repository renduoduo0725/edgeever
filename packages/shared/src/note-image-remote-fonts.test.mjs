import { expect, test } from 'bun:test';
import 'fake-indexeddb/auto';
import { createRemoteFontResourceLoader, fontSubsetContains, prepareNoteImageAssets } from './note-image-fonts';
import { NOTE_IMAGE_REMOTE_FONTS, NOTE_IMAGE_RECOMMENDED_FONT_IDS, parseRemoteFontCss, remoteFontCssUrl, remoteOriginalFont } from './note-image-remote-fonts';
import { resolveNoteImagePreferences } from './note-image-preferences';
import { resolveNoteImageTypography } from './note-image-card';

const css = `/* metadata { } */ @font-face {font-family: 'Original'; src: local('Original'), url('./first.woff2') format('woff2'); font-weight: 400; unicode-range: U+4E00-4EFF;}
@font-face {src:url(./latin.woff2) format('woff2'),url(./latin.woff) format('woff');font-weight:400;unicode-range:U+20-7e;}
@font-face {src:url(https://unexpected.example/font.woff2);font-weight:400;unicode-range:U+5000;}`;

test('all downloadable fonts retain their choice and use a private family without loading files', async () => {
  for (const [font, metadata] of Object.entries(NOTE_IMAGE_REMOTE_FONTS)) {
    expect(resolveNoteImagePreferences({ fontStyle: font }).fontStyle).toBe(font);
    expect(resolveNoteImageTypography('book', font).bodyFamily).toContain(metadata.family);
    expect(remoteFontCssUrl(font)).toMatch(/@(?:\d+\.\d+\.\d+|[a-f0-9]{40})\//);
  }
  // Explicit system styles must not fetch any optional font manifest or file.
  expect((await prepareNoteImageAssets({ theme: 'book', fontStyle: 'sans', text: '中文', urls: {} })).fontCss).toBe('');
});

test('contains the entire five-font designer pack and keeps restricted fonts as original full files', () => {
  expect([...NOTE_IMAGE_RECOMMENDED_FONT_IDS]).toEqual(['puhui', 'puhui-heavy', 'youshe', 'shuhei', 'smiley']);
  for (const id of ['puhui', 'puhui-heavy', 'youshe', 'shuhei']) {
    const original = remoteOriginalFont(id);
    expect(original.asset).toEndWith('.ttf');
    expect(original.range).toBe('U+0-10FFFF');
    expect(NOTE_IMAGE_REMOTE_FONTS[id].bytes).toBeGreaterThan(1_000_000);
    expect(NOTE_IMAGE_REMOTE_FONTS[id].sha256).toMatch(/^[a-f0-9]{64}$/);
  }
  expect(remoteOriginalFont('smiley')).toBeUndefined();
});

test('parses WOFF2 only, preserves Unicode coverage, and rejects files outside the pinned directory', () => {
  const blocks = parseRemoteFontCss(css, 'smiley');
  expect(blocks).toHaveLength(2);
  expect(blocks[0].family).toBe(NOTE_IMAGE_REMOTE_FONTS.smiley.family);
  expect(blocks.filter(block => fontSubsetContains(block.range, new Set([0x4e2d])))).toHaveLength(1);
  expect(blocks[1].asset).toEndWith('/latin.woff2');
  expect(() => parseRemoteFontCss('<html>Unavailable</html>', 'smiley')).toThrow('NOTE_IMAGE_FONT_UNAVAILABLE');
});

const woff = () => {
  const data = new Uint8Array(64);
  data.set(new TextEncoder().encode('wOF2'));
  new DataView(data.buffer).setUint32(8, data.byteLength);
  return data.buffer;
};
const withNetwork = async (respond, run) => {
  const original = globalThis.XMLHttpRequest;
  const requests = [];
  globalThis.XMLHttpRequest = class {
    open(_method, url) { this.url = url; }
    send() {
      requests.push(this.url);
      queueMicrotask(() => {
        const response = respond(this.url);
        if (!response) { this.onerror(); return; }
        this.status = response.status ?? 200;
        this.response = response.data;
        this.onload();
      });
    }
  };
  try { await run(requests); } finally { globalThis.XMLHttpRequest = original; }
};

test('deduplicates downloads and persists manifests and subsets for a fresh offline session', async () => {
  const loader = createRemoteFontResourceLoader();
  const base = 'https://cdn.jsdelivr.net/npm/@edgeever/font-cache-test@1.0.0/';
  const urls = [base + 'font.woff2', base + 'result.css'];
  await withNetwork(url => ({ data: url.endsWith('.css') ? new TextEncoder().encode(css).buffer : woff() }), async requests => {
    await Promise.all([loader(urls[0]), loader(urls[0]), loader(urls[1], true)]);
    expect(requests).toHaveLength(2);
  });
  const restarted = createRemoteFontResourceLoader();
  await withNetwork(() => undefined, async requests => {
    expect(new TextDecoder().decode((await restarted(urls[0])).slice(0, 4))).toBe('wOF2');
    expect(new TextDecoder().decode(await restarted(urls[1], true))).toBe(css);
    expect(requests).toEqual([]);
  });
});

test('falls back to the second mirror, rejects non-font responses and permits retry after failure', async () => {
  const loader = createRemoteFontResourceLoader();
  const url = 'https://cdn.jsdelivr.net/npm/@edgeever/font-cache-test@1.0.0/retry.woff2';
  await withNetwork(() => ({ data: new TextEncoder().encode('<html>not a font</html>').buffer }), async requests => {
    await expect(loader(url)).rejects.toThrow('NOTE_IMAGE_FONT_UNAVAILABLE');
    expect(requests).toHaveLength(2);
  });
  await withNetwork(mirror => mirror.startsWith('https://unpkg.com/') ? { data: woff() } : undefined, async requests => {
    expect((await loader(url)).byteLength).toBe(64);
    expect(requests).toHaveLength(2);
  });
});
