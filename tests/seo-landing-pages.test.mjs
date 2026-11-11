import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const publicRoot = new URL('../public/', import.meta.url);
const slugs = ['screenshot-beautifier', 'og-image-generator', 'product-hunt-image-maker', 'add-text-to-image'];
const read = path => readFileSync(new URL(path, publicRoot), 'utf8');
const editorEntries = {
  'screenshot-beautifier': '/?editor=1',
  'og-image-generator': '/?editor=1&amp;aspect=og',
  'product-hunt-image-maker': '/?editor=1&amp;mode=duo&amp;aspect=og',
  'add-text-to-image': '/?editor=1&amp;tool=text',
};

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
      if (href[1].startsWith('/?')) assert.equal(href[1], editorEntries[slug], `${slug}: task entry`);
    }
    for (const target of slugs) assert.ok(html.includes(`href="/${target}/"`), `${slug} links ${target}`);
  }
  assert.equal(titles.size, slugs.length);
});

test('static pages use the floating studio card instead of a header pill', () => {
  const pages = { ...Object.fromEntries(slugs.map(slug => [`${slug}/index.html`, editorEntries[slug]])), '404.html': '/?editor=1', 'terms/index.html': '/?editor=1', 'privacy/index.html': '/?editor=1', '../index.html': '/?editor=1' };
  for (const [file, entry] of Object.entries(pages)) {
    const html = read(file);
    const header = html.match(/<header class="site-header[\s\S]*?<\/header>/)[0];
    assert.doesNotMatch(header, /button-small|href="\/\?editor/, `${file}: no editor pill in the header`);
    assert.match(header, /class="theme-toggle"/, `${file}: theme toggle kept`);
    assert.ok(html.includes(`data-studio-cta="${entry}"`), `${file}: card links to its editor entry`);
    assert.doesNotMatch(html, /class="studio-cta/, `${file}: card is not in the raw HTML`);
  }
  const script = read('seo/landing.js');
  assert.match(script, /dsk_studio_cta_dismissed_until/);
  assert.match(script, /dsk-app/);
  assert.match(script, /\/seo\/studio-cta\.css/);
  const css = read('seo/studio-cta.css');
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /max-width:640px/);
  assert.doesNotMatch(css + script, /role="?dialog/);
});

test('new pages identify one original/export case and three proposed scenarios', () => {
  for (const [slug, prefix, width, height] of [
    ['og-image-generator', 'og', 1200, 630],
    ['product-hunt-image-maker', 'ph', 1600, 1200],
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

test('text page uses one sparse source and the actual export throughout the first-screen walkthrough', () => {
  const html = read('add-text-to-image/index.html');
  assert.equal((html.match(/data-scenario/g) || []).length, 3);
  assert.ok(html.includes('href="/seo/examples/text-source.png"'));
  assert.ok(html.includes('href="/seo/examples/text-result.png"'));
  assert.ok(html.includes('content="https://devsnapkit.com/seo/examples/text-result.png"'));
  assert.ok(html.includes('width="2400" height="1376"'));
  assert.doesNotMatch(html, /MDN|text-original|text-styled|text-guide-(?:upload|edit|export)|add-text-demo/);
  assert.equal((html.match(/<video\b/g) || []).length, 1);
  assert.ok(html.indexOf('data-demo-player') < html.indexOf('class="benefits'));
  assert.match(html, /data-demo-player controls muted playsinline/);
  assert.doesNotMatch(html, /<video[^>]*\bloop\b/);
  assert.match(html, /data-demo-dialog/);
  assert.match(html, /Win<\/kbd>.*Shift<\/kbd>.*S<\/kbd>/);
  assert.match(html, /illustrative interface created for this walkthrough/);
  assert.match(html, /src="\/seo\/text-demo\.js\?v=/);
  assert.match(html, /href="\/seo\/text-guide\.css\?v=/);
  assert.match(html, /class="compare-before"><img src="\/seo\/examples\/text-before-caption\.png" width="2400" height="1376"/);
});

test('sitemap publishes exactly the homepage, four canonical tools, the guides and the legal pages', () => {
  const urls = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  const guides = JSON.parse(read('../tests/fixtures/seo-guides.json')).map(guide => guide.slug);
  assert.deepEqual(urls.sort(), ['https://devsnapkit.com/', ...slugs.map(slug => `https://devsnapkit.com/${slug}/`), ...guides.map(slug => `https://devsnapkit.com/${slug}/`), 'https://devsnapkit.com/terms/', 'https://devsnapkit.com/privacy/'].sort());
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

// Execute the shipped script with a small DOM fixture; no browser or wall-clock waits required.
function studioFixture({ width = 640, scrollY = 0, height = 800, pageHeight = 4000, dismissedUntil = 0 } = {}) {
  const events = new Map();
  const timers = new Map();
  const storage = new Map([['dsk_studio_cta_dismissed_until', String(dismissedUntil)]]);
  const classes = () => {
    const values = new Set();
    return { contains: value => values.has(value), add: value => values.add(value), remove: value => values.delete(value),
      toggle(value, enabled) { if (enabled) values.add(value); else values.delete(value); } };
  };
  const body = { dataset: {}, classList: classes(), appendChild(node) { card = node; } };
  const root = { dataset: {}, classList: classes(), get scrollHeight() {
    return pageHeight + (compact.matches && body.classList.contains('has-studio-cta') ? 76 : 0);
  } };
  const compact = { matches: width <= 640, addEventListener(type, handler) { this.change = handler; } };
  let card;
  let stylesheet;
  let nextTimer = 0;
  const context = {
    document: { documentElement: root, body, querySelector: () => null, querySelectorAll: () => [],
      head: { appendChild(node) { stylesheet = node; } },
      createElement(tag) {
        if (tag === 'link') return {};
        const close = { addEventListener(type, handler) { this.click = handler; } };
        const link = { setAttribute() {}, firstChild: {} };
        return { hidden: false, classList: classes(), setAttribute() {}, close,
          querySelector: selector => selector.includes('close') ? close : link,
          remove() { card = undefined; } };
      } },
    window: {}, scrollY, innerHeight: height, localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    getComputedStyle: () => ({ paddingBottom: compact.matches && body.classList.contains('has-studio-cta') ? '76px' : '0px' }),
    matchMedia: query => query.includes('max-width') ? compact : { matches: false, addEventListener() {} },
    addEventListener(type, handler) { events.set(type, handler); },
    removeEventListener(type) { events.delete(type); },
    setTimeout(handler, delay) { timers.set(++nextTimer, { handler, delay }); return nextTimer; },
    clearTimeout: id => timers.delete(id), requestAnimationFrame: handler => handler(),
  };
  runInNewContext(read('seo/landing.js'), context);
  return {
    get card() { return card; }, body, timers, storage,
    get visible() { return Boolean(card && !card.hidden && card.classList.contains('is-shown')); },
    scroll(y) { context.scrollY = y; events.get('scroll')?.(); },
    resize(newWidth, newHeight = context.innerHeight) {
      const changed = compact.matches !== (newWidth <= 640);
      compact.matches = newWidth <= 640;
      context.innerHeight = newHeight;
      if (changed) compact.change?.();
      events.get('resize')?.();
    },
    loadCss() {
      const onload = stylesheet?.onload;
      if (onload) { stylesheet.onload = null; onload(); }
    },
    runTimers() { for (const [id, timer] of [...timers]) { timers.delete(id); timer.handler(); } },
  };
}

test('mobile studio bar has no timer and follows the 75% threshold in both directions', () => {
  const f = studioFixture();
  assert.equal(f.timers.size, 0, 'waiting at the top must never show the mobile bar');
  f.scroll(2199); f.loadCss();
  assert.equal(f.visible, false);
  f.scroll(2200); f.loadCss();
  assert.equal(f.visible, true, 'viewport bottom is exactly 75% of the unpadded page');
  f.scroll(2200);
  assert.equal(f.visible, true, 'reserved bottom padding must not move the threshold');
  f.scroll(2199);
  assert.equal(f.visible, false);
  assert.equal(f.card.hidden, true, 'hidden bar links must not be focusable');
  assert.equal(f.body.classList.contains('has-studio-cta'), false);
  f.scroll(2200);
  assert.equal(f.visible, true);
  assert.equal(f.body.classList.contains('has-studio-cta'), true);
  assert.match(read('seo/studio-cta.css'), /\.studio-cta\[hidden\]\s*\{\s*display:none/);
});

test('mobile bar checks restored scroll position, viewport changes and late stylesheet loading', () => {
  const restored = studioFixture({ scrollY: 2200 });
  restored.loadCss();
  assert.equal(restored.visible, true);
  restored.resize(640, 799);
  assert.equal(restored.visible, false);
  restored.resize(640, 800);
  assert.equal(restored.visible, true);
  const delayed = studioFixture();
  delayed.scroll(2200); delayed.scroll(0); delayed.loadCss();
  assert.equal(delayed.visible, false, 'scrolling up before CSS arrives must cancel visibility');
});

test('desktop studio card retains its 2.5 second or quarter-viewport scroll triggers', () => {
  const timed = studioFixture({ width: 641 });
  assert.deepEqual([...timed.timers.values()].map(timer => timer.delay), [2500]);
  timed.runTimers(); timed.loadCss();
  assert.equal(timed.visible, true);
  timed.scroll(0);
  assert.equal(timed.visible, true);
  const scrolled = studioFixture({ width: 641 });
  scrolled.scroll(200); scrolled.loadCss();
  assert.equal(scrolled.visible, false);
  scrolled.scroll(201); scrolled.loadCss();
  assert.equal(scrolled.visible, true);
  assert.equal(scrolled.timers.size, 0);
  scrolled.resize(640);
  assert.equal(scrolled.visible, false);
  scrolled.resize(641);
  assert.equal(scrolled.visible, true);
  const resized = studioFixture({ width: 641 });
  resized.resize(640); resized.runTimers(); resized.loadCss();
  assert.equal(resized.visible, false, 'desktop timer must not leak into mobile');
});

test('studio dismissal lasts seven days and prevents scroll or resize from remounting it', () => {
  const f = studioFixture();
  f.scroll(2200); f.loadCss();
  const before = Date.now();
  f.card.close.click();
  const until = Number(f.storage.get('dsk_studio_cta_dismissed_until'));
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  assert.ok(until >= before + sevenDays && until <= Date.now() + sevenDays);
  f.scroll(3000); f.resize(641); f.runTimers(); f.loadCss();
  assert.equal(f.card, undefined);
  assert.equal(f.body.classList.contains('has-studio-cta'), false);
  const dismissed = studioFixture({ dismissedUntil: until, scrollY: 3000 });
  dismissed.runTimers(); dismissed.loadCss();
  assert.equal(dismissed.card, undefined);
  const expired = studioFixture({ dismissedUntil: Date.now() - 1, scrollY: 3000 });
  expired.loadCss();
  assert.equal(expired.visible, true);
});
