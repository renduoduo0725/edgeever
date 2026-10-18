// Run with Bun after changing the shared directory; Swift uses a generated projection.
import { readFile, writeFile } from 'node:fs/promises';
import { FONT_CATALOG, FONT_IDS } from '../packages/shared/src/font-catalog.ts';
const file = new URL('../apps/ios/EdgeEver/Data/Preferences/PreferencesStore.swift', import.meta.url);
const begin = '// BEGIN GENERATED FONT CATALOG — bun scripts/sync-font-catalog.mjs';
const end = '// END GENERATED FONT CATALOG';
const text = await readFile(file, 'utf8');
const rows = FONT_IDS.map(id => {
  const font = FONT_CATALOG[id];
  return `        (id: ${JSON.stringify(id)}, zh: ${JSON.stringify(font.zh)}, en: ${JSON.stringify(font.en)}),`;
}).join('\n');
const generated = `${begin}\nenum NoteImageFontCatalog {\n    static let choices: [(id: String, zh: String, en: String)] = [\n${rows}\n    ]\n}\n${end}`;
const next = text.includes(begin)
  ? text.slice(0, text.indexOf(begin)) + generated + text.slice(text.indexOf(end) + end.length)
  : text.replace('import Foundation', `import Foundation\n\n${generated}`);
if (process.argv.includes('--check')) {
  if (text !== next) throw new Error('Swift font directory is out of date. Run bun scripts/sync-font-catalog.mjs');
} else await writeFile(file, next);
