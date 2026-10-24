import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/export/artworkTasks.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports });
const { ArtworkTasks } = module.exports;
test('late replaced upload cannot unlock Apply while a newer upload is preparing', async () => {
  const notifications = [], applied = [];
  const tasks = new ArtworkTasks(message => assert.fail(message), busy => notifications.push(busy));
  let first, second;
  const a = tasks.run('main', 'First', () => new Promise(resolve => { first = resolve; }), value => applied.push(value));
  await Promise.resolve();
  const b = tasks.run('main', 'Second', () => new Promise(resolve => { second = resolve; }), value => applied.push(value));
  await Promise.resolve(); first('stale'); await a;
  assert.equal(tasks.pending, true); assert.equal(notifications.at(-1), true); assert.deepEqual(applied, []);
  second('current'); await b;
  assert.equal(tasks.pending, false); assert.equal(notifications.at(-1), false); assert.deepEqual(applied, ['current']);
});
test('clearing one slot keeps Apply disabled for the other pending slot', async () => {
  const notifications = [], tasks = new ArtworkTasks(message => assert.fail(message), busy => notifications.push(busy));
  let first, second;
  const a = tasks.run('main', 'Main', () => new Promise(resolve => { first = resolve; }), () => {});
  const b = tasks.run('secondary', 'Secondary', () => new Promise(resolve => { second = resolve; }), () => {});
  await Promise.resolve(); tasks.clear('main'); assert.equal(notifications.at(-1), true);
  first(); await a; assert.equal(notifications.at(-1), true);
  second(); await b; assert.equal(notifications.at(-1), false);
});
