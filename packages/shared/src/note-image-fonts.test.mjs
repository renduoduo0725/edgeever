import { expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { fontSubsetContains } from './note-image-fonts';
import { NOTE_IMAGE_FONT_SUBSETS } from './note-image-font-manifest';

test('selects font subsets by Unicode code points, including supplementary characters', () => {
  expect(fontSubsetContains('U+20-7e,U+4E00-4EFF', new Set([0x4e2d]))).toBe(true);
  expect(fontSubsetContains('U+4E00-4EFF', new Set([0x1f44b, 0x41]))).toBe(false);
  expect(fontSubsetContains('U+1F4??', new Set([0x1f44b]))).toBe(true);
  expect(fontSubsetContains('U+20-7e', new Set())).toBe(false);
});

test('ships every declared font subset with its original font container intact', () => {
  for (const blocks of Object.values(NOTE_IMAGE_FONT_SUBSETS)) {
    for (const block of blocks) {
      const file = new URL(`./note-image-assets/${block.asset}`, import.meta.url);
      expect(existsSync(file)).toBe(true);
      const header = readFileSync(file).subarray(0, 4);
      expect(block.asset.endsWith('.woff2') ? header.toString() : header.toString('hex')).toBe(block.asset.endsWith('.woff2') ? 'wOF2' : '00010000');
    }
  }
});
