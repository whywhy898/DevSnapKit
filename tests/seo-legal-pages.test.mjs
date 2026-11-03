import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadLegalContent, renderLegalPages } from '../scripts/build-legal-pages.mjs';

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('generated /terms/ and /privacy/ pages are in sync with legalContent.json', () => {
  for (const [rel, html] of Object.entries(renderLegalPages())) assert.equal(read(rel), html, `${rel} is stale: run node scripts/build-legal-pages.mjs`);
});

test('legal pages are indexable static pages with the modal text', () => {
  const content = loadLegalContent();
  for (const doc of [content.terms, content.privacy]) {
    const html = read(`public/${doc.slug}/index.html`);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://devsnapkit.com/${doc.slug}/">`));
    assert.match(html, new RegExp(`<meta property="og:url" content="https://devsnapkit.com/${doc.slug}/">`));
    assert.equal(html.match(/<h1\b/g).length, 1);
    assert.doesNotMatch(html, /noindex/);
    for (const section of doc.sections) assert.ok(html.includes(section.heading.replace(/&/g, '&amp;')), section.heading);
    assert.ok(html.includes('href="/terms/"') && html.includes('href="/privacy/"'));
  }
});

test('landing and 404 footers link the legal pages, and the sitemap lists them', () => {
  for (const rel of ['index.html', 'public/404.html']) {
    const html = read(rel);
    assert.ok(html.includes('<a href="/terms/">Terms of Service</a>'), `${rel} terms`);
    assert.ok(html.includes('<a href="/privacy/">Privacy Policy</a>'), `${rel} privacy`);
  }
  const sitemap = read('public/sitemap.xml');
  for (const slug of ['terms', 'privacy']) assert.match(sitemap, new RegExp(`<loc>https://devsnapkit.com/${slug}/</loc>\\s*<lastmod>\\d{4}-\\d{2}-\\d{2}</lastmod>`));
});
