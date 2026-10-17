import { expect, test } from 'bun:test';
import { readTableClipboard } from './editor-table-clipboard.ts';

const item = (data) => ({
  types: Object.keys(data),
  async getType(type) {
    const content = data[type];
    if (content instanceof Error) throw content;
    return new Blob([content], { type });
  },
});

test('rich text wins without reading duplicate images or a failing plain-text representation', async () => {
  const clipboard = { read: async () => [item({
    'text/html': '<p><strong>Alpha</strong></p>',
    'text/plain': new Error('Plain text not readable'),
    'image/png': new Error('Image not readable'),
  })] };
  expect(await readTableClipboard(clipboard)).toEqual({ html: '<p><strong>Alpha</strong></p>', text: '', images: [] });
});
test('a failing HTML representation falls back to available plain text', async () => {
  expect(await readTableClipboard({ read: async () => [item({ 'text/html': new Error('format unavailable'), 'text/plain': '<literal>\ntext' })] }))
    .toEqual({ html: '', text: '<literal>\ntext', images: [] });
});
test('plain text is preserved, and multiple items have a line break', async () => {
  expect((await readTableClipboard({ read: async () => [item({ 'text/plain': 'A\tB' }), item({ 'text/plain': 'C\nD' })] })).text)
    .toBe('A\tB\nC\nD');
});
test('browsers with only readText are supported without converting text to HTML', async () => {
  expect(await readTableClipboard({ readText: async () => '<script>literal</script>' }))
    .toEqual({ html: '', text: '<script>literal</script>', images: [] });
});
test('image-only contents are passed on as files with their MIME types', async () => {
  const result = await readTableClipboard({ read: async () => [item({ 'image/png': 'image-bytes' })] });
  expect(result.html).toBe('');
  expect(result.text).toBe('');
  expect(result.images).toHaveLength(1);
  expect(result.images[0].type).toBe('image/png');
  expect(await result.images[0].text()).toBe('image-bytes');
});
test('empty clipboard is a no-op', async () => {
  expect(await readTableClipboard({ read: async () => [] })).toEqual({ html: '', text: '', images: [] });
});
test('denied and missing clipboard access fail for the caller to show its shortcut hint', async () => {
  await expect(readTableClipboard(undefined)).rejects.toThrow('Clipboard read unavailable');
  await expect(readTableClipboard({ read: async () => { throw new Error('Denied'); } })).rejects.toThrow('Denied');
  await expect(readTableClipboard({ readText: async () => { throw new Error('Denied'); } })).rejects.toThrow('Denied');
  await expect(readTableClipboard({ read: async () => [item({ 'text/html': new Error('unreadable') })] })).rejects.toThrow('unreadable');
});
