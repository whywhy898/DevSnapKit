import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { launchBrowser } from './helpers/browser.mjs';

// This harness is never imported by src/ or functions/. No production test hooks.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = path.join(root, 'test_evidence_payment_retry');
const orderId = 'ORDER1234567890123', secondOrder = 'SECONDORDER1234567';
const licenseKey = 'DSK-AAAA-BBBB-CCCC'; // Synthetic format-valid UI fixture, not a signed key.
const fixtures = {
  VOIDED: { status: 202, body: { success: false, unpaid: true, pending: false, status: 'VOIDED' } },
  '404-json': { status: 404, body: { success: false, error: 'Could not verify the PayPal order. Please retry or contact support@devsnapkit.com.' } },
  '404-html': { status: 404, contentType: 'text/html', body: '<html>Not Found</html>' },
  APPROVED: { status: 202, body: { success: false, unpaid: false, pending: true, status: 'APPROVED' } },
  UNKNOWN: { status: 202, body: { success: false } },
  PAID: { status: 200, body: { success: true, status: 'COMPLETED', licenseKey } },
  claimPending: { status: 403, body: { success: false } },
  claimPaid: { status: 200, body: { success: true, licenseKey } },
  config: { status: 200, body: { clientId: 'local-mock-client', mode: 'sandbox' } },
  create: { status: 200, body: { id: secondOrder } },
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, server, base, runId;

before(async () => {
  runId = new Date().toISOString();
  await fs.mkdir(evidence, { recursive: true });
  const entry = await fs.readFile(path.join(root, 'dist/index.html'), 'utf8');
  const asset = entry.match(/<script[^>]+src="(\/assets\/[^"?]+\.js)"/)?.[1];
  assert.ok(asset, 'build this actual checkout first with npm run build');
  const revision = JSON.parse(await fs.readFile(path.join(root, 'dist/build-revision.json'), 'utf8'));
  const sourceSha256 = {};
  for (const file of ['src/App.tsx', 'src/paypalCheckout.ts', 'shared/pricing.ts', 'functions/lib/paypal.ts',
    'functions/api/paypal-config.ts', 'functions/api/paypal-create-order.ts', 'functions/api/paypal-capture-order.ts',
    'tests/payment-retry-browser.test.mjs', 'tests/build-revision.test.mjs', 'tests/paypal-webhook.test.mjs', 'tests/paypal-browser.test.mjs',
    'scripts/build-revision.mjs', 'package.json']) {
    sourceSha256[file] = createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex');
  }
  const paymentAsset = (await fs.readdir(path.join(root, 'dist/assets'))).filter(file => file.endsWith('.js'));
  const paymentBundles = {};
  for (const file of paymentAsset) {
    const bytes = await fs.readFile(path.join(root, 'dist/assets', file));
    if (bytes.includes(Buffer.from('/api/paypal-capture-order'))) {
      paymentBundles[file] = createHash('sha256').update(bytes).digest('hex');
    }
  }
  await fs.writeFile(path.join(evidence, 'build.json'), JSON.stringify({
    simulated: true, at: new Date().toISOString(),
    checkoutHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    trackedChanges: execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean),
    untrackedEvidenceSources: execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--',
      'scripts/build-revision.mjs', 'tests/build-revision.test.mjs', 'tests/payment-retry-browser.test.mjs',
      'docs/payment-retry-validation-follow-up.md', 'docs/evidence/payment-retry/public-metadata.json'],
    { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean),
    revisionIndicator: revision, asset,
    assetSha256: createHash('sha256').update(await fs.readFile(path.join(root, 'dist', asset.slice(1)))).digest('hex'),
    sourceSha256, paymentBundles,
    scope: 'Actual built React app; mocked SDK and all APIs; no provider or deployed backend exercised',
  }, null, 2) + '\n');
  server = http.createServer(async (req, res) => {
    try {
      // No backend exists on this server. All non-GET requests fail closed.
      if (req.method !== 'GET') { res.writeHead(405).end(); return; }
      const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      const file = path.resolve(root, 'dist', pathname === '/' ? 'index.html' : '.' + pathname);
      if (!file.startsWith(path.join(root, 'dist') + path.sep)) { res.writeHead(403).end(); return; }
      const bytes = await fs.readFile(file);
      const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.woff2': 'font/woff2' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await launchBrowser(['--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']);
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  const results = [];
  for (const file of await fs.readdir(evidence)) {
    if (!file.endsWith('.json') || ['build.json', 'summary.json'].includes(file)) continue;
    const s = JSON.parse(await fs.readFile(path.join(evidence, file), 'utf8'));
    if (s.runId !== runId) continue;
    const counts = {};
    for (const r of s.requests) {
      const key = r.method + ' ' + r.route + ' -> ' + (r.response?.status ?? r.disposition);
      counts[key] = (counts[key] || 0) + 1;
    }
    results.push({ name: s.name, passed: s.passed, actionAttempts: s.actions.length, counts,
      assertions: s.assertions.length, screenshot: s.passed ? s.name + '.png' : null });
  }
  await fs.writeFile(path.join(evidence, 'summary.json'), JSON.stringify({ runId, simulated: true,
    passed: results.filter(x => x.passed).length, failed: results.filter(x => !x.passed).length, results,
  }, null, 2) + '\n');
});

async function scenario(t, name, outcome) {
  const context = await browser.createBrowserContext();
  const state = { runId, simulated: true, name, requests: [], actions: [], unexpected: [], pageErrors: [], assertions: [], passed: false };
  let release, resolveHeld, revisited = false;
  const held = new Promise(resolve => { resolveHeld = resolve; });
  const save = async () => fs.writeFile(path.join(evidence, name + '.json'), JSON.stringify(state, null, 2) + '\n');
  t.after(async () => { release?.(); await save(); await context.close(); });
  const captureRequests = () => state.requests.filter(x => x.route === '/api/paypal-capture-order');
  const createRequests = () => state.requests.filter(x => x.route === '/api/paypal-create-order');
  async function newPage(seed = false) {
    const page = await context.newPage();
    await page.setViewport({ width: 1440, height: 1050, deviceScaleFactor: 1 });
    page.on('pageerror', e => state.pageErrors.push(e.message));
    await page.evaluateOnNewDocument((seed, orderId) => {
      localStorage.setItem('devsnapkit_welcome_dismissed', 'true');
      localStorage.setItem('devsnapkit_welcome_seen', '1');
      if (seed) localStorage.setItem('devsnapkit_pending_paypal_order', orderId);
      window.paypal = { Buttons: config => ({ render(container) {
        const button = document.createElement('button');
        button.textContent = 'Local mock PayPal';
        button.onclick = async () => {
          try { await config.onApprove({ orderID: await config.createOrder() }); }
          catch (error) { config.onError(error); }
        };
        container.appendChild(button);
      } }) };
    }, seed, orderId);
    await page.setRequestInterception(true);
    page.on('request', request => { void (async () => {
      const url = new URL(request.url()), method = request.method();
      if (['data:', 'blob:'].includes(url.protocol)) { await request.continue(); return; }
      const item = { method, route: url.pathname, at: new Date().toISOString(),
        body: request.postData() || null, response: null, disposition: null };
      if (url.origin === 'https://www.paypal.com' && url.pathname === '/sdk/js' && method === 'GET') {
        state.requests.push(item); item.disposition = 'mock-sdk'; item.response = { status: 200, body: '' };
        await request.respond({ status: 200, contentType: 'text/javascript', body: '' }); return;
      }
      if (url.origin !== base) {
        // The built app imports a Google Fonts stylesheet. Intentionally block it.
        if (url.origin === 'https://fonts.googleapis.com' && method === 'GET' && url.pathname === '/css2') {
          state.requests.push(item); item.disposition = 'blocked-font';
          await request.abort('blockedbyclient'); return;
        }
        state.requests.push(item); item.disposition = 'blocked-external'; state.unexpected.push({ origin: url.origin, ...item });
        await request.abort('blockedbyclient'); return;
      }
      if (!url.pathname.startsWith('/api/')) {
        if (method === 'GET') { await request.continue(); return; }
        state.unexpected.push(item); await request.abort('blockedbyclient'); return;
      }
      state.requests.push(item);
      const respond = async fixture => {
        item.response = fixture; item.disposition = 'mock-api'; item.respondedAt = new Date().toISOString();
        await request.respond({ status: fixture.status, contentType: fixture.contentType || 'application/json',
          body: typeof fixture.body === 'string' ? fixture.body : JSON.stringify(fixture.body) });
      };
      if (url.pathname === '/api/paypal-config' && method === 'GET') { await respond(fixtures.config); return; }
      if (url.pathname === '/api/telemetry/event' && method === 'POST') {
        item.response = { status: 204, body: null }; item.disposition = 'mock-telemetry';
        await request.respond({ status: 204 }); return;
      }
      if (url.pathname === '/api/claim-license' && method === 'POST') {
        assert.ok([orderId, secondOrder].includes(JSON.parse(request.postData()).orderId));
        await respond(revisited ? fixtures.claimPaid : fixtures.claimPending); return;
      }
      if (url.pathname === '/api/paypal-create-order' && method === 'POST') { await respond(fixtures.create); return; }
      if (url.pathname === '/api/paypal-capture-order' && method === 'POST') {
        const body = JSON.parse(request.postData());
        if (body.orderId === secondOrder) { await respond(fixtures.PAID); return; }
        assert.deepEqual(body, { orderId });
        await new Promise(resolve => { release = resolve; resolveHeld(); });
        await respond(fixtures[outcome]); return;
      }
      // Fail unexpected APIs instead of adding a generic successful bypass.
      item.disposition = 'blocked-unexpected-api'; state.unexpected.push(item);
      await request.abort('blockedbyclient');
    })().catch(error => { state.unexpected.push({ error: error.message }); void request.abort('failed').catch(() => {}); }); });
    await page.goto(base + '/?editor=1', { waitUntil: 'networkidle0' });
    return page;
  }
  const page = await newPage(true);
  const snapshot = page => page.evaluate(() => ({
    pending: localStorage.getItem('devsnapkit_pending_paypal_order'),
    key: localStorage.getItem('devsnapkit_license_key'), unlocked: localStorage.getItem('devsnapkit_pro_unlocked'),
    checkoutVisible: [...document.querySelectorAll('button')].some(b => b.textContent === 'Local mock PayPal' && b.getClientRects().length),
    notice: document.querySelector('[data-pro-modal] [role="status"]')?.textContent || null,
    buttons: Object.fromEntries(['Recover payment', 'Discard and pay again'].map(text => [text,
      [...document.querySelectorAll('button')].find(b => b.textContent === text)?.disabled ?? null])),
  }));
  const burst = async (page, label, timing) => {
    const attempts = await page.evaluate(async (label, timing) => {
      const button = [...document.querySelectorAll('button')].find(b => b.textContent === label);
      if (!button) throw new Error('Missing action: ' + label);
      const attempts = [];
      for (let i = 0; i < 3; i++) {
        attempts.push({ label, timing, atMs: performance.now(), disabled: button.disabled }); button.click();
        if (timing === 'millisecond' && i < 2) await new Promise(resolve => setTimeout(resolve, 1));
      }
      return attempts;
    }, label, timing);
    state.actions.push(...attempts);
  };
  const check = (description, actual, expected) => { assert.deepEqual(actual, expected, description); state.assertions.push(description); };
  return { state, page, newPage, snapshot, burst, held, captureRequests, createRequests, check,
    release: () => { assert.equal(typeof release, 'function'); release(); release = undefined; },
    revisit: () => { revisited = true; },
    finish: async page => {
      check('no unexpected API/external requests', state.unexpected, []);
      check('no browser page errors', state.pageErrors, []);
      state.final = await snapshot(page);
      await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true });
      state.passed = true;
      await save();
    },
  };
}

for (const timing of ['same-turn', 'millisecond']) {
  for (const action of ['Discard and pay again', 'Recover payment']) {
    for (const outcome of ['VOIDED', '404-json', '404-html', 'APPROVED', 'UNKNOWN', 'PAID']) {
      const name = `${timing}-${action.startsWith('Discard') ? 'discard' : 'recover'}-${outcome}`;
      test(name, { timeout: 25000 }, async t => {
        const s = await scenario(t, name, outcome);
        await s.page.click('.pro-upgrade-button');
        await s.page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Discard and pay again'));
        await s.burst(s.page, action, timing);
        await s.held;
        s.check('three attempts dispatch exactly one capture check', s.captureRequests().length, 1);
        s.state.held = await s.snapshot(s.page);
        s.check('pending order retained before response', s.state.held.pending, orderId);
        s.check('both actions disabled while held', Object.values(s.state.held.buttons), [true, true]);
        s.check('checkout hidden while held', s.state.held.checkoutVisible, false);
        await s.burst(s.page, action === 'Recover payment' ? 'Discard and pay again' : 'Recover payment', timing);
        await sleep(100);
        s.check('three overlapping attempts dispatch no more requests', s.captureRequests().length, 1);
        if (outcome === 'APPROVED' && timing === 'same-turn' && action === 'Discard and pay again') {
          const start = performance.now(); await sleep(5000);
          s.state.slowHoldMs = performance.now() - start;
          s.check('five-second slow response keeps the order', (await s.snapshot(s.page)).pending, orderId);
          s.check('five-second slow response keeps actions disabled', Object.values((await s.snapshot(s.page)).buttons), [true, true]);
          s.check('five-second slow response sends one check', s.captureRequests().length, 1);
        }
        s.release();
        if (outcome === 'PAID') {
          await s.page.waitForFunction(key => localStorage.getItem('devsnapkit_license_key') === key, {}, licenseKey);
          s.check('paid response unlocks app', (await s.snapshot(s.page)).unlocked, 'true');
          s.check('paid response clears fulfilled pending order', (await s.snapshot(s.page)).pending, null);
        } else if (outcome === 'VOIDED' && action === 'Discard and pay again') {
          await s.page.waitForFunction(() => localStorage.getItem('devsnapkit_pending_paypal_order') === null);
          await s.page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Local mock PayPal'));
          s.check('only VOIDED discard displays restart notice', (await s.snapshot(s.page)).notice, 'Previous payment discarded. You can pay again now.');
        } else {
          await s.page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Discard and pay again' && !b.disabled));
          const final = await s.snapshot(s.page);
          s.check('inconclusive/recover-only response retains order', final.pending, orderId);
          s.check('no fabricated license', final.key, null);
          s.check('no checkout offered', final.checkoutVisible, false);
          s.check('no discarded notice', final.notice, null);
        }
        s.check('six total action attempts', s.state.actions.length, 6);
        s.check('no checkout created', s.createRequests().length, 0);
        s.check('one capture check after response', s.captureRequests().length, 1);
        await s.finish(s.page);
      });
    }
  }
}

for (const after404 of [false, true]) test(after404 ? '404-then-paid-license-on-revisit' : 'paid-license-recovery-on-new-tab-revisit', { timeout: 25000 }, async t => {
  const s = await scenario(t, after404 ? '404-then-paid-license-on-revisit' : 'paid-license-recovery-on-new-tab-revisit', '404-json');
  s.check('fresh visit has no synthetic license', (await s.snapshot(s.page)).key, null);
  s.check('fresh visit retains pending order', (await s.snapshot(s.page)).pending, orderId);
  const firstClaims = s.state.requests.filter(x => x.route === '/api/claim-license').length;
  s.check('first page makes one pending claim', firstClaims, 1);
  if (after404) {
    await s.page.click('.pro-upgrade-button');
    await s.burst(s.page, 'Discard and pay again', 'same-turn'); await s.held; s.release();
    await s.page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Discard and pay again' && !b.disabled));
    s.check('404 retains order for later verified recovery', (await s.snapshot(s.page)).pending, orderId);
    s.check('404 hides new checkout', (await s.snapshot(s.page)).checkoutVisible, false);
  }
  const claimsBeforeRevisit = s.state.requests.filter(x => x.route === '/api/claim-license').length;
  await s.page.close(); s.revisit();
  const page = await s.newPage(); // Same browser context/origin. Does not seed order/key again.
  await page.waitForFunction(key => localStorage.getItem('devsnapkit_license_key') === key, {}, licenseKey);
  s.check('one completed claim on revisit', s.state.requests.filter(x => x.route === '/api/claim-license').length - claimsBeforeRevisit, 1);
  s.check('revisit clears fulfilled pending order', (await s.snapshot(page)).pending, null);
  s.check('revisit unlocks app', (await s.snapshot(page)).unlocked, 'true');
  s.check('revisit never adds a capture', s.captureRequests().length, after404 ? 1 : 0);
  s.check('revisit never creates another order', s.createRequests().length, 0);
  await s.finish(page);
});

test('VOIDED-confirmed-discard-then-one-new-mocked-checkout', { timeout: 25000 }, async t => {
  const s = await scenario(t, 'VOIDED-confirmed-discard-then-one-new-mocked-checkout', 'VOIDED');
  await s.page.click('.pro-upgrade-button');
  await s.burst(s.page, 'Discard and pay again', 'same-turn'); await s.held; s.release();
  await s.page.waitForFunction(() => localStorage.getItem('devsnapkit_pending_paypal_order') === null);
  await s.page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Local mock PayPal'));
  s.check('no create before confirmed VOIDED', s.createRequests().length, 0);
  s.state.actions.push({ label: 'Local mock PayPal', timing: 'single', atMs: await s.page.evaluate(() => performance.now()) });
  await s.page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Local mock PayPal').click());
  await s.page.waitForFunction(key => localStorage.getItem('devsnapkit_license_key') === key, {}, licenseKey);
  s.check('exactly one new mocked create', s.createRequests().length, 1);
  s.check('one old check plus one new mocked capture', s.captureRequests().length, 2);
  s.check('new capture uses new order ID', JSON.parse(s.captureRequests()[1].body), { orderId: secondOrder });
  s.check('only new fulfilled order clears pending', (await s.snapshot(s.page)).pending, null);
  await s.finish(s.page);
});
