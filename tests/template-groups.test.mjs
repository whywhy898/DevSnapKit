import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const file = new URL('../src/templates/templateGroups.ts', import.meta.url);
const groups = fs.existsSync(file) ? createTypeScriptLoader(root)('templates/templateGroups.ts') : {};

test('template sizes use precise ratios and explicit shared social group', () => {
  assert.equal(typeof groups.templateRatio, 'function', 'ratio grouping must exist');
  for (const [width, height, exact, key] of [[1200,630,'40:21','1.91:1'],[1200,628,'300:157','1.91:1'],[1920,1080,'16:9','16:9'],[1600,1200,'4:3','4:3'],[1080,1080,'1:1','1:1'],[1080,1350,'4:5','4:5'],[1080,1920,'9:16','9:16'],[1000,777,'1000:777','1000:777']]) {
    assert.deepEqual(JSON.parse(JSON.stringify(groups.templateRatio(width,height))), {exact, key});
  }
});

test('each catalog entry appears once and ratio filtering returns the whole group', () => {
  assert.equal(typeof groups.groupTemplates, 'function');
  const input = [{id:'a',width:1200,height:630},{id:'b',width:1200,height:628},{id:'c',width:1080,height:1080},{id:'d',width:1000,height:777}];
  const result = groups.groupTemplates(input);
  assert.deepEqual(Array.from(result, g => g.key), ['1.91:1','1:1','1000:777']);
  assert.deepEqual(Array.from(result[0].items, x => x.id), ['a','b']);
  assert.equal(result.flatMap(g => g.items).length, input.length);
});
