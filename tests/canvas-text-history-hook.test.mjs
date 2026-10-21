import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Executes the real hook with deterministic effect and timer scheduling, including
// App's memoized same-value restores. Browser tests exercise the same user paths.
function harness({ delayedRestore = false } = {}) {
  const slots = [], effects = [], layouts = [], timers = new Map();
  let cursor = 0, nextTimer = 0, snapshot = { v: 0 }, output, restores = 0, awaitingRestore;
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
  const restore = next => { restores++; if (delayedRestore) awaitingRestore = next; else if (JSON.stringify(snapshot) !== JSON.stringify(next)) snapshot = next; };
  const render = () => { cursor = 0; output = module.exports.useEditorHistory(snapshot, restore); while (layouts.length) layouts.shift()(); while (effects.length) effects.shift()(); return output; };
  render();
  return { get api() { return output; }, get snapshot() { return snapshot; }, get restores() { return restores; }, render,
    edit(v) { snapshot = { v }; render(); },
    acknowledgeRestore() { assert.ok(awaitingRestore); snapshot = awaitingRestore; awaitingRestore = undefined; render(); },
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

test('delayed restore acknowledgement suppresses recording until the restored render actually arrives', () => {
  const h = harness({ delayedRestore: true });
  h.edit(1); h.tick(); h.edit(2); h.tick();
  h.api.undo(); h.render();
  assert.equal(h.snapshot.v, 2, 'React has not delivered the restored render yet');
  h.tick(); h.tick();
  assert.equal(h.api.historyCount, 3, 'No timer can append the stale render during restoration');
  assert.equal(h.api.historyIndex, 1);
  h.acknowledgeRestore(); h.tick();
  assert.equal(h.snapshot.v, 1); assert.equal(h.api.canRedo, true);
  h.edit(3); h.tick();
  assert.equal(h.api.historyCount, 3); assert.equal(h.api.canRedo, false);
  h.api.undo(); h.render(); h.acknowledgeRestore();
  assert.equal(h.snapshot.v, 1, 'A subsequent ordinary edit is recorded after acknowledgement');
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
test('conditional undo checks the live snapshot and cancel does not masquerade as navigation', () => {
  const h = harness(); h.edit(1); h.tick();
  const id = h.api.getCommitId(), revision = h.api.navigationRevision;
  h.api.beginTransaction(); h.render(); h.api.cancelTransaction(); h.render();
  assert.equal(h.api.navigationRevision, revision);
  h.edit(2); assert.equal(h.api.undoCommit(id), false); assert.equal(h.snapshot.v, 2);
  h.tick(); const nextId = h.api.getCommitId(); assert.notEqual(id, nextId);
  assert.equal(h.api.undoCommit(nextId), true); h.render();
  assert.equal(h.snapshot.v, 1); assert.equal(h.api.navigationRevision, revision + 1);
});
