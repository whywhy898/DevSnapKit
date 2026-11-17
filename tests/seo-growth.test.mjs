import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = f => fs.readFileSync(new URL(f, root), 'utf8');
const tools = ['screenshot-beautifier', 'og-image-generator', 'product-hunt-image-maker', 'add-text-to-image'];
const pages = fs.readdirSync(new URL('public/', root), { withFileTypes: true }).filter(e => e.isDirectory() && fs.existsSync(new URL(`public/${e.name}/index.html`, root))).map(e => `public/${e.name}/index.html`);
test('public copy and structured data contain no retired DevSnapKit prices or annotation denials', () => {
  for (const file of ['index.html', ...pages]) {
    const html = read(file);
    assert.doesNotMatch(html, /\$1(?!\d|\.\d)|\$1 USD|<(?:s|del)>\s*\$29\b|There is no arrow tool|does not capture, record or annotate with arrows|no annotation tool/i, file);
  }
});
test('original H1 breaks preserve word boundaries and FAQs have matching structured data', () => {
  for (const slug of tools) {
    const html = read(`public/${slug}/index.html`);
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1];
    assert.doesNotMatch(h1, /\S<br\s*\/?>(?:<span[^>]*>)?\S/, slug);
    const graphs = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(m => { const d = JSON.parse(m[1]); return d['@graph'] || [d]; });
    assert.ok(graphs.some(d => d['@type'] === 'SoftwareApplication'), slug);
    assert.ok(graphs.some(d => d['@type'] === 'WebPage'), slug);
    const faq = graphs.find(d => d['@type'] === 'FAQPage');
    assert.equal(faq?.mainEntity.length, (html.match(/<details>/g) || []).length, slug);
    const strip = s => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&');
    [...html.matchAll(/<details><summary>(.*?)<\/summary><p>(.*?)<\/p><\/details>/g)].forEach((m, i) => {
      assert.equal(faq.mainEntity[i].name, strip(m[1]));
      assert.equal(faq.mainEntity[i].acceptedAnswer.text, strip(m[2]));
    });
  }
});
test('annotation landing exposes metadata FAQ and contextual links', () => {
  const html = read('public/screenshot-annotation-tool/index.html');
  for (const term of ['<title>', 'name="description"', 'rel="canonical"', '<h1', 'FAQPage', 'SoftwareApplication', 'arrows', 'boxes', 'highlights', 'text']) assert.ok(html.includes(term), term);
  for (const file of ['index.html', ...tools.map(s => `public/${s}/index.html`), ...['before-after-screenshot', 'cleanshot-alternative', 'xnapper-alternative'].map(s => `public/${s}/index.html`)]) assert.ok(read(file).includes('href="/screenshot-annotation-tool/"'), file);
});
test('sitemap contains annotation page and derives each lastmod from its own source', () => {
  const xml = read('public/sitemap.xml');
  assert.ok(xml.includes('<loc>https://devsnapkit.com/screenshot-annotation-tool/</loc>'));
  for (const m of xml.matchAll(/<loc>https:\/\/devsnapkit.com(.*?)<\/loc>\s*<lastmod>(.*?)<\/lastmod>/g)) {
    const source = m[1] === '/' ? 'index.html' : /\/(privacy|terms)\//.test(m[1]) ? 'src/legal/legalContent.json' : `public${m[1]}index.html`;
    const changed = execFileSync('git', ['status', '--porcelain', '--', source], { cwd: root, encoding: 'utf8' }).trim();
    const date = changed ? new Date().toISOString().slice(0, 10) : execFileSync('git', ['log', '-1', '--format=%cs', '--', source], { cwd: root, encoding: 'utf8' }).trim();
    assert.equal(m[2], date, path.basename(source) + m[1]);
  }
});
