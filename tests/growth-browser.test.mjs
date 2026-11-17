import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { launchBrowser, downloadPng } from './helpers/browser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const evidence = path.join(root, 'scratch/growth-seo-evidence');
async function serve(t) {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const file = path.resolve(root, 'dist', '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(path.resolve(root, 'dist') + path.sep)) return res.writeHead(403).end();
      const bytes = await fs.readFile(file);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
async function pageFor(browser, theme, width, enabled = true) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(theme => {
    localStorage.setItem('devsnapkit_landing_theme', theme);
    localStorage.setItem('shotcraft_theme_mode', theme);
    localStorage.setItem('devsnapkit_welcome_dismissed', 'true');
    localStorage.setItem('devsnapkit_welcome_seen', '1');
  }, theme);
  const calls = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      calls.push({ path: url.pathname, method: request.method(), body: request.postData() });
      if (url.pathname === '/api/feedback' && request.method() === 'GET') {
        await request.respond({ contentType: 'application/json', body: JSON.stringify({ enabled }) });
      } else {
        await request.respond({ status: 500, contentType: 'application/json', body: '{}' });
      }
      return;
    }
    if (url.hostname !== '127.0.0.1') return request.abort();
    await request.continue();
  });
  return { page, calls, errors };
}
async function exportImage(page, filename) {
  return downloadPng(page, evidence, filename, async () => {
    await page.click('.export-trigger-btn');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.getClientRects().length && /^Download .*\(/.test(b.textContent)));
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.getClientRects().length && /^Download .*\(/.test(b.textContent)).click());
  });
}

test('hero image entry and real export remain usable in both themes and desktop/mobile layouts during API failure', { timeout: 120000 }, async t => {
  const origin = await serve(t), browser = await launchBrowser(); t.after(() => browser.close());
  await fs.mkdir(evidence, { recursive: true });
  for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
    const { page, calls, errors } = await pageFor(browser, theme, width);
    await page.goto(origin + '/?utm_source=growth-qa&simulate_api_fail=1', { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await (await page.$('.hero')).screenshot({ path: path.join(evidence, `hero-${theme}-${width}.png`) });
    await (await page.$('#hero-image')).uploadFile(path.join(root, 'public/seo/examples/github-original.webp'));
    await page.waitForSelector('#studio-canvas');
    await page.waitForFunction(() => document.querySelector('#studio-canvas')?.getBoundingClientRect().width > 0);
    await page.waitForNetworkIdle();
    assert.equal(new URL(page.url()).searchParams.get('editor'), '1');
    assert.equal(await page.$('[data-export-feedback]'), null);
    await exportImage(page, `export-${theme}-${width}.png`);
    await page.waitForSelector('[data-export-feedback]', { visible: true });
    await page.screenshot({ path: path.join(evidence, `feedback-${theme}-${width}.png`) });
    assert.equal(await page.$eval('[data-export-feedback]', node => {
      const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
    }), true);
    await page.type('[data-export-feedback] input[type="email"]', 'qa@example.test');
    await page.evaluate(() => document.querySelector('[data-export-feedback] button[type="submit"]').click());
    await page.waitForFunction(() => document.querySelector('[data-export-feedback] [role="status"]')?.textContent.includes('download is unaffected'));
    await page.click('[aria-label="Dismiss export feedback"]');
    await exportImage(page, `export-again-${theme}-${width}.png`);
    assert.equal(await page.$('[data-export-feedback]'), null);
    assert.equal(calls.filter(c => c.path === '/api/feedback' && c.method === 'POST').length, 1);
    assert.ok(calls.filter(c => c.path === '/api/event').every(c => !/github-original|base64|image\/webp/.test(c.body || '')));
    assert.deepEqual(errors, []); await page.close();
  }
});

test('unconfigured feedback never displays or collects while downloads still start', { timeout: 30000 }, async t => {
  const origin = await serve(t), browser = await launchBrowser(); t.after(() => browser.close());
  const { page, calls } = await pageFor(browser, 'light', 390, false);
  await page.goto(origin + '/?editor=1', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#studio-canvas');
  await exportImage(page, 'feedback-disabled-export.png');
  assert.equal(await page.$('[data-export-feedback]'), null);
  assert.equal(calls.some(c => c.path === '/api/feedback' && c.method === 'POST'), false);
});
