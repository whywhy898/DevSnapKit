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

test('checkout errors and webhook recovery work through the actual browser UI', async t => {
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
  const browser = await launchBrowser(); t.after(() => browser.close());
  const base = `http://127.0.0.1:${server.address().port}/?editor=1`;
  const results = [];
  for (const [name, width] of [['creation-error', 1440], ['lost-callback', 390], ['reload-recovery', 1440]]) {
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
          try { const id = await config.createOrder(); if (name !== 'lost-callback') await config.onApprove({ orderID: id }); }
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
    if (name === 'creation-error') {
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
