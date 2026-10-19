import { expect, test } from 'bun:test';
import { readNoteImagePreferences, writeNoteImagePreferences, NOTE_IMAGE_PREFERENCES_STORAGE_KEY as key } from './note-image-preference';

const withStorage = (entries, run) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map(Object.entries(entries));
  const storage = {
    getItem: name => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, value),
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try { run(storage, values); }
  finally {
    // Clear the failed-write cache before restoring the original environment.
    storage.setItem = (name, value) => values.set(name, value);
    writeNoteImagePreferences(readNoteImagePreferences());
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
};

test('migrates the existing title choice and signature without losing explicit false', () => {
  withStorage({ edgeever_share_image_show_title: 'false', edgeever_share_author_name: '天马' }, () => {
    const migrated = readNoteImagePreferences();
    expect(migrated.showTitle).toBe(false);
    expect(migrated.author).toBe('天马');
    expect(migrated.showAuthor).toBe(true);
    writeNoteImagePreferences({ ...migrated, showAuthor: false, theme: 'book' });
    expect(readNoteImagePreferences()).toEqual({ ...migrated, showAuthor: false, theme: 'book' });
  });
});

test('invalid fields fall back independently while valid false choices survive', () => {
  withStorage({ [key]: JSON.stringify({ theme: 'removed-theme', fontSize: 20, cardWidth: 'compact', format: 'svg', showTags: 'true', showUpdatedAt: false, showBranding: false, author: 12 }) }, () => {
    expect(readNoteImagePreferences()).toMatchObject({ theme: 'glass', fontSize: 'lg', cardWidth: 'compact', format: 'png', showTags: false, showUpdatedAt: false, showBranding: false, author: '' });
  });
});

test('saved classic theme opens as glass while preserving custom typography and visibility', () => {
  withStorage({ [key]: JSON.stringify({ theme: 'gradient', fontStyle: 'heavy', showTitle: false }) }, () => {
    expect(readNoteImagePreferences()).toMatchObject({ theme: 'glass', fontStyle: 'heavy', showTitle: false });
  });
});

test('malformed JSON and non-object storage retain usable legacy defaults', () => {
  for (const stored of ['{broken', 'null', '[]', 'false', '"book"']) {
    withStorage({ [key]: stored, edgeever_share_image_show_title: 'false' }, () => {
      expect(readNoteImagePreferences()).toMatchObject({ theme: 'glass', showTitle: false });
    });
  }
});

test('failed writes retain the entire preference set for subsequent mounts', () => {
  withStorage({}, storage => {
    const preferences = { ...readNoteImagePreferences(), theme: 'code', format: 'jpeg', showAuthor: false, author: 'Saved name', showTitle: false };
    storage.setItem = () => { throw new Error('Storage unavailable'); };
    writeNoteImagePreferences(preferences);
    storage.getItem = () => { throw new Error('Storage unavailable'); };
    expect(readNoteImagePreferences()).toEqual(preferences);
  });
});
