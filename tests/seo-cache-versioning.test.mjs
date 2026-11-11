import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 10);

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : /\.html$/i.test(entry.name) ? [file] : [];
  });
}

test('production HTML versions every SEO stylesheet and script with its content hash', { timeout: 180_000 }, () => {
  const sourceFiles = htmlFiles(path.join(root, 'public'));
  // The existing legal-page generator normalizes Windows line endings.
  const sourceHash = file => hash(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
  const sources = sourceFiles.map(sourceHash);
  execSync(`npm --prefix "${path.resolve(root)}" run build`, { cwd: root, stdio: 'pipe', timeout: 170_000 });
  sourceFiles.forEach((file, i) => assert.equal(sourceHash(file), sources[i], `${file}: build changed public HTML`));

  const dist = path.join(root, 'dist');
  const seen = new Set();
  const pages = htmlFiles(dist);
  assert.ok(pages.includes(path.join(dist, 'index.html')), 'include the built homepage');
  for (const file of pages) {
    const html = readFileSync(file, 'utf8');
    // Scan all occurrences, including preloads, inline code and template contents.
    for (const [reference] of html.matchAll(/\/seo\/[^\s"'<>?#]+\.(?:css|js)(?:\?[^\s"'<>#]*)?(?:#[^\s"'<>]*)?/g)) {
      const url = new URL(reference.replace(/&amp;/g, '&'), 'https://devsnapkit.com');
      const expected = hash(readFileSync(path.join(dist, decodeURIComponent(url.pathname))));
      assert.deepEqual(url.searchParams.getAll('v'), [expected], `${path.relative(dist, file)}: ${reference}`);
      assert.match(url.search, /^\?v=[0-9a-f]{10}(?:&|$)/, reference);
      seen.add(url.pathname);
    }
  }
  for (const asset of ['landing.css', 'landing.js', 'guide.css', 'attribution.js', 'legal.css', 'text-guide.css', 'text-demo.js']) {
    assert.ok(seen.has(`/seo/${asset}`), `${asset}: expected built HTML coverage`);
  }
});

test('built headers require HTML revalidation on file and clean URLs', () => {
  const dist = path.join(root, 'dist');
  const headers = readFileSync(path.join(dist, '_headers'), 'utf8');
  assert.equal(headers, readFileSync(path.join(root, 'public/_headers'), 'utf8'), 'preserve all deployment headers');
  const rules = [];
  let rule;
  for (const line of headers.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      rule = { pattern: line.trim(), cache: [] };
      rules.push(rule);
    } else if (/^\s*Cache-Control:/i.test(line)) {
      rule.cache.push(line.slice(line.indexOf(':') + 1).trim());
    }
  }
  for (const file of htmlFiles(dist)) {
    const pathname = '/' + path.relative(dist, file).split(path.sep).join('/');
    const urls = [pathname, pathname.replace(/index\.html$/, ''), pathname.replace(/(?:\/index)?\.html$/, '') || '/'];
    for (const url of urls) {
      const policy = rules.filter(({ pattern }) => {
        const regex = pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
        return new RegExp(`^${regex}$`).test(url);
      }).flatMap(rule => rule.cache).join(', ');
      assert.ok(/\bno-cache\b|\bno-store\b/i.test(policy) || (/\bmax-age=0\b/i.test(policy) && /\bmust-revalidate\b/i.test(policy)), `${url}: ${policy}`);
      assert.doesNotMatch(policy, /\b(?:s-maxage|max-age)=[1-9]\d*\b|\bimmutable\b/i, `${url}: long HTML caching`);
    }
  }
});

test('versioning handles nested HTML, new SEO assets and existing query strings repeatably', async () => {
  const { versionSeoAssets } = await import('../scripts/version-seo-assets.mjs');
  const dist = mkdtempSync(path.join(tmpdir(), 'seo-versioning-'));
  try {
    mkdirSync(path.join(dist, 'seo/nested'), { recursive: true });
    mkdirSync(path.join(dist, 'guide'), { recursive: true });
    writeFileSync(path.join(dist, 'seo/nested/future.css'), 'body { color: red; }');
    writeFileSync(path.join(dist, 'seo/future.js'), 'console.log("first");');
    const html = path.join(dist, 'guide/index.html');
    writeFileSync(html, `<template><link href='/seo/nested/future.css?theme=dark&amp;v=old#top'></template><script src=/seo/future.js></script><img src="/seo/example.webp"><script src="/assets/app.js"></script>`);
    versionSeoAssets(dist);
    const first = readFileSync(html, 'utf8');
    assert.ok(first.includes(`/seo/nested/future.css?v=${hash(readFileSync(path.join(dist, 'seo/nested/future.css')))}&amp;theme=dark#top`));
    assert.ok(first.includes(`/seo/future.js?v=${hash(readFileSync(path.join(dist, 'seo/future.js')))}`));
    assert.ok(first.includes('src="/seo/example.webp"'));
    assert.ok(first.includes('src="/assets/app.js"'));
    versionSeoAssets(dist);
    assert.equal(readFileSync(html, 'utf8'), first, 'a second run must be idempotent');
    writeFileSync(path.join(dist, 'seo/future.js'), 'console.log("changed");');
    versionSeoAssets(dist);
    assert.ok(readFileSync(html, 'utf8').includes(`/seo/future.js?v=${hash(readFileSync(path.join(dist, 'seo/future.js')))}`));
    assert.notEqual(readFileSync(html, 'utf8'), first, 'changed bytes must change the URL');
    writeFileSync(html, '<script src="/seo/missing.js"></script>');
    assert.throws(() => versionSeoAssets(dist), /missing\.js/, 'missing assets must fail the build');
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});
