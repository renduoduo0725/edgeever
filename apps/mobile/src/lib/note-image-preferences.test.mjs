import { expect, test } from 'bun:test';
import { createMobileNoteImagePreferenceStore } from './note-image-preferences';
import { DEFAULT_NOTE_IMAGE_PREFERENCES } from '@edgeever/shared/note-image-preferences';

const changed = {
  ...DEFAULT_NOTE_IMAGE_PREFERENCES, theme: 'book', fontStyle: 'serif', fontSize: 'md',
  cardWidth: 'compact', format: 'jpeg', showTitle: false, showNotebook: true,
  showTags: true, showUpdatedAt: false, showBranding: false,
};

test('saved classic theme opens as glass and survives persistence and restart', async () => {
  let raw = JSON.stringify({ ...changed, theme: 'gradient' });
  const storage = { getItem: async () => raw, setItem: async (_key, value) => { raw = value; } };
  const store = createMobileNoteImagePreferenceStore(storage);
  await store.load();
  expect(store.getSnapshot()).toEqual({ ...changed, theme: 'glass' });
  store.update('showTitle', true);
  await store.flush();
  const restarted = createMobileNoteImagePreferenceStore(storage);
  await restarted.load();
  expect(restarted.getSnapshot()).toEqual({ ...changed, theme: 'glass', showTitle: true });
});

test('switching templates persists automatic typography and allows a later manual font', async () => {
  let raw = JSON.stringify(changed);
  const storage = { getItem: async () => raw, setItem: async (_key, value) => { raw = value; } };
  const store = createMobileNoteImagePreferenceStore(storage);
  await store.load();
  store.update('theme', 'handwritten');
  expect(store.getSnapshot()).toEqual({ ...changed, theme: 'handwritten', fontStyle: 'auto' });
  await store.flush();
  const restarted = createMobileNoteImagePreferenceStore(storage);
  await restarted.load();
  expect(restarted.getSnapshot().fontStyle).toBe('auto');
  restarted.update('fontStyle', 'sans');
  expect(restarted.getSnapshot().fontStyle).toBe('sans');
});

test('all mobile share choices survive switching views and a fresh store after restart', async () => {
  let raw = null;
  const storage = { getItem: async () => raw, setItem: async (_key, value) => { raw = value; } };
  const first = createMobileNoteImagePreferenceStore(storage);
  await first.load();
  let notified = 0;
  const unsubscribe = first.subscribe(() => notified++);
  for (const [key, value] of Object.entries(changed)) first.update(key, value);
  await first.flush();
  expect(first.getSnapshot()).toEqual(changed);
  expect(notified).toBe(Object.keys(changed).length);
  unsubscribe();
  const restarted = createMobileNoteImagePreferenceStore(storage);
  await restarted.load();
  expect(restarted.getSnapshot()).toEqual(changed);
  for (const [key, value] of Object.entries(DEFAULT_NOTE_IMAGE_PREFERENCES)) restarted.update(key, value);
  await restarted.flush();
  const again = createMobileNoteImagePreferenceStore(storage);
  await again.load();
  expect(again.getSnapshot()).toEqual(DEFAULT_NOTE_IMAGE_PREFERENCES);
});

test('slow startup reads never write defaults over saved choices', async () => {
  let finishRead;
  let writes = 0;
  const store = createMobileNoteImagePreferenceStore({
    getItem: () => new Promise(resolve => { finishRead = resolve; }),
    setItem: async () => { writes++; },
  });
  const loading = store.load();
  expect(store.getSnapshot()).toBeUndefined();
  expect(store.load()).toBe(loading);
  store.update('theme', 'glass');
  finishRead(JSON.stringify(changed));
  await loading;
  expect(store.getSnapshot()).toEqual(changed);
  expect(writes).toBe(0);
});

test('slow writes are serialized and the last change wins on restart', async () => {
  let raw = null;
  let release;
  const writes = [];
  const storage = {
    getItem: async () => raw,
    setItem: async (_key, value) => {
      writes.push(JSON.parse(value).theme);
      if (writes.length === 1) await new Promise(resolve => { release = resolve; });
      raw = value;
    },
  };
  const store = createMobileNoteImagePreferenceStore(storage);
  await store.load();
  store.update('theme', 'book');
  store.update('theme', 'code');
  await Promise.resolve();
  expect(writes).toEqual(['book']);
  release();
  await store.flush();
  expect(writes).toEqual(['book', 'code']);
  const restarted = createMobileNoteImagePreferenceStore(storage);
  await restarted.load();
  expect(restarted.getSnapshot().theme).toBe('code');
});

test('corrupt fields are isolated and rejected writes keep session choices usable', async () => {
  const store = createMobileNoteImagePreferenceStore({
    getItem: async () => JSON.stringify({ ...changed, theme: 'removed', fontSize: 123, showTitle: 'true' }),
    setItem: async () => { throw new Error('Storage unavailable'); },
  });
  await store.load();
  expect(store.getSnapshot()).toEqual({ ...changed, theme: 'glass', fontSize: 'lg', showTitle: false });
  store.update('showTitle', false);
  store.update('theme', 'code');
  await store.flush();
  expect(store.getSnapshot()).toMatchObject({ showTitle: false, theme: 'code' });
  const unavailable = createMobileNoteImagePreferenceStore({
    getItem: async () => { throw new Error('Storage unavailable'); }, setItem: async () => {},
  });
  await unavailable.load();
  expect(unavailable.getSnapshot()).toEqual(DEFAULT_NOTE_IMAGE_PREFERENCES);
});
