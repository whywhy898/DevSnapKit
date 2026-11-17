import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const script = new URL('../scripts/build-revision.mjs', import.meta.url);

test('build revision generator is available without runtime bindings', async () => {
  assert.ok(fs.existsSync(fileURLToPath(script)), 'a safe build revision generator must exist');
  const { buildRevision } = await import(script);
  assert.deepEqual(buildRevision({}), { revision: null, source: 'unavailable', verification: 'build-input-only' });
});

test('build revision publishes only an explicitly supplied full SHA', async () => {
  assert.ok(fs.existsSync(fileURLToPath(script)), 'a safe build revision generator must exist');
  const { buildRevision } = await import(script);
  const sha = 'a'.repeat(40);
  for (const source of ['BUILD_REVISION', 'CF_PAGES_COMMIT_SHA']) {
    assert.deepEqual(buildRevision({ [source]: sha, UNRELATED_SECRET: 'never publish me' }), {
      revision: sha, source, verification: 'build-input-only',
    });
  }
  for (const value of ['22274d3', 'main', 'a'.repeat(39), '<script>', '../secret', 'a'.repeat(40) + '\n']) {
    assert.throws(() => buildRevision({ BUILD_REVISION: value }), /full lowercase 40-character/);
  }
  assert.throws(() => buildRevision({ BUILD_REVISION: sha, CF_PAGES_COMMIT_SHA: 'b'.repeat(40) }), /disagree/);
});
