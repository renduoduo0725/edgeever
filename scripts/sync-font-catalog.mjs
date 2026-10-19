// Run with Bun after changing the shared directory; Swift uses a generated projection.
import { readFile, writeFile } from 'node:fs/promises';
import { FONT_CATALOG, FONT_IDS } from '../packages/shared/src/font-catalog.ts';
import { NOTE_IMAGE_TEMPLATE_TYPOGRAPHY } from '../packages/shared/src/note-image-card.ts';
import { zhCN, enUS, ja, pl } from '../packages/shared/src/i18n/index.ts';
const file = new URL('../apps/ios/EdgeEver/Data/Preferences/PreferencesStore.swift', import.meta.url);
const begin = '// BEGIN GENERATED FONT CATALOG — bun scripts/sync-font-catalog.mjs';
const end = '// END GENERATED FONT CATALOG';
const text = await readFile(file, 'utf8');
const rows = FONT_IDS.map(id => {
  const font = FONT_CATALOG[id];
  return `        (id: ${JSON.stringify(id)}, zh: ${JSON.stringify(font.zh)}, en: ${JSON.stringify(font.en)}),`;
}).join('\n');
const templateRows = Object.entries(NOTE_IMAGE_TEMPLATE_TYPOGRAPHY).map(([theme, preset]) => {
  const labels = [zhCN, enUS, ja, pl].map(locale =>
    JSON.stringify(preset.body.map(font => locale.editor.imageShare.templateFonts[font]).join(' / ')));
  return `        ${JSON.stringify(theme)}: (zh: ${labels[0]}, en: ${labels[1]}, ja: ${labels[2]}, pl: ${labels[3]}),`;
}).join('\n');
const generated = `${begin}\nenum NoteImageFontCatalog {\n    static let choices: [(id: String, zh: String, en: String)] = [\n${rows}\n    ]\n    static let templateLabels: [String: (zh: String, en: String, ja: String, pl: String)] = [\n${templateRows}\n    ]\n}\n${end}`;
const next = text.includes(begin)
  ? text.slice(0, text.indexOf(begin)) + generated + text.slice(text.indexOf(end) + end.length)
  : text.replace('import Foundation', `import Foundation\n\n${generated}`);
if (process.argv.includes('--check')) {
  if (text !== next) throw new Error('Swift font directory is out of date. Run bun scripts/sync-font-catalog.mjs');
} else await writeFile(file, next);
