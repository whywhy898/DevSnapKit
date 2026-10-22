import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
async function load() {
  const source = ts.transpileModule(fs.readFileSync(new URL('../src/export/artworkTasks.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
test('asset admission waits for the latest operation and stale completions never overwrite a newer image', async () => {
  const { ArtworkTasks } = await load(); const tasks = new ArtworkTasks(message => assert.fail(message));
  const applied = []; let old, current;
  tasks.run('main', 'Main screenshot', () => new Promise(resolve => { old = resolve; }), value => applied.push(value));
  await Promise.resolve();
  tasks.run('main', 'Main screenshot', () => new Promise(resolve => { current = resolve; }), value => applied.push(value));
  await Promise.resolve(); let ready = false;
  const waiting = tasks.settle().then(() => { ready = true; });
  old('old'); await Promise.resolve(); assert.equal(ready, false);
  current('new'); await waiting; assert.deepEqual(applied, ['new']);
});
test('asset errors are named, do not apply failed data, and recover by replacement or explicit removal', async () => {
  const { ArtworkTasks } = await load(); const errors = [], applied = [];
  const tasks = new ArtworkTasks(message => errors.push(message));
  await tasks.run('background', 'Canvas background', async () => { throw new Error('decode failed'); }, value => applied.push(value));
  await assert.rejects(tasks.settle(), /Canvas background.*decode failed.*Replace/); assert.deepEqual(applied, []);
  await tasks.run('background', 'Canvas background', async () => 'valid', value => applied.push(value));
  await tasks.settle(); assert.deepEqual(applied, ['valid']); assert.equal(errors.length, 1);
  await tasks.run('logo', 'Brand logo', async () => { throw new Error('bad'); }, () => assert.fail());
  await tasks.settle(['main']);
  await assert.rejects(tasks.settle(['logo']), /Brand logo.*bad/, 'An unused failed asset can be ignored without losing its active-slot diagnostic');
  tasks.clear('logo'); await tasks.settle();
});
