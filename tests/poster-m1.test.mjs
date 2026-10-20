import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('M1 has a shared DOM renderer and export entry', () => {
  const dir = new URL('../src/poster/', import.meta.url);
  assert.ok(fs.existsSync(new URL('editorialHoney.tsx', dir)), 'Poster renderer is not implemented');
  const renderer = fs.readFileSync(new URL('editorialHoney.tsx', dir), 'utf8');
  assert.match(renderer, /MockupUnit/);
  assert.match(renderer, /<mark/);
  const exporter = fs.readFileSync(new URL('exportPoster.ts', dir), 'utf8');
  assert.match(exporter, /getFontEmbedCSS/);
  assert.doesNotMatch(exporter, /skipFonts:\s*true/);
});
