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
  const paper = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const assets = await prepareNoteImageAssets({ theme: 'book', fontStyle: 'sans', text: '中文', urls: { 'paper.png': paper } });
  expect(assets.fontCss).toBe('');
  expect(assets.css).toContain(`--ee-paper:url("${paper}")`);
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

test('replaces a corrupt cached template subset with verified bytes and reuses it offline', async () => {
  const { readFileSync } = await import('node:fs');
  const { pinnedFontUrl } = await import('./font-resources');
  const { writeFontCache } = await import('./note-image-font-cache');
  const file = readFileSync(new URL('./note-image-assets/misans/2dda088b.woff2', import.meta.url));
  const valid = Uint8Array.from(file).buffer;
  const corrupt = valid.slice(0);
  new Uint8Array(corrupt)[60] ^= 1;
  const url = pinnedFontUrl('template/misans/2dda088b.woff2');
  await writeFontCache(url, corrupt);
  await withNetwork(() => ({ data: valid }), async requests => {
    expect(await createRemoteFontResourceLoader()(url)).toEqual(valid);
    expect(requests).toHaveLength(1);
  });
  await withNetwork(() => undefined, async requests => {
    expect(await createRemoteFontResourceLoader()(url)).toEqual(valid);
    expect(requests).toEqual([]);
  });
});

// Real font containers exercise integrity validation; browser APIs are stubbed only at the boundary.
const withFontBrowser = async (run) => {
  const saved = Object.fromEntries(['document', 'FontFace', 'FileReader', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const installed = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  globalThis.document = { fonts: { add: face => installed.push(face.family) } };
  globalThis.FontFace = class { constructor(family) { this.family = family; } async load() { return this; } };
  globalThis.FileReader = class {
    readAsDataURL(blob) { void blob.arrayBuffer().then(data => { this.result = `data:${blob.type};base64,${Buffer.from(data).toString('base64')}`; this.onload(); }); }
  };
  try { await run(installed); } finally {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
};

test('offline first use exports readable defaults, preserves the choice, and keeps previews truthful', async () => {
  const { readFileSync } = await import('node:fs');
  const sans = Uint8Array.from(readFileSync(new URL('./font-assets/poster/notosans.woff2', import.meta.url))).buffer;
  const mono = Uint8Array.from(readFileSync(new URL('./note-image-assets/geist/GeistMono.ttf', import.meta.url))).buffer;
  const urls = { 'offline-sans.woff2': 'file:///offline-sans.woff2', 'geist/GeistMono.ttf': 'file:///offline-mono.ttf' };
  await withFontBrowser(async installed => {
    await withNetwork(url => url === urls['offline-sans.woff2'] ? { status: 0, data: sans } : url === urls['geist/GeistMono.ttf'] ? { status: 0, data: mono } : undefined, async requests => {
      const result = await prepareNoteImageAssets({ theme: 'memo', fontStyle: 'youshe', text: '离线笔记 Offline', urls });
      expect(result.fontFallback).toBe(true);
      expect(result.fontCss).toContain('EdgeEver Offline Sans');
      expect(result.fontCss).toContain('data:font/woff2;base64,');
      expect(installed).toContain('Geist Mono Variable');
      expect(requests.every(url => url.startsWith('file:'))).toBe(true);
      await expect(prepareNoteImageAssets({ theme: 'memo', fontStyle: 'youshe', text: '字体预览', urls, embed: false })).rejects.toThrow('NOTE_IMAGE_FONT_UNAVAILABLE');
      expect(resolveNoteImagePreferences({ fontStyle: 'youshe' }).fontStyle).toBe('youshe');
    });
  });
});

test('invalid tiny and oversized font responses are rejected without DataView errors', async () => {
  for (const data of [new Uint8Array(1).buffer, new Uint8Array(24_000_001).buffer]) {
    await withNetwork(() => ({ data }), async () => {
      await expect(createRemoteFontResourceLoader()('https://cdn.jsdelivr.net/npm/@edgeever/font-cache-test@1.0.0/invalid.woff2')).rejects.toThrow('NOTE_IMAGE_FONT_UNAVAILABLE');
    });
  }
});

test('render deadlines allow the shared download to complete and populate the cache', async () => {
  const { withFontDeadline } = await import('./font-loader');
  let complete;
  const download = new Promise(resolve => { complete = resolve; });
  await expect(withFontDeadline(download, 5)).rejects.toThrow('NOTE_IMAGE_FONT_UNAVAILABLE');
  complete('cached');
  expect(await withFontDeadline(download, 5)).toBe('cached');
});


test('a timed-out template exposes its original download and restores the original face on the next render', async () => {
  const { readFileSync } = await import('node:fs');
  const anton = Uint8Array.from(readFileSync(new URL('./font-assets/poster/anton.woff2', import.meta.url))).buffer;
  await withFontBrowser(async () => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    const BaseFace = globalThis.FontFace;
    globalThis.FontFace = class extends BaseFace {
      async load() { if (this.family === 'EdgeEver Share Anton') await pending; return this; }
    };
    await withNetwork(url => url.endsWith('/anton.woff2') ? { data: anton } : undefined, async () => {
      const options = { theme: 'memo', fontStyle: 'anton', text: 'Recover template', urls: {} };
      const fallback = await prepareNoteImageAssets(options);
      expect(fallback.fontFallback).toBe(true);
      expect(fallback.fontsReady).toBeInstanceOf(Promise);
      expect(fallback.css).toContain('sans-serif!important');
      finish();
      await fallback.fontsReady;
      const restored = await prepareNoteImageAssets(options);
      expect(restored.fontFallback).toBe(false);
      expect(restored.fontsReady).toBeUndefined();
      expect(restored.fontCss).toContain('font-family:"EdgeEver Share Anton"');
      expect(restored.css).not.toContain('sans-serif!important');
    });
  });
});
