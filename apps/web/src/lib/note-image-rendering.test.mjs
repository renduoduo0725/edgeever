import { expect, test } from 'bun:test';
import { planWebNoteImageRender } from './note-image-rendering';

test('keeps a welcome-note-sized image at twice its layout width on capable browsers', () => {
  const plan = planWebNoteImageRender(800, 21_450, 65_535);
  expect(800 * plan.pixelRatio).toBe(1600);
  expect(21_450 * plan.pixelRatio).toBe(42_900);
});

test('bounds the complete card to browser dimensions and memory without cropping', () => {
  for (const limit of [4096, 16384, 32767, 65535]) {
    for (const height of [400, 21450, 100000]) {
      const { pixelRatio } = planWebNoteImageRender(800, height, limit);
      expect(pixelRatio).toBeGreaterThan(0);
      expect(pixelRatio).toBeLessThanOrEqual(2);
      expect(Math.ceil(height * pixelRatio)).toBeLessThanOrEqual(limit);
      expect(800 * height * pixelRatio ** 2).toBeLessThanOrEqual(80_000_001);
    }
  }
});

test('rejects invalid dimensions before allocating a canvas', () => {
  for (const dimension of [0, -1, NaN, Infinity]) {
    expect(() => planWebNoteImageRender(800, dimension, 65535)).toThrow();
  }
});
