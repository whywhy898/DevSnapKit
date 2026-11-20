import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, clickButton } from './helpers/browser.mjs';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { proPricing } = createTypeScriptLoader(root)('shared/pricing.ts');
const evidence = process.env.CREEM_EVIDENCE_DIR;
const key = 'DSK-AAAA-BBBB-CCCC';
const checkoutId = 'ch_1QyIQDw9cbFWdA1ry5Qc6I';
const discardNotice = '[data-pro-modal] [role="status"]';

async function serveBuild(t) {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, 'dist', pathname === '/' ? 'index.html' : '.' + pathname);
      if (!file.startsWith(path.resolve(root, 'dist') + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      const bytes = await fs.readFile(file);
      const types = {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
      };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(bytes);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/?editor=1`;
}

test('Creem checkout errors, popup lifecycle, return URL, and webhook recovery work through browser UI', async t => {
  const base = await serveBuild(t);
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const results = [];

  for (const [name, width] of [
    ['creation-error', 1440],
    ['lost-callback', 390],
    ['reload-recovery', 1440],
    ['window-open', 1440],
    ['creem-return', 1440],
    ['creem-return-lag', 1440],
  ]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 1050, deviceScaleFactor: 1 });
    let claimCount = 0;
    let verifyCount = 0;
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.evaluateOnNewDocument((name, checkoutId) => {
      localStorage.setItem('devsnapkit_welcome_dismissed', 'true');
      localStorage.setItem('devsnapkit_welcome_seen', '1');
      if (name === 'reload-recovery') localStorage.setItem('devsnapkit_pending_creem_checkout', checkoutId);
      window.open = () => {
        const mockWin = {
          closed: false,
          close() { this.closed = true; },
        };
        window.__creemPopup = mockWin;
        return mockWin;
      };
    }, name, checkoutId);

    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      const json = (data, status = 200) =>
        request.respond({ status, contentType: 'application/json', body: JSON.stringify(data) });

      if (url.pathname === '/api/creem-create-checkout') {
        await json(
          name === 'creation-error'
            ? { success: false, error: 'Checkout unavailable' }
            : { id: checkoutId, checkoutUrl: `https://checkout.creem.io/${checkoutId}` },
          name === 'creation-error' ? 503 : 200
        );
        return;
      }
      if (url.pathname === '/api/creem-verify-checkout') {
        verifyCount++;
        if (name === 'creem-return') {
          await json({ success: true, status: 'COMPLETED', licenseKey: key });
          return;
        }
        if (name === 'creem-return-lag') {
          if (verifyCount === 1) {
            await json({ success: false, unpaid: true, pending: false }, 202);
          } else {
            await json({ success: true, status: 'COMPLETED', licenseKey: key });
          }
          return;
        }
        await json({ success: false, error: 'connection interrupted' }, 503);
        return;
      }
      if (url.pathname === '/api/claim-license') {
        if (name === 'window-open') {
          await json({ success: false }, 403);
          return;
        }
        claimCount++;
        await json(
          name === 'creation-error' || claimCount < 2
            ? { success: false }
            : { success: true, licenseKey: key },
          claimCount < 2 ? 403 : 200
        );
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        await json({ valid: false });
        return;
      }
      await request.continue();
    });

    const targetUrl =
      name === 'creem-return'
        ? `${base}&creem_return=1&checkout_id=${encodeURIComponent(checkoutId)}`
        : name === 'creem-return-lag'
          ? `${base}&creem_return=1&checkout_id=${encodeURIComponent(checkoutId)}&order_id=ord_4aDwWXjMLpes4Kj4XqNnUA`
          : base;
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });

    if (name !== 'reload-recovery' && name !== 'creem-return' && name !== 'creem-return-lag') {
      const welcome = await page.$('button');
      if (welcome) await page.keyboard.press('Escape');
      await page.click('.pro-upgrade-button');
      assert.equal(await page.$eval('.pro-price', node => node.textContent), proPricing.displayPrice);
      assert.equal(await page.$eval('.pro-early-bird', node => node.textContent), 'Early bird');
      const pricing = await page.$eval('[data-pro-modal]', node => ({
        text: node.textContent,
        strikethroughs: [...node.querySelectorAll('*')].filter(child =>
          getComputedStyle(child).textDecorationLine.includes('line-through')
        ).length,
      }));
      assert.ok(pricing.text.includes(proPricing.displayPrice));
      assert.ok(pricing.text.includes('Early bird'));
      assert.equal(pricing.strikethroughs, 0);
      await page.click('[data-creem-checkout]');
    }

    if (name === 'window-open') {
      await page.waitForFunction(() => typeof window.__creemPopup === 'object');
      assert.equal(
        await page.evaluate(() =>
          ['Recover payment', 'Discard and pay again'].every(
            text => [...document.querySelectorAll('button')].find(b => b.textContent === text)?.disabled
          )
        ),
        true,
        'an active Creem checkout window must finish before its checkout can be discarded'
      );
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pending_creem_checkout')), checkoutId);
      assert.equal(verifyCount, 0);
      await page.evaluate(() => {
        window.__creemPopup.closed = true;
      });
      await page.waitForFunction(
        () => [...document.querySelectorAll('button')].some(b => b.textContent === 'Discard and pay again' && !b.disabled)
      );
      assert.equal(verifyCount, 1);
    } else if (name === 'creation-error') {
      await page.waitForSelector('[role="alert"]');
      assert.match(await page.$eval('[role="alert"]', n => n.textContent), /Checkout unavailable|could not complete/);
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pro_unlocked')), null);
    } else {
      await page.waitForFunction(
        key => [...document.querySelectorAll('input')].some(input => input.value === key),
        { timeout: 15000 },
        key
      );
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_license_key')), key);
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pending_creem_checkout')), null);
      if (name === 'creem-return') {
        assert.equal(verifyCount, 1);
      } else if (name === 'creem-return-lag') {
        assert.equal(verifyCount, 2);
      } else {
        assert.equal(verifyCount, 0, 'the lost callback recovers via claim-license without extra verification charges');
      }
    }

    assert.deepEqual(errors, []);
    if (evidence) {
      await fs.mkdir(evidence, { recursive: true });
      await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true });
    }
    results.push({ name, width, claimCount, verifyCount, passed: true });
    await page.close();
  }

  if (evidence) await fs.writeFile(path.join(evidence, 'browser-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
});

test('pending Creem checkout can be safely discarded or recovered through the browser UI', async t => {
  const base = await serveBuild(t);
  const browser = await launchBrowser();
  t.after(() => browser.close());

  for (const name of [
    'unpaid',
    'unpaid-close-button',
    'unpaid-close-escape',
    'unpaid-close-pending',
    'unpaid-reopen-pending',
    'paid',
    'network',
    'server',
    'processing',
  ]) {
    const page = await browser.newPage();
    await page.setViewport({ width: name === 'unpaid' ? 390 : 1440, height: 1050, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.evaluateOnNewDocument(checkoutId => {
      localStorage.setItem('devsnapkit_welcome_dismissed', 'true');
      localStorage.setItem('devsnapkit_welcome_seen', '1');
      localStorage.setItem('devsnapkit_pending_creem_checkout', checkoutId);
      window.open = () => null;
    }, checkoutId);

    let verifyCount = 0;
    let createCount = 0;
    let releaseCheck;
    let releaseCreate;
    let outcome = name.startsWith('unpaid') ? 'unpaid' : name;
    const requests = [];

    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      const json = (data, status = 200) =>
        request.respond({ status, contentType: 'application/json', body: JSON.stringify(data) });

      if (url.pathname === '/api/claim-license') {
        await json({ success: false }, 403);
        return;
      }
      if (url.pathname === '/api/creem-create-checkout') {
        createCount++;
        await new Promise(resolve => { releaseCreate = resolve; });
        await json({ id: 'ch_SECONDCHECKOUT12345', checkoutUrl: 'https://checkout.creem.io/ch_SECONDCHECKOUT12345' });
        return;
      }
      if (url.pathname === '/api/creem-verify-checkout') {
        verifyCount++;
        const body = JSON.parse(request.postData());
        requests.push(body);
        if (body.checkoutId === 'ch_SECONDCHECKOUT12345') {
          await json({ success: true, licenseKey: key });
          return;
        }
        if (verifyCount > (name === 'unpaid' ? 1 : 0)) {
          await new Promise(resolve => { releaseCheck = resolve; });
        }
        if (outcome === 'network') { await request.abort('failed'); return; }
        if (outcome === 'paid') { await json({ success: true, status: 'COMPLETED', licenseKey: key }); return; }
        if (outcome === 'server') { await json({ success: false }, 503); return; }
        if (outcome === 'processing') { await json({ success: false, pending: true }, 202); return; }
        await json({ success: false, unpaid: true, pending: false }, 202);
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        await json({ valid: false });
        return;
      }
      await request.continue();
    });

    await page.goto(base, { waitUntil: 'networkidle0' });
    await page.click('.pro-upgrade-button');
    await page.waitForFunction(
      () => [...document.querySelectorAll('button')].some(b => b.textContent === 'Discard and pay again'),
      { timeout: 3000 }
    );
    assert.equal(await page.$(discardNotice), null, 'no notice before a successful discard');
    assert.equal(await page.$('[data-creem-checkout]'), null);

    if (name === 'unpaid') {
      await clickButton(page, 'Recover payment');
      await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent.includes('discard it and pay again'));
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pending_creem_checkout')), checkoutId);
      assert.equal(await page.$(discardNotice), null, 'recovering an unpaid checkout does not discard it');
    }

    await clickButton(page, 'Discard and pay again');
    const waitForHeldCheck = async () => {
      for (let i = 0; i < 100 && !releaseCheck; i++) await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(typeof releaseCheck, 'function');
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pending_creem_checkout')), checkoutId);
      assert.equal(createCount, 0);
      assert.equal(await page.$(discardNotice), null, 'no notice while the status check is pending');
      assert.equal(
        await page.evaluate(() =>
          ['Recover payment', 'Discard and pay again'].every(
            text => [...document.querySelectorAll('button')].find(b => b.textContent === text)?.disabled
          )
        ),
        true
      );
      if (['unpaid-close-pending', 'unpaid-reopen-pending'].includes(name)) {
        await page.keyboard.press('Escape');
        if (name === 'unpaid-reopen-pending') await page.click('.pro-upgrade-button');
      }
      const release = releaseCheck;
      releaseCheck = undefined;
      release();
    };

    await waitForHeldCheck();
    if (['network', 'server', 'processing'].includes(name)) {
      await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent.includes('retry'));
      assert.equal(await page.$(discardNotice), null, 'failed or inconclusive checks never show the notice');
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pending_creem_checkout')), checkoutId);
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_license_key')), null);
      assert.equal(await page.$('[data-creem-checkout]'), null);
      outcome = 'unpaid';
      await clickButton(page, 'Discard and pay again');
      await waitForHeldCheck();
    }

    if (name === 'paid') {
      await page.waitForFunction(key => [...document.querySelectorAll('input')].some(input => input.value === key), {}, key);
      assert.equal(createCount, 0, 'a paid checkout never starts a second checkout');
      assert.equal(await page.$(discardNotice), null, 'a paid checkout never shows the discard notice');
    } else {
      if (['unpaid-close-pending', 'unpaid-reopen-pending'].includes(name)) {
        await page.waitForFunction(() => localStorage.getItem('devsnapkit_pending_creem_checkout') === null);
        if (name === 'unpaid-close-pending') await page.click('.pro-upgrade-button');
        await page.waitForSelector('[data-pro-modal]');
        assert.equal(await page.$(discardNotice), null, 'a check started before closing cannot leave a stale notice in a reopened modal');
      }
      await page.waitForSelector('[data-creem-checkout]', { visible: true });
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pending_creem_checkout')), null);
      assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pro_unlocked')), null);
      if (!['unpaid-close-pending', 'unpaid-reopen-pending'].includes(name)) {
        await page.waitForSelector(discardNotice, { visible: true, timeout: 1500 });
        assert.equal(await page.$eval(discardNotice, node => node.textContent), 'Previous payment discarded. You can pay again now.');
        assert.equal(await page.$eval(discardNotice, node => node.getAttribute('aria-live')), 'polite');
      }
      if (['unpaid-close-button', 'unpaid-close-escape'].includes(name)) {
        if (name === 'unpaid-close-button') await clickButton(page, 'Close upgrade dialog');
        else await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('[data-pro-modal]'));
        await page.click('.pro-upgrade-button');
        await page.waitForSelector('[data-pro-modal]');
        assert.equal(await page.$(discardNotice), null, 'closing and reopening the modal never restores a stale discard notice');
      }
      await page.click('[data-creem-checkout]');
      await page.waitForFunction(selector => !document.querySelector(selector), { timeout: 1000 }, discardNotice);
      for (let i = 0; i < 100 && !releaseCreate; i++) await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(typeof releaseCreate, 'function');
      assert.equal(
        await page.evaluate(() => localStorage.getItem('devsnapkit_pending_creem_checkout')),
        null,
        'the notice hides when checkout starts, before the new checkout response'
      );
      releaseCreate();
      await page.waitForFunction(
        () => localStorage.getItem('devsnapkit_pending_creem_checkout') === 'ch_SECONDCHECKOUT12345'
      );
      assert.equal(createCount, 1);
      // Simulate cross-tab storage unlock from the opened Creem return tab.
      await page.evaluate(key => {
        localStorage.setItem('devsnapkit_pro_unlocked', 'true');
        localStorage.setItem('devsnapkit_license_key', key);
        window.dispatchEvent(new StorageEvent('storage', { key: 'devsnapkit_license_key', newValue: key }));
      }, key);
      await page.waitForFunction(key => localStorage.getItem('devsnapkit_license_key') === key, {}, key);
    }

    assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_license_key')), key);
    assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pro_unlocked')), 'true');
    assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pending_creem_checkout')), null);
    assert.equal(requests[0].checkoutId, checkoutId);
    assert.deepEqual(errors, []);
    await page.close();
  }
});

test('closing an unpaid Creem checkout and returning to editor stops claim-license polling', async t => {
  const base = await serveBuild(t);
  const browser = await launchBrowser();
  t.after(() => browser.close());

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1050, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('devsnapkit_welcome_dismissed', 'true');
    localStorage.setItem('devsnapkit_welcome_seen', '1');
    window.open = () => {
      const mockWin = { closed: false, close() { this.closed = true; } };
      window.__creemPopup = mockWin;
      return mockWin;
    };
  });

  let verifyCount = 0;
  let claimCount = 0;
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = new URL(request.url());
    const json = (data, status = 200) =>
      request.respond({ status, contentType: 'application/json', body: JSON.stringify(data) });

    if (url.pathname === '/api/creem-create-checkout') {
      await json({ id: checkoutId, checkoutUrl: `https://checkout.creem.io/${checkoutId}` });
      return;
    }
    if (url.pathname === '/api/creem-verify-checkout') {
      verifyCount++;
      await json({ success: false, unpaid: true, pending: false }, 202);
      return;
    }
    if (url.pathname === '/api/claim-license') {
      claimCount++;
      await json({ success: false }, 403);
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      await json({ valid: false });
      return;
    }
    await request.continue();
  });

  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.click('.pro-upgrade-button');
  await page.waitForSelector('[data-creem-checkout]');
  await page.click('[data-creem-checkout]');
  await page.waitForFunction(() => typeof window.__creemPopup === 'object');

  // Close checkout without paying
  await page.evaluate(() => { window.__creemPopup.closed = true; });
  await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent.includes('not been paid'));

  // Close Pro modal and return to editor
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[data-pro-modal]'));

  // Wait longer than the old 3s polling interval to verify zero background claim-license requests
  await new Promise(resolve => setTimeout(resolve, 4000));
  assert.equal(verifyCount, 1);
  assert.equal(claimCount, 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pro_unlocked')), null);

  // Reloading the page also stays quiet for the confirmed-unpaid checkout
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(resolve => setTimeout(resolve, 1000));
  assert.equal(claimCount, 0);
  assert.deepEqual(errors, []);
  await page.close();
});
