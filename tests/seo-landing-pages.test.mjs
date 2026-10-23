import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const publicRoot = new URL('../public/', import.meta.url);
const slugs = ['screenshot-beautifier', 'og-image-generator', 'product-hunt-image-maker', 'add-text-to-image'];
const read = path => readFileSync(new URL(path, publicRoot), 'utf8');

test('all landing pages expose a distinct, crawlable canonical document', () => {
  const titles = new Set();
  for (const slug of slugs) {
    const html = read(`${slug}/index.html`);
    const canonical = `https://devsnapkit.com/${slug}/`;
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.ok(title, slug);
    titles.add(title);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, slug);
    assert.match(html, new RegExp(`<link rel="canonical" href="${canonical}">`));
    assert.ok(html.includes(`<meta property="og:url" content="${canonical}">`));
    for (const tag of ['description', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
      assert.ok(html.includes(`<meta name="${tag}" content="`), `${slug}: ${tag}`);
    }
    assert.equal((html.match(/<details>/g) || []).length, 6, `${slug}: FAQ`);
    for (const section of ['hero', 'comparison-section', 'workflow-section', 'details-section', 'use-section', 'faq-section', 'closing']) {
      assert.ok(html.includes(`class="${section}`), `${slug}: ${section}`);
    }
    assert.ok(html.includes('href="/seo/landing.css"'));
    assert.ok(html.includes('src="/seo/landing.js"'));
    for (const href of html.matchAll(/href="([^"#]+)"/g)) {
      if (href[1].startsWith('/?')) assert.equal(href[1], '/?editor=1');
    }
    for (const target of slugs) assert.ok(html.includes(`href="/${target}/"`), `${slug} links ${target}`);
  }
  assert.equal(titles.size, slugs.length);
});

test('new pages identify one original/export case and three proposed scenarios', () => {
  for (const [slug, prefix, width, height] of [
    ['og-image-generator', 'og', 1200, 630],
    ['product-hunt-image-maker', 'ph', 1600, 1200],
    ['add-text-to-image', 'text', 1200, 900],
  ]) {
    const html = read(`${slug}/index.html`);
    assert.equal((html.match(/data-scenario/g) || []).length, 3, slug);
    assert.ok(html.includes(`href="/seo/examples/${prefix}-original.png"`));
    assert.ok(html.includes(`href="/seo/examples/${prefix}-styled.png"`));
    assert.ok(html.includes(`content="https://devsnapkit.com/seo/examples/${prefix}-styled.png"`));
    assert.ok(html.includes(`width="${width}" height="${height}"`));
    assert.ok(html.includes('Public-page styling demonstrations, not customer endorsements.'));
  }
});

test('sitemap publishes exactly the homepage and four canonical tools', () => {
  const urls = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(urls.sort(), ['https://devsnapkit.com/', ...slugs.map(slug => `https://devsnapkit.com/${slug}/`)].sort());
});

test('shared presentation keeps new image ratios intrinsic and reduced-motion content visible', () => {
  const css = read('seo/landing.css');
  assert.match(css, /\.task-page \.finished-shot img\{[^}]*aspect-ratio:auto/);
  assert.match(css, /\.task-page \.compare-stage\{[^}]*aspect-ratio:var\(--case-ratio\)/);
  assert.match(css, /\.task-page \.compare-after img\{[^}]*object-fit:contain/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.js-motion \.reveal\{opacity:1;transform:none\}/);
  const script = read('seo/landing.js');
  assert.match(script, /aria-valuetext/);
  assert.match(script, /reducedMotion/);
});
