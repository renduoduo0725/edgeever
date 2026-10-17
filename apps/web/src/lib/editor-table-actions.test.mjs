import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EdgeEverTableKit as TableKit } from '../../../../packages/shared/src/markdown-table.ts';
import { CellSelection } from '@tiptap/pm/tables';
import { AllSelection, NodeSelection } from '@tiptap/pm/state';
import { getEditorTableActions } from './editor-table-actions.ts';

const cell = (type, text) => ({ type, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const makeEditor = () => {
  let focusCalls = 0;
  const editor = new Editor({
    extensions: [StarterKit, TableKit, Extension.create({
      name: 'headlessFocus',
      addCommands: () => ({ focus: () => () => { focusCalls++; return true; } }),
    })],
    content: { type: 'doc', content: [{ type: 'table', content: [
      { type: 'tableRow', content: [cell('tableHeader', 'H1'), cell('tableHeader', 'H2')] },
      { type: 'tableRow', content: [cell('tableCell', 'Alpha'), cell('tableCell', 'Bravo')] },
      { type: 'tableRow', content: [cell('tableCell', 'Charlie'), cell('tableCell', 'Delta')] },
      { type: 'tableRow', content: [cell('tableCell', 'Echo'), cell('tableCell', 'Foxtrot')] },
    ] }] },
  });
  // An unmounted TipTap editor reports isDestroyed despite its usable headless
  // state. The test exercises real selections and commands without a DOM view.
  Object.defineProperty(editor, 'isDestroyed', { value: false, configurable: true });
  const positions = [];
  editor.state.doc.descendants((node, pos) => {
    if (['cell', 'header_cell'].includes(node.type.spec.tableRole)) positions.push(pos);
  });
  return { editor, positions, get focusCalls() { return focusCalls; } };
};
const action = (editor, key = 'editorToolbar.deleteTableRow', readOnly = false) =>
  getEditorTableActions(editor, readOnly).find((item) => item.key === key);
const selectCells = (editor, positions, anchor, head) =>
  editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, positions[anchor], positions[head])));

test('header protection covers cell selections in both directions', () => {
  for (const [anchor, head] of [[0, 3], [3, 0]]) {
    const { editor, positions } = makeEditor();
    selectCells(editor, positions, anchor, head);
    const before = editor.state.doc;
    assert.equal(action(editor).disabled, true);
    action(editor).run();
    assert.equal(editor.state.doc, before);
    editor.destroy();
  }
});

test('body cell selections delete all selected body rows while preserving the header', () => {
  const { editor, positions } = makeEditor();
  selectCells(editor, positions, 2, 5);
  assert.equal(action(editor).disabled, false);
  action(editor).run();
  const table = editor.state.doc.firstChild;
  assert.equal(table.childCount, 2);
  assert.equal(table.firstChild.textContent, 'H1H2');
  assert.equal(table.lastChild.textContent, 'EchoFoxtrot');
  editor.destroy();
});

test('a mixed header/body row is protected when its body cell is the target', () => {
  const { editor } = makeEditor();
  editor.commands.setContent({ type: 'doc', content: [{ type: 'table', content: [
    { type: 'tableRow', content: [cell('tableHeader', 'Header'), cell('tableCell', 'Body')] },
    { type: 'tableRow', content: [cell('tableCell', 'Other'), cell('tableCell', 'Cell')] },
  ] }] });
  let bodyPos;
  editor.state.doc.descendants((node, pos) => { if (node.type.spec.tableRole === 'cell' && bodyPos == null) bodyPos = pos; });
  editor.commands.setTextSelection(bodyPos + 2);
  assert.equal(editor.isActive('tableHeader'), false);
  const before = editor.state.doc;
  assert.equal(action(editor).disabled, true);
  action(editor).run();
  assert.equal(editor.state.doc, before);
  editor.destroy();
});

test('an already-created action rechecks header selection before running', () => {
  const { editor, positions } = makeEditor();
  editor.commands.setTextSelection(positions[2] + 2);
  const deleteRow = action(editor);
  assert.equal(deleteRow.disabled, false);
  selectCells(editor, positions, 0, 3);
  const before = editor.state.doc;
  deleteRow.run();
  assert.equal(editor.state.doc, before);
  editor.destroy();
});

test('read-only and dynamically noneditable editors disable mutations and refuse stale actions', () => {
  const { editor, positions } = makeEditor();
  editor.commands.setTextSelection(positions[2] + 2);
  const deleteTable = action(editor, 'editorToolbar.deleteTable');
  const before = editor.state.doc;
  assert.equal(action(editor, 'editorToolbar.deleteTable', true).disabled, true);
  action(editor, 'editorToolbar.deleteTable', true).run();
  assert.equal(editor.state.doc, before);
  editor.setEditable(false);
  assert.equal(getEditorTableActions(editor, false).every((item) => item.disabled), true);
  deleteTable.run();
  assert.equal(editor.state.doc, before);
  editor.destroy();
});

test('document and table-node selections keep table commands disabled instead of resolving a nonexistent target cell', () => {
  for (const createSelection of [
    (doc) => new AllSelection(doc),
    (doc) => NodeSelection.create(doc, 0),
  ]) {
    const { editor } = makeEditor();
    editor.view.dispatch(editor.state.tr.setSelection(createSelection(editor.state.doc)));
    assert.equal(editor.isActive('table'), true);
    const before = editor.state.doc;
    const actions = getEditorTableActions(editor, false);
    assert.equal(actions.every((item) => item.disabled), true);
    for (const item of actions) item.run();
    assert.equal(editor.state.doc, before);
    editor.destroy();
  }
});

test('shared actions can omit focus while toolbar actions retain the default focus behavior', () => {
  for (const focus of [true, false]) {
    const fixture = makeEditor();
    const { editor, positions } = fixture;
    editor.commands.setTextSelection(positions[2] + 2);
    if (focus) action(editor).run();
    else action(editor).run({ focus: false });
    assert.equal(editor.state.doc.firstChild.childCount, 3);
    assert.equal(fixture.focusCalls, focus ? 1 : 0);
    editor.destroy();
  }
});
