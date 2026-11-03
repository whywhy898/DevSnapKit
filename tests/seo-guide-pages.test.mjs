import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('public/', root);
const read = path => readFileSync(new URL(path, publicRoot), 'utf8');
const guides = JSON.parse(readFileSync(new URL('tests/fixtures/seo-guides.json', root), 'utf8'));
const tools = ['screenshot-beautifier', 'og-image-generator', 'product-hunt-image-maker', 'add-text-to-image'];
const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const strip = html => decode(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const appSource = readFileSync(new URL('src/App.tsx', root), 'utf8');

// Editor entry parameters the studio actually reads (src/App.tsx entryParams).
const supported = {
  editor: ['1'],
  aspect: ['og', 'twitter'],
  mode: ['duo'],
};

test('guide fixture lists fifteen distinct slugs, nine use cases and six comparisons', () => {
  assert.equal(guides.length, 15);
  assert.equal(new Set(guides.map(g => g.slug)).size, 15);
  assert.equal(guides.filter(g => g.kind === 'cmp').length, 6);
  assert.ok(guides.filter(g => g.kind === 'cmp').every(g => g.slug.endsWith('-alternative')));
  for (const g of guides) assert.ok(!tools.includes(g.slug), `${g.slug} must not replace a tool page`);
});

test('supported editor params are really read by the studio', () => {
  assert.match(appSource, /\['og', 'twitter'\]\.includes\(entryParams\.get\('aspect'\)/);
  assert.match(appSource, /entryParams\.get\('mode'\) === 'duo'/);
});

for (const guide of guides) {
  test(`${guide.slug}: indexable metadata, single H1 and social tags`, () => {
    const html = read(`${guide.slug}/index.html`);
    const canonical = `https://devsnapkit.com/${guide.slug}/`;
    const title = decode(html.match(/<title>([^<]+)<\/title>/)[1]);
    assert.equal(title, guide.title);
    assert.ok(title.endsWith(' | DevSnapKit'));
    assert.ok(title.length <= 65, `${guide.slug}: title length ${title.length}`);
    const desc = decode(html.match(/<meta name="description" content="([^"]+)">/)[1]);
    assert.ok(desc.length >= 110 && desc.length <= 170, `${guide.slug}: description length ${desc.length}`);
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`));
    assert.ok(html.includes(`<meta property="og:url" content="${canonical}">`));
    for (const tag of ['og:title', 'og:description', 'og:image', 'og:type']) assert.ok(html.includes(`<meta property="${tag}" content="`), `${guide.slug}: ${tag}`);
    for (const tag of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) assert.ok(html.includes(`<meta name="${tag}" content="`), `${guide.slug}: ${tag}`);
    assert.doesNotMatch(html, /name="robots"[^>]*noindex/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.ok(html.includes('href="/seo/landing.css"') && html.includes('href="/seo/guide.css"') && html.includes('src="/seo/landing.js"'));
  });

  test(`${guide.slug}: FAQ markup matches valid FAQPage JSON-LD`, () => {
    const html = read(`${guide.slug}/index.html`);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.equal(blocks.length, 1);
    const data = JSON.parse(blocks[0][1]);
    assert.equal(data['@context'], 'https://schema.org');
    assert.equal(data['@type'], 'FAQPage');
    const faq = [...html.matchAll(/<details><summary>([^<]+)<\/summary><p>([^<]+)<\/p><\/details>/g)];
    assert.ok(faq.length >= 3);
    assert.equal(data.mainEntity.length, faq.length);
    data.mainEntity.forEach((item, i) => {
      assert.equal(item['@type'], 'Question');
      assert.equal(item.name, decode(faq[i][1]));
      assert.equal(item.acceptedAnswer['@type'], 'Answer');
      assert.equal(item.acceptedAnswer.text, decode(faq[i][2]));
    });
  });

  test(`${guide.slug}: 300-600 words of main copy and a sized, lazy WebP example`, () => {
    const html = read(`${guide.slug}/index.html`);
    const main = html.match(/<main id="main">([\s\S]*)<\/main>/)[1].replace(/<section class="related[\s\S]*?<\/section>/, '');
    const words = strip(main).match(/[A-Za-z0-9][A-Za-z0-9’'×.\-/]*/g).length;
    assert.ok(words >= 300 && words <= 600, `${guide.slug}: ${words} words`);
    const img = html.match(/<figure class="guide-figure"><img ([^>]+)>/)[1];
    const src = img.match(/src="([^"]+)"/)[1];
    assert.match(src, /^\/seo\/examples\/lp-[a-z-]+\.webp$/);
    assert.ok(existsSync(new URL(src.slice(1), publicRoot)), src);
    assert.match(img, /width="\d+" height="\d+"/);
    assert.match(img, /loading="lazy"/);
    assert.match(img, /alt="[^"]{20,}"/);
  });

  test(`${guide.slug}: editor CTA uses only supported params and matches the floating card`, () => {
    const html = read(`${guide.slug}/index.html`);
    const entries = [...html.matchAll(/href="(\/\?[^"]+)"/g)].map(m => decode(m[1]));
    assert.ok(entries.length >= 2);
    assert.ok(html.includes(`data-studio-cta="${guide.cta.replace(/&/g, '&amp;')}"`));
    assert.ok(entries.filter(e => e === guide.cta).length >= 2, 'hero and closing CTA');
    for (const entry of entries) {
      const params = new URLSearchParams(entry.slice(2));
      assert.equal(params.get('editor'), '1', entry);
      for (const [key, value] of params) assert.ok(supported[key]?.includes(value), `${guide.slug}: unsupported ${key}=${value}`);
    }
    assert.doesNotMatch(html, /class="studio-cta/);
    const header = html.match(/<header class="site-header[\s\S]*?<\/header>/)[0];
    assert.doesNotMatch(header, /href="\/\?editor/);
  });

  test(`${guide.slug}: cross-links, guide navigation and legal footer`, () => {
    const html = read(`${guide.slug}/index.html`);
    const related = html.match(/<div class="related-grid">([\s\S]*?)<\/div><\/section>/)[1];
    const links = [...related.matchAll(/href="\/([a-z0-9-]+)\/"/g)].map(m => m[1]);
    assert.ok(links.length >= 3);
    assert.ok(!links.includes(guide.slug));
    for (const link of links) assert.ok(existsSync(new URL(`${link}/index.html`, publicRoot)), link);
    for (const other of guides) assert.ok(html.includes(`href="/${other.slug}/"`), `${guide.slug} -> ${other.slug}`);
    for (const tool of tools) assert.ok(html.includes(`href="/${tool}/"`), `${guide.slug} -> ${tool}`);
    const footer = html.match(/<footer[\s\S]*?<\/footer>/)[0];
    assert.ok(footer.includes('href="/terms/"') && footer.includes('href="/privacy/"'));
    for (const href of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
      if (!href[1].startsWith('https://devsnapkit.com')) assert.ok(html.includes(`href="${href[1]}" rel="nofollow noopener"`), href[1]);
    }
  });
}

test('comparison pages carry a dated, sourced comparison table and the verified DevSnapKit claims', () => {
  for (const guide of guides.filter(g => g.kind === 'cmp')) {
    const html = read(`${guide.slug}/index.html`);
    assert.match(html, /<table class="spec-table compare-table">/, guide.slug);
    assert.match(html, /Last checked: November 2026\./, guide.slug);
    assert.match(html, /<p class="table-note last-checked">[\s\S]*?href="https:\/\/[^"]+" rel="nofollow noopener"/, guide.slug);
    const text = strip(html);
    assert.match(text, /no watermark/i, guide.slug);
    assert.match(text, /\$1/, guide.slug);
    assert.match(text, /not uploaded|never uploaded|without uploading|never leave/i, guide.slug);
  }
  const pika = read('pika-style-alternative/index.html');
  assert.match(pika, /Pika\.style/);
});

test('verified product claims stay true to the code', () => {
  const paypal = readFileSync(new URL('functions/api/paypal-create-order.ts', root), 'utf8');
  assert.match(paypal, /value: ['"]1\.00['"]/);
  assert.match(read('privacy/index.html'), /Zero-Upload/);
  const themes = readFileSync(new URL('src/themes.ts', root), 'utf8');
  for (const name of ['Aurora Borealis', 'Sunset Coral', 'Cyberpunk', 'Emerald Glow', 'Midnight Neon', 'Nordic Glacier', 'Tokyo Dusk', 'Studio Silver']) assert.ok(themes.includes(`name: '${name}'`), name);
  for (const label of ['MacBook Pro', 'Studio Display', 'iPhone 17 Pro', 'Safari Browser', 'Clay Phone', 'Glass Window']) assert.ok(appSource.includes(label), label);
});

test('sitemap, homepage and tool pages link every guide', () => {
  const sitemap = read('sitemap.xml');
  for (const g of guides) assert.ok(sitemap.includes(`<loc>https://devsnapkit.com/${g.slug}/</loc>`), g.slug);
  for (const file of ['../index.html', ...tools.map(t => `${t}/index.html`)]) {
    const html = read(file);
    assert.match(html, /<nav class="tools-nav guides-nav wrap" aria-label="Guides">/, file);
    for (const g of guides) assert.ok(html.includes(`href="/${g.slug}/"`), `${file} -> ${g.slug}`);
  }
  for (const t of tools) {
    const footer = read(`${t}/index.html`).match(/<footer[\s\S]*?<\/footer>/)[0];
    assert.ok(footer.includes('href="/terms/"') && footer.includes('href="/privacy/"'), t);
  }
});

test('guide example provenance lists every new example image with hashes', () => {
  const manifest = JSON.parse(read('seo/examples/lp-examples.json'));
  const files = new Set(manifest.examples.map(e => e.file));
  for (const g of guides) {
    const src = read(`${g.slug}/index.html`).match(/<figure class="guide-figure"><img src="\/seo\/examples\/([^"]+)"/)[1];
    assert.ok(files.has(src), `${g.slug}: ${src}`);
  }
  for (const e of manifest.examples) assert.match(e.sha256, /^[0-9a-f]{64}$/);
});
