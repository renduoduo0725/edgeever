import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { CellSelection, tableNodes } from '@tiptap/pm/tables';
import { isMouseTableContextEvent, selectTableContextTarget } from './editor-table-context.ts';

const schema = new Schema({ nodes: {
  doc: { content: 'block+' }, paragraph: { content: 'text*', group: 'block' }, text: {},
  ...tableNodes({ tableGroup: 'block', cellContent: 'paragraph+' }),
} });
const paragraph = (text) => schema.nodes.paragraph.create(null, text ? schema.text(text) : null);
const cell = (text) => schema.nodes.table_cell.create(null, paragraph(text));
const doc = schema.nodes.doc.create(null, [paragraph('outside'), schema.nodes.table.create(null, [
  schema.nodes.table_row.create(null, [cell('Alpha'), cell('Bravo')]),
  schema.nodes.table_row.create(null, [cell('Charlie'), cell('Delta')]),
])]);
const positions = [];
doc.descendants((node, pos) => { if (node.type.name === 'table_cell') positions.push(pos); });
const mockView = (selection, index = 0, hit = positions[index] + 2) => ({
  state: EditorState.create({ doc, selection }),
  editable: true,
  dom: { contains: () => true },
  posAtDOM: () => positions[index] + 1,
  posAtCoords: () => ({ pos: hit }),
  dispatch(transaction) { this.state = this.state.apply(transaction); },
});

test('right-click targets clicked cell instead of old cursor', () => {
  const view = mockView(TextSelection.create(doc, positions[0] + 2), 3);
  assert.equal(selectTableContextTarget(view, {} , { left: 0, top: 0 }), true);
  assert.equal(view.state.selection.from, positions[3] + 2);
});
test('selection within clicked text is preserved for copy and replacement', () => {
  const selection = TextSelection.create(doc, positions[0] + 2, positions[0] + 7);
  const view = mockView(selection, 0, positions[0] + 4);
  selectTableContextTarget(view, {}, { left: 0, top: 0 });
  assert.equal(view.state.selection, selection);
});
test('click outside text selection resets the target', () => {
  const view = mockView(TextSelection.create(doc, positions[0] + 2, positions[0] + 7), 2);
  selectTableContextTarget(view, {}, { left: 0, top: 0 });
  assert.equal(view.state.selection.from, positions[2] + 2);
  assert.equal(view.state.selection.empty, true);
});
test('selected cells stay selected; an unselected cell resets selection', () => {
  const selection = CellSelection.create(doc, positions[0], positions[1]);
  const selected = mockView(selection, 1);
  selectTableContextTarget(selected, {}, { left: 0, top: 0 });
  assert.equal(selected.state.selection, selection);
  const outside = mockView(selection, 3);
  selectTableContextTarget(outside, {}, { left: 0, top: 0 });
  assert.equal(outside.state.selection instanceof CellSelection, false);
  assert.equal(outside.state.selection.from, positions[3] + 2);
});
test('empty cell area and keyboard context invocation find a valid text cursor', () => {
  const view = mockView(TextSelection.create(doc, 1), 1, 1);
  selectTableContextTarget(view, {}, { left: 0, top: 0 });
  assert.equal(view.state.selection.from, positions[1] + 2);
});
test('cell-end whitespace stays in the clicked cell instead of the next cell or paragraph', () => {
  for (const index of [0, 3]) {
    const cellEnd = positions[index] + 1 + doc.nodeAt(positions[index]).content.size;
    const view = mockView(TextSelection.create(doc, 1), index, cellEnd);
    assert.equal(selectTableContextTarget(view, {}, { left: 0, top: 0 }), true);
    assert.equal(view.state.selection.from, cellEnd - 1);
    assert.equal(view.state.selection.$from.node(-1), doc.nodeAt(positions[index]));
  }
});
test('table-like DOM inside node views must map to an actual editor table cell', () => {
  const view = mockView(TextSelection.create(doc, positions[0] + 2));
  const selection = view.state.selection;
  for (const contentPos of [0, 1, 2, doc.content.size + 1]) {
    view.posAtDOM = () => contentPos;
    assert.equal(selectTableContextTarget(view, {}, { left: 0, top: 0 }), false);
    assert.equal(view.state.selection, selection);
  }
});
test('read-only and foreign cells keep the selection unchanged', () => {
  const view = mockView(TextSelection.create(doc, 1));
  view.editable = false;
  assert.equal(selectTableContextTarget(view, {}), false);
  view.editable = true;
  view.dom.contains = () => false;
  assert.equal(selectTableContextTarget(view, {}), false);
  assert.equal(view.state.selection.from, 1);
});

test('keyboard context preserves selection and cursor within the current cell', () => {
  const selection = TextSelection.create(doc, positions[0] + 3, positions[0] + 6);
  const view = mockView(selection);
  selectTableContextTarget(view, {});
  assert.equal(view.state.selection, selection);
  const cursor = mockView(TextSelection.create(doc, positions[0] + 5));
  selectTableContextTarget(cursor, {});
  assert.equal(cursor.state.selection.from, positions[0] + 5);
});

test('mouse and legacy mouse events are accepted, touch and pen stay native', () => {
  assert.equal(isMouseTableContextEvent({ shiftKey: false, pointerType: 'mouse' }, null), true);
  assert.equal(isMouseTableContextEvent({ shiftKey: false }, 'mouse'), true);
  for (const pointerType of ['touch', 'pen']) {
    assert.equal(isMouseTableContextEvent({ shiftKey: false, pointerType }, 'mouse'), false);
    assert.equal(isMouseTableContextEvent({ shiftKey: false }, pointerType), false);
  }
  assert.equal(isMouseTableContextEvent({ shiftKey: true, pointerType: 'mouse' }, 'mouse'), false);
  assert.equal(isMouseTableContextEvent({ shiftKey: false, sourceCapabilities: { firesTouchEvents: true } }, 'mouse'), false);
  assert.equal(isMouseTableContextEvent({ shiftKey: false }, null), false);
});
