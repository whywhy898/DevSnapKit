import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Run the real component with deterministic DOM, layout effects and animation frames.
function harness() {
  const effects = [], frames = [], dialogs = [], listeners = new Map();
  const document = {
    activeElement: null,
    querySelectorAll: () => dialogs,
    querySelector: () => toolbar,
    addEventListener: (name, fn) => listeners.set(fn, name),
    removeEventListener: (_name, fn) => listeners.delete(fn),
  };
  class Element {
    isConnected = true;
    tabIndex = 0;
    constructor(parent = null) { this.parent = parent; }
    focus() { if (this.isConnected) document.activeElement = this; }
    contains(element) { return element === this || element?.parent === this; }
    closest() { return this.parent; }
    matches() { return false; }
    getClientRects() { return [1]; }
  }
  document.body = new Element();
  const toolbar = new Element();
  document.activeElement = document.body;
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(new URL('../src/Modal.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, document, HTMLElement: Element,
    requestAnimationFrame: fn => frames.push(fn),
    require: name => name === 'react' ? { useRef: current => ({ current }), useLayoutEffect: fn => effects.push(fn) }
      : { jsx: (type, props) => ({ type, props }) },
  });
  return {
    document, Element,
    tick() { frames.splice(0).forEach(fn => fn()); },
    open({ autofocus = false } = {}) {
      let closed = false;
      const output = module.exports.Modal({ onClose: () => { closed = true; }, children: null });
      const node = new Element(), close = new Element(node), input = new Element(node);
      node.querySelector = () => close;
      node.querySelectorAll = () => [close, input];
      output.props.ref.current = node;
      dialogs.push(node);
      if (autofocus) input.focus();
      const setup = effects.shift();
      let cleanup = setup();
      // Match the browser runner's React StrictMode layout-effect replay.
      cleanup(); cleanup = setup();
      return { node, input, close, get closed() { return closed; },
        click(target) { output.props.onClick?.({ target, currentTarget: node }); },
        escape() { for (const [fn, name] of listeners) if (name === 'keydown') fn({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} }); },
        unmount() {
          cleanup();
          dialogs.splice(dialogs.indexOf(node), 1);
          for (const element of [node, close, input]) element.isConnected = false;
          if (node.contains(document.activeElement)) document.activeElement = document.body;
        },
      };
    },
  };
}

test('modal restores its opener after Escape or a close-button unmount', () => {
  for (const escape of [true, false]) {
    const h = harness(), opener = new h.Element();
    opener.focus();
    const dialog = h.open();
    dialog.input.focus();
    if (escape) { dialog.escape(); assert.equal(dialog.closed, true); }
    dialog.unmount(); h.tick();
    assert.equal(h.document.activeElement, opener);
  }
});

test('backdrop dismisses, while clicks inside a modal do not', () => {
  const h = harness(), opener = new h.Element(); opener.focus();
  const dialog = h.open();
  dialog.click(dialog.input); assert.equal(dialog.closed, false);
  dialog.click(dialog.node); assert.equal(dialog.closed, true);
  dialog.unmount(); h.tick();
  assert.equal(h.document.activeElement, opener);
});

test('a new Key-style opener supersedes a pending restoration from another modal', () => {
  const h = harness(), pro = new h.Element(), key = new h.Element();
  pro.focus(); const first = h.open(); first.unmount();
  key.focus(); const claim = h.open();
  h.tick(); claim.escape(); claim.unmount(); h.tick();
  assert.equal(h.document.activeElement, key);
});

test('stacked dialogs restore the focused field in the underlying modal, then its opener', () => {
  const h = harness(), opener = new h.Element(); opener.focus();
  const first = h.open(); first.input.focus();
  const second = h.open(); second.unmount(); h.tick();
  assert.equal(h.document.activeElement, first.input);
  first.unmount(); h.tick();
  assert.equal(h.document.activeElement, opener);
});

test('dialog-to-dialog handoff retains the original opener', () => {
  const h = harness(), opener = new h.Element(); opener.focus();
  const first = h.open(); first.unmount();
  const second = h.open(); h.tick(); second.unmount(); h.tick();
  assert.equal(h.document.activeElement, opener);
});

test('descendant autofocus cannot replace the original opener', () => {
  const h = harness(), opener = new h.Element(); opener.focus();
  const dialog = h.open({ autofocus: true });
  dialog.unmount(); h.tick();
  assert.equal(h.document.activeElement, opener);
});
