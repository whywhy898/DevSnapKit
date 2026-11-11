import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, clickButton } from './helpers/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = process.env.PAYPAL_EVIDENCE_DIR;
const key = 'DSK-AAAA-BBBB-CCCC', order = 'ORDER1234567890123';

async function serveBuild(t) {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, 'dist', pathname === '/' ? 'index.html' : '.' + pathname);
      if (!file.startsWith(path.resolve(root, 'dist') + path.sep)) { res.writeHead(403).end(); return; }
      const bytes = await fs.readFile(file);
      const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/?editor=1`;
}

test('checkout errors and webhook recovery work through the actual browser UI', async t => {
  const base = await serveBuild(t);
  const browser = await launchBrowser(); t.after(() => browser.close());
  const results = [];
  for (const [name, width] of [['creation-error', 1440], ['lost-callback', 390], ['reload-recovery', 1440], ['approval-open', 1440]]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 1050, deviceScaleFactor: 1 });
    let claimCount = 0, captureCount = 0;
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.evaluateOnNewDocument((name, order) => {
      localStorage.setItem('devsnapkit_welcome_dismissed', 'true');
      localStorage.setItem('devsnapkit_welcome_seen', '1');
      if (name === 'reload-recovery') localStorage.setItem('devsnapkit_pending_paypal_order', order);
      window.paypal = { Buttons: config => ({ render(container) {
        const button = document.createElement('button'); button.textContent = 'Test PayPal checkout';
        button.onclick = async () => {
          try {
            const id = await config.createOrder();
            if (name === 'approval-open') window.finishPayPalApproval = () => config.onApprove({ orderID: id });
            else if (name !== 'lost-callback') await config.onApprove({ orderID: id });
          }
          catch (e) { config.onError(e); }
        }; container.appendChild(button);
      } }) };
    }, name, order);
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      const json = (data, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (url.hostname === 'www.paypal.com') { await request.respond({ contentType: 'text/javascript', body: '' }); return; }
      if (url.pathname === '/api/paypal-config') { await json({ clientId: 'test-client', mode: 'sandbox' }); return; }
      if (url.pathname === '/api/paypal-create-order') { await json(name === 'creation-error' ? { error: 'Checkout unavailable' } : { id: order }, name === 'creation-error' ? 503 : 200); return; }
      if (url.pathname === '/api/paypal-capture-order') { captureCount++; await json({ error: 'connection interrupted' }, 503); return; }
      if (url.pathname === '/api/claim-license') {
        if (name === 'approval-open') { await json({ success: false }, 403); return; }
        claimCount++; await json(name === 'creation-error' || claimCount < 2 ? { success: false } : { success: true, licenseKey: key }, claimCount < 2 ? 403 : 200); return;
      }
      if (url.pathname.startsWith('/api/')) { await json({ valid: false }); return; }
      await request.continue();
    });
    await page.goto(base, { waitUntil: 'networkidle0' });
    if (name !== 'reload-recovery') {
      const welcome = await page.$('button');
      if (welcome) await page.keyboard.press('Escape');
      await page.click('.pro-upgrade-button');
      await clickButton(page, 'Test PayPal checkout');
    }
    if (name === 'approval-open') {
      await page.waitForFunction(() => typeof window.finishPayPalApproval === 'function');
      assert.equal(await page.evaluate(() => ['Recover payment', 'Discard and pay again'].every(text => [...document.querySelectorAll('button')].find(b => b.textContent === text)?.disabled)), true,
        'an active PayPal approval window must finish before its order can be discarded');
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pending_paypal_order')), order);
      assert.equal(captureCount, 0);
      await page.evaluate(() => window.finishPayPalApproval());
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Discard and pay again' && !b.disabled));
      assert.equal(captureCount, 1);
    } else if (name === 'creation-error') {
      await page.waitForSelector('[role="alert"]');
      assert.match(await page.$eval('[role="alert"]', n => n.textContent), /could not complete/);
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pro_unlocked')), null);
    } else {
      await page.waitForFunction(key => [...document.querySelectorAll('input')].some(input => input.value === key), { timeout: 15000 }, key);
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_license_key')), key);
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pending_paypal_order')), null);
      assert.equal(captureCount, 0, 'the lost frontend callback does not cause another client capture');
    }
    assert.deepEqual(errors, []);
    if (evidence) { await fs.mkdir(evidence, { recursive: true }); await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true }); }
    results.push({ name, width, claimCount, captureCount, passed: true });
    await page.close();
  }
  if (evidence) await fs.writeFile(path.join(evidence, 'browser-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
});

test('pending checkout can be safely discarded or recovered through the browser UI', async t => {
  const base = await serveBuild(t);
  const browser = await launchBrowser(); t.after(() => browser.close());
  for (const name of ['unpaid', 'paid', 'network', 'server', 'processing']) {
    const page = await browser.newPage();
    await page.setViewport({ width: name === 'unpaid' ? 390 : 1440, height: 1050, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.evaluateOnNewDocument(order => {
      localStorage.setItem('devsnapkit_welcome_dismissed', 'true');
      localStorage.setItem('devsnapkit_welcome_seen', '1');
      localStorage.setItem('devsnapkit_pending_paypal_order', order);
      window.paypal = { Buttons: config => ({ render(container) {
        const button = document.createElement('button'); button.textContent = 'Test PayPal checkout';
        button.onclick = async () => {
          try { await config.onApprove({ orderID: await config.createOrder() }); }
          catch (error) { config.onError(error); }
        };
        container.appendChild(button);
      } }) };
    }, order);
    let captureCount = 0, createCount = 0, releaseCheck;
    let outcome = name;
    const requests = [];
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      const json = (data, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (url.hostname === 'www.paypal.com') { await request.respond({ contentType: 'text/javascript', body: '' }); return; }
      if (url.pathname === '/api/paypal-config') { await json({ clientId: 'test-client', mode: 'sandbox' }); return; }
      if (url.pathname === '/api/claim-license') { await json({ success: false }, 403); return; }
      if (url.pathname === '/api/paypal-create-order') { createCount++; await json({ id: 'SECONDORDER1234567' }); return; }
      if (url.pathname === '/api/paypal-capture-order') {
        captureCount++; const body = JSON.parse(request.postData()); requests.push(body);
        if (body.orderId === 'SECONDORDER1234567') { await json({ success: true, licenseKey: key }); return; }
        // Hold discard checks so we can verify that nothing is cleared early.
        if (captureCount > (name === 'unpaid' ? 1 : 0)) await new Promise(resolve => { releaseCheck = resolve; });
        if (outcome === 'network') { await request.abort('failed'); return; }
        if (outcome === 'paid') { await json({ success: true, status: 'COMPLETED', licenseKey: key }); return; }
        if (outcome === 'server') { await json({ success: false }, 503); return; }
        if (outcome === 'processing') { await json({ success: false, pending: true }, 202); return; }
        await json({ success: false, unpaid: true, pending: false, status: 'CREATED' }, 202); return;
      }
      if (url.pathname.startsWith('/api/')) { await json({ valid: false }); return; }
      await request.continue();
    });
    await page.goto(base, { waitUntil: 'networkidle0' });
    await page.click('.pro-upgrade-button');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Discard and pay again'), { timeout: 3000 });
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Test PayPal checkout' && b.getClientRects().length)), false);
    if (name === 'unpaid') {
      await clickButton(page, 'Recover payment');
      await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent.includes('discard it and pay again'));
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pending_paypal_order')), order);
    }
    await clickButton(page, 'Discard and pay again');
    const waitForHeldCheck = async () => {
      for (let i = 0; i < 100 && !releaseCheck; i++) await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(typeof releaseCheck, 'function');
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pending_paypal_order')), order);
      assert.equal(createCount, 0);
      assert.equal(await page.evaluate(() => ['Recover payment', 'Discard and pay again'].every(text => [...document.querySelectorAll('button')].find(b => b.textContent === text)?.disabled)), true);
      const release = releaseCheck; releaseCheck = undefined; release();
    };
    await waitForHeldCheck();
    if (['network', 'server', 'processing'].includes(name)) {
      await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent.includes('retry'));
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pending_paypal_order')), order);
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_license_key')), null);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Test PayPal checkout' && b.getClientRects().length)), false);
      outcome = 'unpaid';
      await clickButton(page, 'Discard and pay again');
      await waitForHeldCheck();
    }
    if (name === 'paid') {
      await page.waitForFunction(key => [...document.querySelectorAll('input')].some(input => input.value === key), {}, key);
      assert.equal(createCount, 0, 'a paid order never starts a second checkout');
    } else {
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Test PayPal checkout' && b.getClientRects().length));
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pending_paypal_order')), null);
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pro_unlocked')), null);
      await clickButton(page, 'Test PayPal checkout');
      await page.waitForFunction(key => localStorage.getItem('devsnapkit_license_key') === key, {}, key);
      assert.equal(createCount, 1);
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_license_key')), key);
    assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pro_unlocked')), 'true');
    assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pending_paypal_order')), null);
    assert.equal(requests[0].orderId, order);
    assert.deepEqual(errors, []);
    await page.close();
  }
});
