// Open through Vite's /@fs/<checkout>/tests/browser/editor-table-context.html.
// Real React, Radix, TipTap and ProseMirror integration; no production notes or APIs.
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { Editor, EditorContent } from "@tiptap/react";
import { Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { EdgeEverTableKit as TableKit } from "../../packages/shared/src/markdown-table";
import { CellSelection } from "@tiptap/pm/tables";
import { I18nextProvider } from "react-i18next";
import i18next from "i18next";
import { enUS } from "../../packages/shared/src/i18n/en-US";
import { EditorTableContextMenu } from "../../apps/web/src/components/EditorTableContextMenu";
import { EditorTableMenu } from "../../apps/web/src/components/EditorTableMenu";
import { TooltipProvider } from "../../apps/web/src/components/ui/tooltip";
import "../../apps/web/src/styles/globals.css";

const i18n = i18next.createInstance();
await i18n.init({ lng: "en", resources: { en: { translation: enUS } }, initAsync: false });
const style = document.createElement("style");
style.textContent = ".ProseMirror{outline:none;padding:12px}.ProseMirror table{border-collapse:collapse;width:540px}.ProseMirror td,.ProseMirror th{border:1px solid #aaa;min-width:150px;padding:12px}.selectedCell{background:#def}";
document.head.appendChild(style);
const diagnostics = document.createElement('div');
diagnostics.style.cssText = 'position:fixed;bottom:0;left:0;z-index:1000;background:white;color:black;font:12px monospace;padding:4px';
document.body.appendChild(diagnostics);
let ticks = 0;
setInterval(() => { diagnostics.textContent = `tick=${++ticks} visibility=${document.visibilityState} state=${document.querySelector('[data-table-context-open]')?.getAttribute('data-table-context-open')} menu=${document.querySelector('[role="menu"]')?.getAttribute('data-state')} active=${document.activeElement?.tagName}`; }, 100);
const fixture = document.getElementById("fixture")!;
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalDesktop = Object.getOwnPropertyDescriptor(window, "edgeeverDesktop");
let editor: Editor;
let root: Root | undefined;
let receivedNodeContext = 0;
let receivedPointer = 0;
let uploaded: File[] = [];
let writes: ClipboardItem[][] = [];
const TestResource = Node.create({
  name: "testResource", group: "inline", inline: true, atom: true,
  parseHTML: () => [{ tag: "span[data-test-resource]" }],
  renderHTML: () => ["span", { "data-test-resource": "" }],
  addNodeView: () => () => {
    const dom = document.createElement("span"); dom.dataset.testResource = ""; dom.textContent = "Resource";
    dom.addEventListener("pointerdown", () => receivedPointer++);
    dom.addEventListener("contextmenu", (event) => { receivedNodeContext++; event.preventDefault(); });
    return { dom };
  },
});
const content = '<p>Outside table</p><table><tr><th>H1</th><th>H2</th><th>H3</th></tr><tr><td><p><strong>Alpha</strong></p></td><td>Bravo</td><td>Charlie</td></tr><tr><td>Delta</td><td>Echo</td><td>Foxtrot<span data-test-resource></span></td></tr></table><p>Between tables</p><table><tr><td>Other</td></tr></table><p>After table</p>';
const pause = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const until = async (condition: () => unknown, description: string) => {
  for (let i = 0; i < 100; i++) { if (condition()) return; await pause(20); }
  throw new Error(`Timed out: ${description}`);
};
const menu = () => document.querySelector<HTMLElement>('[role="menu"][data-state="open"]');
const menuItem = (label: string) => [...(menu()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])].find((item) => item.textContent?.startsWith(label));
const cells = (table = 0) => [...editor.view.dom.querySelectorAll("table")][table].querySelectorAll<HTMLElement>("td,th");
const cellPos = (index: number, table = 0) => editor.view.posAtDOM(cells(table)[index], 0);
const setCursor = (index: number, table = 0) => { editor.commands.setTextSelection(cellPos(index, table) + 1); editor.view.focus(); };
const selectText = (index: number) => {
  cells()[index].scrollIntoView({ block: "center" });
  const pos = cellPos(index) + 1;
  editor.commands.setTextSelection({ from: pos, to: pos + cells()[index].textContent!.length });
  editor.view.focus();
};
const stubClipboard = (value: object) => Object.defineProperty(navigator, "clipboard", { configurable: true, value });
const clipboardItem = (html: string, text = "") => new ClipboardItem({ ...(html ? { "text/html": new Blob([html], { type: "text/html" }) } : {}), ...(text ? { "text/plain": new Blob([text], { type: "text/plain" }) } : {}) });
const restoreClipboard = () => {
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else delete (navigator as { clipboard?: Clipboard }).clipboard;
};
const restoreDesktop = () => {
  if (originalDesktop) Object.defineProperty(window, "edgeeverDesktop", originalDesktop);
  else delete window.edgeeverDesktop;
};
const stubNativeRead = (readClipboard: () => Promise<{ html: string; text: string; images: Uint8Array[] }>) => Object.defineProperty(window, "edgeeverDesktop", {
  configurable: true, value: { isAvailable: true, readClipboard },
});
const nativePasteEvent = (target: HTMLElement = editor.view.dom) => {
  const data = new DataTransfer(); data.setData("text/plain", "Native paste");
  const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data });
  target.dispatchEvent(event); return event;
};
const mount = async (readOnly = false) => {
  root?.unmount();
  if (editor && !editor.isDestroyed) editor.destroy();
  fixture.replaceChildren();
  restoreDesktop();
  receivedNodeContext = receivedPointer = 0; uploaded = []; writes = [];
  editor = new Editor({ extensions: [StarterKit, TableKit, TestResource], content, editable: !readOnly,
    editorProps: { handlePaste(_view, event) { if (!event.clipboardData?.files.length) return false; uploaded = [...event.clipboardData.files]; return true; } },
  });
  stubClipboard({ read: async () => [clipboardItem('<p><em>Pasted</em></p>', 'Pasted')], write: async (items: ClipboardItem[]) => { writes.push(items); } });
  root = createRoot(fixture);
  root.render(<I18nextProvider i18n={i18n}><TooltipProvider>
    <EditorTableMenu editor={editor} readOnly={readOnly} />
    <EditorTableContextMenu editor={editor} readOnly={readOnly}>
      <EditorContent editor={editor} />
      <button id="node-view" onPointerDown={() => receivedPointer++} onContextMenu={(event) => { receivedNodeContext++; event.preventDefault(); }}>Nested node context</button>
    </EditorTableContextMenu>
  </TooltipProvider></I18nextProvider>);
  await until(() => fixture.querySelector(".ProseMirror table"), "fixture mount");
  await pause();
};
const contextEvent = (element: HTMLElement, options: { pointerType?: string; legacy?: boolean; shiftKey?: boolean; edge?: boolean } = {}) => {
  element.scrollIntoView({ block: "center" });
  const pointerType = options.pointerType ?? "mouse";
  element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType }));
  const rect = element.getBoundingClientRect();
  const init = { bubbles: true, cancelable: true, button: 2, shiftKey: options.shiftKey, clientX: options.edge ? innerWidth - 2 : rect.left + 18, clientY: options.edge ? innerHeight - 2 : rect.top + rect.height / 2 };
  const event = options.legacy ? new MouseEvent("contextmenu", init) : new PointerEvent("contextmenu", { ...init, pointerType });
  element.dispatchEvent(event);
  return event;
};
const open = async (index: number, table = 0, edge = false) => {
  assert(contextEvent(cells(table)[index], { edge }).defaultPrevented, "custom menu must prevent native menu");
  await until(menu, "menu open");
  await pause();
};
const close = async () => {
  (document.activeElement ?? menu())?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await until(() => !menu(), "menu close");
  await pause(50);
};
const choose = async (label: string) => {
  const item = menuItem(label);
  assert(item && item.getAttribute("aria-disabled") !== "true", `${label} must be enabled: selection ${editor.state.selection.from}..${editor.state.selection.to}; text ${JSON.stringify(window.getSelection()?.toString())}; menu ${menu()?.textContent}`);
  document.getElementById("summary")!.textContent += ` | clicking ${label}`;
  item!.click();
  document.getElementById("summary")!.textContent += " | waiting for close";
  await until(() => !menu(), "menu action close");
  await until(() => !document.querySelector('[role="menu"]'), "menu focus scope teardown");
  await pause(30);
};
const check = (name: string, run: () => Promise<void>) => ({ name, run });
const checks = [
  check("Right click targets the clicked table and row, not the old cursor", async () => {
    setCursor(0, 1); await open(4); await choose("Delete current row");
    assert(!editor.getText().includes("Alpha") && editor.getText().includes("Delta") && editor.getText().includes("Other"), "wrong row or table deleted");
    editor.commands.undo(); assert(editor.getText().includes("Alpha"), "undo did not restore row");
  }),
  check("Column deletion targets clicked column and is undoable", async () => {
    setCursor(3); await open(5); await choose("Delete current column");
    assert(!editor.getText().includes("Charlie") && !editor.getText().includes("Foxtrot") && editor.getText().includes("Alpha"), "wrong column deleted");
    editor.commands.undo(); assert(editor.getText().includes("Charlie"), "undo failed");
  }),
  check("Add row and column commands share toolbar behavior", async () => {
    setCursor(3); await open(4); await choose("Add row below");
    assert(editor.view.dom.querySelector("table")!.rows.length === 4, "row not inserted");
    editor.commands.undo(); await open(4); await choose("Add column right");
    assert(editor.view.dom.querySelector("table")!.rows[0].cells.length === 4, "column not inserted");
  }),
  check("Header row deletion remains disabled", async () => {
    setCursor(6); await open(0);
    assert(menuItem("Delete current row")?.getAttribute("aria-disabled") === "true", "header protection lost"); await close();
  }),
  check("Selections spanning header and body rows keep the header protection", async () => {
    editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cellPos(3) - 1, cellPos(4) - 1)));
    await open(4); assert(menuItem("Delete current row")?.getAttribute("aria-disabled") !== "true", "body rows were disabled");
    editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cellPos(0) - 1, cellPos(4) - 1)));
    await until(() => menuItem("Delete current row")?.getAttribute("aria-disabled") === "true", "header protection after selection change");
    await close();
  }),
  check("Header toggle and table deletion are reversible", async () => {
    setCursor(3); await open(3); await choose("Toggle header row");
    assert(!editor.view.dom.querySelector("table th"), "header not toggled"); editor.commands.undo();
    const before = JSON.stringify(editor.getJSON()); await open(3); await choose("Delete table");
    assert(editor.view.dom.querySelectorAll("table").length === 1 && editor.getText().includes("Other"), "wrong table deleted");
    editor.commands.undo(); assert(JSON.stringify(editor.getJSON()) === before, "undo changed table contents");
  }),
  check("Text selection is preserved and copied with rich and plain formats", async () => {
    selectText(3); const selection = editor.state.selection; await open(3);
    assert(editor.state.selection.eq(selection), "selection was collapsed"); await choose("Copy");
    await until(() => writes.length, "clipboard write");
    assert((await (await writes[0][0].getType("text/html")).text()).includes("<strong>Alpha</strong>"), "formatting lost");
    assert(await (await writes[0][0].getType("text/plain")).text() === "Alpha", "wrong copied text");
  }),
  check("Copy is disabled without a selection", async () => {
    setCursor(3); await open(3); assert(menuItem("Copy")?.getAttribute("aria-disabled") === "true", "copy must require selection"); await close();
  }),
  check("A multi-cell selection is preserved and serialized as a table", async () => {
    editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cellPos(3) - 1, cellPos(4) - 1))); editor.view.focus();
    const before = editor.state.selection; await open(4); assert(editor.state.selection.eq(before), "cell selection lost"); await choose("Copy");
    await until(() => writes.length, "cell clipboard write"); const html = await (await writes[0][0].getType("text/html")).text();
    assert(html.includes("<table") && html.includes("Alpha") && html.includes("Bravo") && !html.includes("Delta"), "wrong copied cells");
  }),
  check("Rich HTML paste replaces selected text, keeps formatting and supports undo", async () => {
    selectText(3); await open(3); await choose("Paste");
    assert(cells()[3].innerHTML.includes("<em>Pasted</em>") && !cells()[3].textContent!.includes("Alpha"), "rich paste failed");
    editor.commands.undo(); assert(cells()[3].textContent === "Alpha", "paste undo failed");
  }),
  check("Plain text paste treats HTML-looking text literally", async () => {
    stubClipboard({ readText: async () => '<script>literal</script>' }); selectText(4); await open(4); await choose("Paste");
    assert(cells()[4].textContent === '<script>literal</script>' && !cells()[4].querySelector("script"), "text was parsed as HTML");
  }),
  check("Image paste uses the existing upload handler", async () => {
    stubClipboard({ read: async () => [new ClipboardItem({ 'image/png': new Blob(['fixture'], { type: 'image/png' }) })] });
    setCursor(3); await open(3); await choose("Paste"); await until(() => uploaded.length, "file upload"); assert(uploaded[0].type === 'image/png', "wrong upload type");
  }),
  check("Native desktop clipboard snapshot waits for menu teardown before insertion", async () => {
    let called = false;
    stubClipboard({ read: async () => { throw new Error("Browser clipboard must not be used on desktop"); } });
    stubNativeRead(async () => {
      called = true; return { html: '<p><em>Native paste</em></p>', text: 'Native paste', images: [] };
    });
    selectText(3); await open(3); await choose("Paste");
    await until(() => cells()[3].textContent === "Native paste", "native paste transaction");
    assert(called && cells()[3].innerHTML.includes('<em>Native paste</em>'), "native bridge or formatting was skipped"); editor.commands.undo(); assert(cells()[3].textContent === "Alpha", "native paste undo failed");
  }),
  ...['document', 'selection', 'readOnly', 'unmount', 'userPaste'].map((change) => check(`Native clipboard snapshot arriving after ${change} changes is discarded`, async () => {
    let resolve!: (data: { html: string; text: string; images: Uint8Array[] }) => void;
    stubNativeRead(() => new Promise((done) => { resolve = done; }));
    setCursor(3); await open(3); await choose("Paste");
    if (change === 'document') editor.commands.setContent('<p>Another note</p>');
    if (change === 'selection') setCursor(4);
    if (change === 'readOnly') editor.setEditable(false);
    if (change === 'unmount') { root!.unmount(); root = undefined; }
    if (change === 'userPaste') nativePasteEvent();
    const before = JSON.stringify(editor.getJSON());
    resolve({ html: '', text: 'Unexpected clipboard snapshot', images: [] }); await pause(80);
    assert(JSON.stringify(editor.getJSON()) === before && !editor.getText().includes('Unexpected'), "native clipboard snapshot escaped target guard");
  })),
  check("Native clipboard rejection shows a shortcut hint", async () => {
    stubNativeRead(async () => { throw new Error('Native read denied'); });
    setCursor(3); const before = JSON.stringify(editor.getJSON()); await open(3); await choose('Paste');
    await until(() => document.querySelector('[role="alert"]')?.textContent?.includes('V'), 'native rejection notice');
    assert(JSON.stringify(editor.getJSON()) === before, 'rejected native paste changed content');
  }),
  check("All native PNG clipboard items use the existing upload pipeline", async () => {
    stubNativeRead(async () => ({ html: '', text: '', images: [Uint8Array.from([137,80,78,71]), Uint8Array.from([137,80,78,71])] }));
    setCursor(3); await open(3); await choose('Paste');
    await until(() => uploaded.length === 2, 'native clipboard upload'); assert(uploaded.every((file) => file.type === 'image/png'), 'native image format lost');
  }),
  check("Denied clipboard read gives a visible shortcut hint and leaves document intact", async () => {
    stubClipboard({ read: async () => { throw new DOMException('Denied', 'NotAllowedError'); } }); const before = JSON.stringify(editor.getJSON());
    setCursor(3); await open(3); await choose("Paste"); assert(document.querySelector('[role="alert"]')?.textContent?.includes('V'), "no paste failure hint");
    assert(JSON.stringify(editor.getJSON()) === before, "failed paste changed document");
  }),
  ...['document', 'selection', 'readOnly', 'unmount'].map((change) => check(`Pending paste is cancelled after ${change} changes`, async () => {
    let resolve!: (value: ClipboardItem[]) => void; stubClipboard({ read: () => new Promise((done) => { resolve = done; }) });
    setCursor(3); await open(3); await choose("Paste");
    if (change === 'document') editor.commands.setContent('<p>Another note</p>');
    if (change === 'selection') setCursor(4);
    if (change === 'readOnly') editor.setEditable(false);
    if (change === 'unmount') root!.unmount();
    const before = JSON.stringify(editor.getJSON()); resolve([clipboardItem('<p>Unexpected</p>', 'Unexpected')]); await pause(80);
    assert(JSON.stringify(editor.getJSON()) === before, "stale paste changed target");
    if (change === 'unmount') root = undefined;
  })),
  check("A document change while a menu is open cancels a destructive action", async () => {
    setCursor(3); await open(3); editor.commands.insertContent('Remote update'); const before = JSON.stringify(editor.getJSON());
    await choose("Delete table"); assert(JSON.stringify(editor.getJSON()) === before, "stale menu deleted table");
  }),
  check("Touch and pen events, including legacy long-press contextmenu, remain native", async () => {
    for (const pointerType of ['touch', 'pen']) for (const legacy of [false, true]) {
      const event = contextEvent(cells()[3], { pointerType, legacy }); await pause();
      assert(!event.defaultPrevented && !menu(), `${pointerType} context was overridden`);
    }
    assert((getComputedStyle(editor.view.dom.parentElement!) as CSSStyleDeclaration & { webkitTouchCallout: string }).webkitTouchCallout !== 'none', "touch callout style leaked into editor");
  }),
  check("Hybrid devices can use mouse context menus after a touch interaction", async () => {
    contextEvent(cells()[3], { pointerType: 'touch' }); await open(4); await close();
  }),
  check("Shift-right-click and right-click outside tables leave the native menu available", async () => {
    assert(!contextEvent(cells()[3], { shiftKey: true }).defaultPrevented, "shift fallback blocked");
    assert(!contextEvent(editor.view.dom.querySelector<HTMLElement>('p')!).defaultPrevented, "outside context blocked"); assert(!menu(), "outside context opened menu");
  }),
  check("Nested node-view context and pointer handlers receive their events", async () => {
    const node = fixture.querySelector<HTMLElement>('#node-view')!; contextEvent(node, { pointerType: 'touch' });
    assert(receivedPointer === 1 && receivedNodeContext === 1 && !menu(), "nested event was swallowed");
  }),
  check("A node-view context menu inside a table keeps its own target and handlers", async () => {
    setCursor(3); const before = editor.state.selection;
    const node = fixture.querySelector<HTMLElement>('.ProseMirror table [data-test-resource]')!;
    contextEvent(node);
    assert(receivedNodeContext === 1 && receivedPointer === 1 && !menu(), 'table menu swallowed node-view context');
    assert(editor.state.selection.eq(before), 'table context changed resource target');
  }),
  check("Rich clipboard failure falls back to plain text", async () => {
    let copied = ''; stubClipboard({ write: async () => { throw new Error('Rich clipboard denied'); }, writeText: async (value: string) => { copied = value; } });
    selectText(3); await open(3); await choose('Copy'); await until(() => copied === 'Alpha', 'plain-text copy fallback');
  }),
  check("Copy failure shows an error and keeps the document intact", async () => {
    const execCommand = document.execCommand;
    document.execCommand = () => false;
    try {
      stubClipboard({ write: async () => { throw new Error('Denied'); }, writeText: async () => { throw new Error('Denied'); } });
      selectText(3); const before = JSON.stringify(editor.getJSON()); await open(3); await choose('Copy');
      await until(() => document.querySelector('[role="alert"]'), 'copy error notice');
      assert(JSON.stringify(editor.getJSON()) === before, 'failed copy changed document');
    } finally { document.execCommand = execCommand; }
  }),
  check("Paste passes through the editor schema without introducing script or event handlers", async () => {
    stubClipboard({ read: async () => [clipboardItem('<p onclick="throw 1">Safe<script>throw 2</script></p>')] });
    selectText(3); await open(3); await choose('Paste');
    assert(cells()[3].textContent === 'Safe' && !cells()[3].querySelector('script,[onclick]'), `unsafe HTML entered document: ${cells()[3].innerHTML}`);
  }),
  check("Keyboard menu preserves selected text after touch, and Escape restores focus", async () => {
    contextEvent(cells()[3], { pointerType: 'touch' }); selectText(3); const selection = editor.state.selection;
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
    await until(menu, 'keyboard menu'); assert(editor.state.selection.eq(selection) && menuItem('Copy')?.getAttribute('aria-disabled') !== 'true', 'keyboard selection lost');
    await pause(); await close(); await until(() => document.activeElement === editor.view.dom, 'focus restored after menu animation');
  }),
  check("Keyboard context outside the editor cannot act on a stale table selection", async () => {
    setCursor(3);
    const button = fixture.querySelector<HTMLElement>('#node-view')!;
    const event = new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true });
    button.dispatchEvent(event); await pause();
    assert(!event.defaultPrevented && !menu(), 'wrapper button opened the table menu');
  }),
  check("Table commands and paste restore focus after the modal focus scope exits", async () => {
    let trappedFocus = false;
    const focus = editor.view.dom.focus.bind(editor.view.dom);
    editor.view.dom.focus = (options) => {
      if (document.querySelector('[role="menu"]')) { trappedFocus = true; return; }
      focus(options);
    };
    setCursor(3); await open(4); await choose('Add row below');
    await until(() => editor.view.hasFocus(), 'focus restored after table action');
    editor.commands.undo(); selectText(3); await open(3); await choose('Paste');
    await until(() => cells()[3].textContent === 'Pasted' && editor.view.hasFocus(), 'focus restored after paste');
    assert(!trappedFocus, 'editor was focused while the modal menu still existed');
  }),
  check("Menu is kept within the viewport near its lower right edge", async () => {
    setCursor(3); await open(3, 0, true); const rect = menu()!.getBoundingClientRect();
    assert(rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1, `menu outside viewport: ${JSON.stringify(rect)}`); await close();
  }),
  check("Read-only editor leaves context menu native", async () => {
    await mount(true); assert(!contextEvent(cells()[3]).defaultPrevented && !menu(), 'read-only context overridden');
  }),
];

// AX text offsets differ between browsers for tables. These manual controls set
// an exact PM selection, while Copy/Paste still use the real browser clipboard.
const manualControls = document.createElement('div'); manualControls.hidden = true;
for (const [label, table, index] of [['Select Alpha and open menu', 0, 3], ['Select Other and open menu', 1, 0]] as const) {
  const button = document.createElement('button'); button.textContent = label;
  button.style.cssText = 'border:1px solid;padding:8px';
  button.addEventListener('click', () => {
    const cell = cells(table)[index]; cell.scrollIntoView({ block: 'center' });
    const pos = cellPos(index, table) + 1;
    editor.commands.setTextSelection({ from: pos, to: pos + cell.textContent!.length }); editor.view.focus();
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
  });
  manualControls.appendChild(button);
}
document.getElementById('summary')!.parentNode!.insertBefore(manualControls, document.getElementById('summary'));

document.getElementById('run')!.addEventListener('click', async () => {
  manualControls.hidden = true;
  const button = document.getElementById('run') as HTMLButtonElement; button.disabled = true;
  const results = document.getElementById('results')!; results.replaceChildren(); let passed = 0;
  for (const test of checks) {
    document.getElementById('summary')!.textContent = `Running ${test.name}`;
    const result = document.createElement('li');
    try { await mount(); await test.run(); passed++; result.textContent = `PASS: ${test.name}`; }
    catch (error) { result.textContent = `FAIL: ${test.name}: ${error instanceof Error ? error.message : String(error)}`; result.style.color = 'red'; }
    results.appendChild(result);
  }
  root?.unmount(); root = undefined; if (editor && !editor.isDestroyed) editor.destroy(); restoreClipboard(); restoreDesktop();
  document.getElementById('summary')!.textContent = `${passed}/${checks.length} passed`; button.disabled = false;
});

document.getElementById('demo')!.addEventListener('click', async () => {
  await mount(); restoreClipboard();
  document.getElementById('results')!.replaceChildren(); manualControls.hidden = false;
  const browserClipboard = navigator.clipboard;
  stubClipboard({
    read: () => browserClipboard.read(), readText: () => browserClipboard.readText(),
    writeText: (text: string) => browserClipboard.writeText(text),
    write: async (items: ClipboardItem[]) => {
      await browserClipboard.write(items);
      try {
        const expected = await (await items[0].getType('text/plain')).text();
        const actual = await browserClipboard.readText();
        document.getElementById('summary')!.textContent = expected === actual
          ? `Real clipboard verified: ${JSON.stringify(actual)}`
          : `Clipboard mismatch: expected ${JSON.stringify(expected)}, read ${JSON.stringify(actual)}`;
      } catch {
        document.getElementById('summary')!.textContent = 'Clipboard write completed; read-back permission was not available.';
      }
    },
  });
  document.getElementById('summary')!.textContent = 'Manual fixture ready: use real mouse and keyboard input. Clipboard access uses the browser normally.';
});
