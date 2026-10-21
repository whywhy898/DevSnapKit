import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Executes the real hook with deterministic effect and timer scheduling, including
// App's memoized same-value restores. Browser tests exercise the same user paths.
function harness() {
  const slots = [], effects = [], layouts = [], timers = new Map();
  let cursor = 0, nextTimer = 0, snapshot = { v: 0 }, output, restores = 0;
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  function effect(queue, fn, deps) {
    const i = cursor++, prev = slots[i];
    if (!prev || !sameDeps(prev.deps, deps)) {
      queue.push(() => { prev?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    }
  }
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; slots[i] ??= { value }; return [slots[i].value, n => { slots[i].value = typeof n === 'function' ? n(slots[i].value) : n; }]; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || !sameDeps(slots[i].deps, deps)) slots[i] = { value: fn, deps }; return slots[i].value; },
    useEffect(fn, deps) { effect(effects, fn, deps); },
    useLayoutEffect(fn, deps) { effect(layouts, fn, deps); },
  };
  const compile = file => ts.transpileModule(fs.readFileSync(new URL(`../src/${file}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const model = { exports: {} };
  vm.runInNewContext(compile('editorHistory'), { exports: model.exports, module: model });
  const module = { exports: {} };
  vm.runInNewContext(compile('useHistory'), { exports: module.exports, module,
    require: name => name === 'react' ? react : model.exports,
    setTimeout: fn => { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const restore = next => { restores++; if (JSON.stringify(snapshot) !== JSON.stringify(next)) snapshot = next; };
  const render = () => { cursor = 0; output = module.exports.useEditorHistory(snapshot, restore); while (layouts.length) layouts.shift()(); while (effects.length) effects.shift()(); return output; };
  render();
  return { get api() { return output; }, get snapshot() { return snapshot; }, get restores() { return restores; }, render,
    edit(v) { snapshot = { v }; render(); },
    tick() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); render(); },
  };
}
test('same-value cancel and empty undo do not stall subsequent effect recording', () => {
  for (const action of ['cancel', 'undo']) {
    const h = harness();
    if (action === 'cancel') { h.api.beginTransaction(); h.render(); h.api.cancelTransaction(); }
    else h.api.undo();
    h.render(); h.edit(1); h.tick();
    assert.equal(h.api.historyCount, 2, action);
    h.api.undo(); h.render(); assert.equal(h.snapshot.v, 0);
  }
});
test('redo cannot restore over pending changes, or cause a no-future restore', () => {
  const h = harness();
  h.edit(1); h.api.redo(); h.render();
  assert.equal(h.snapshot.v, 1, 'pending background edit must survive Ctrl+Y');
  h.tick(); assert.equal(h.api.historyCount, 2);
  const before = h.restores; h.api.redo(); h.render();
  assert.equal(h.restores, before, 'no redo means no restore callback');
  h.api.undo(); h.render(); h.edit(2); h.api.redo(); h.render();
  assert.equal(h.snapshot.v, 2, 'pending change after Undo is a new branch');
});
