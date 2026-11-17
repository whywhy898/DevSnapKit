import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { launchBrowser, downloadPng } from './helpers/browser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const evidence = path.join(root, 'scratch/growth-followup');

test('shipped static and React paths count full documents, not editor transitions', { timeout: 120000 }, async t => {
  const requests = [], initiators = [], stages = [], pending = new Map();
  let action = 'setup';
  await fs.mkdir(evidence, { recursive: true });
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname.startsWith('/api/')) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString('utf8');
        requests.push({ path: pathname, method: req.method, body: raw ? JSON.parse(raw) : null });
        if (pathname === '/api/event' || pathname === '/api/telemetry/event') return res.writeHead(204).end();
        return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ enabled: false, valid: false }));
      }
      let target = path.resolve(root, 'dist', '.' + decodeURIComponent(pathname));
      assert.ok(target.startsWith(path.resolve(root, 'dist') + path.sep) || target === path.resolve(root, 'dist'));
      if (pathname === '/admin') target = path.join(root, 'dist/index.html');
      if ((await fs.stat(target)).isDirectory()) target = path.join(target, 'index.html');
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.vtt': 'text/vtt' };
      const bytes = await fs.readFile(target);
      if (path.extname(target) === '.mp4' && req.headers.range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
        const start = Number(match?.[1]), end = match?.[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
        if (!Number.isSafeInteger(start) || start > end || start >= bytes.length) return res.writeHead(416, { 'Content-Range': `bytes */${bytes.length}` }).end();
        return res.writeHead(206, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${bytes.length}`, 'Content-Length': end - start + 1 }).end(bytes.subarray(start, end + 1));
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launchBrowser(); t.after(() => browser.close());
  t.after(() => fs.writeFile(path.join(evidence, 'visit-requests.json'), JSON.stringify({ requests, initiators, stages, action, pending: [...pending.values()] }, null, 2)));
  const page = await browser.newPage(), errors = [];
  // Scene presets create local edits. Discard fixture edits when this test
  // deliberately navigates to the next full document.
  page.on('dialog', dialog => dialog.accept());
  page.on('request', req => pending.set(req, req.url()));
  page.on('requestfinished', req => pending.delete(req));
  page.on('requestfailed', req => pending.delete(req));
  page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', req => new URL(req.url()).hostname === '127.0.0.1' || req.url().startsWith('data:') || req.url().startsWith('blob:') ? req.continue() : req.abort());
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('devsnapkit_welcome_seen', '1');
    localStorage.setItem('devsnapkit_welcome_dismissed', 'true');
    window.__documentId = crypto.randomUUID();
  });
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  cdp.on('Network.requestWillBeSent', e => {
    if (/\/api\/(event|telemetry\/event)/.test(e.request.url)) initiators.push({ url: e.request.url, method: e.request.method, initiator: e.initiator, loaderId: e.loaderId, frameId: e.frameId });
  });
  const events = () => requests.filter(r => r.method === 'POST' && ['/api/event', '/api/telemetry/event'].includes(r.path)).map(r => r.body);
  const checkpoint = async label => {
    // SEO guide videos may keep range requests open. Wait for quiet network
    // without requiring streaming media to finish downloading.
    await page.waitForNetworkIdle({ concurrency: 2 });
    stages.push({ label, documentId: await page.evaluate(() => window.__documentId), events: events().map(e => e.event) });
  };
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.goto(origin + '/?utm_source=codexbot-browser&utm_medium=qa-browser&utm_campaign=qa-attr-20261117-local', { waitUntil: 'networkidle0' });
  await checkpoint('landing');
  assert.deepEqual(events().map(e => e.event), ['visit']);
  await (await page.$('#hero-image')).uploadFile(path.join(root, 'public/seo/examples/github-original.webp'));
  await page.waitForSelector('#studio-canvas');
  await checkpoint('same-document editor');
  assert.equal(stages[1].documentId, stages[0].documentId);
  assert.equal(new URL(page.url()).searchParams.get('editor'), '1');
  assert.equal(new URL(page.url()).searchParams.get('utm_source'), 'codexbot-browser');
  assert.deepEqual(events().map(e => e.event), ['visit', 'editor_open']);
  await downloadPng(page, evidence, 'free-export.png', async () => {
    await page.click('.export-trigger-btn');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.getClientRects().length && /^Download .*\(/.test(b.textContent)));
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.getClientRects().length && /^Download .*\(/.test(b.textContent)).click());
  });
  await checkpoint('free export');
  assert.deepEqual(events().map(e => e.event), ['visit', 'editor_open', 'export']);
  assert.equal(await page.$('[data-export-feedback]'), null);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('#studio-canvas');
  await checkpoint('full editor reload');
  assert.notEqual(stages[3].documentId, stages[0].documentId);
  assert.deepEqual(events().map(e => e.event), ['visit', 'editor_open', 'export', 'visit', 'editor_open']);
  for (const e of events()) {
    assert.equal(e.sessionId, events()[0].sessionId);
    assert.equal(e.utm_source, 'codexbot-browser');
    assert.equal(e.utm_medium, 'qa-browser');
    assert.equal(e.utm_campaign, 'qa-attr-20261117-local');
    assert.equal(e.path, '/');
  }
  assert.equal(requests.some(r => r.path === '/api/feedback' && r.method === 'POST'), false);
  // Every SEO document ships its own deferred runtime. Exercise the real built
  // tags, including navigation into a new root/editor document (not pushState).
  const entries = [];
  for (const entry of await fs.readdir(path.join(root, 'public'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const html = await fs.readFile(path.join(root, 'public', entry.name, 'index.html'), 'utf8').catch(() => '');
    if (html.includes('src="/seo/attribution.js"')) entries.push('/' + entry.name + '/');
  }
  assert.equal(entries.length, 20, 'all current SEO entry pages are exercised');
  for (const entry of entries) {
    action = 'static navigation ' + entry;
    const before = events().length;
    await page.goto(origin + entry + '?utm_source=later-campaign', { waitUntil: 'networkidle2' });
    await checkpoint('static SEO ' + entry);
    assert.deepEqual(events().slice(before).map(e => e.event), ['visit'], entry);
    assert.equal(events().at(-1).utm_source, 'codexbot-browser', 'landing UTM persists across documents');
    assert.equal(events().at(-1).sessionId, events()[0].sessionId);
    assert.equal(events().at(-1).path, entry);
    const link = await page.$('.hero-copy a.button');
    assert.ok(link, entry + ' editor CTA');
    action = 'editor navigation from ' + entry;
    await link.click();
    await page.waitForSelector('#studio-canvas');
    await checkpoint('SEO editor navigation ' + entry);
    assert.deepEqual(events().slice(before).map(e => e.event), ['visit', 'visit', 'editor_open'], entry);
    assert.notEqual(stages.at(-1).documentId, stages.at(-2).documentId);
  }
  for (const query of ['?editor=1', '?tool=og', '?status=cancel']) {
    const before = events().length;
    await page.goto(origin + '/' + query, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#studio-canvas');
    await checkpoint('direct React boot ' + query);
    assert.deepEqual(events().slice(before).map(e => e.event), ['visit', 'editor_open']);
  }
  {
    await page.evaluate(() => localStorage.setItem('devsnapkit_pending_paypal_order', 'ORDER1234567890123'));
    const before = events().length;
    await page.goto(origin + '/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#studio-canvas');
    await checkpoint('pending-order React boot on bare root (local API fixtures only)');
    assert.deepEqual(events().slice(before).map(e => e.event), ['visit', 'editor_open']);
    await page.evaluate(() => localStorage.removeItem('devsnapkit_pending_paypal_order'));
  }
  {
    const before = events().length;
    await page.goto(origin + '/admin', { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[type="password"]');
    await checkpoint('admin boot remains authenticated');
    assert.deepEqual(events().slice(before).map(e => e.event), ['visit']);
  }
  assert.deepEqual(errors, []);
});
