import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser } from './helpers/browser.mjs';

test('admin UI stores only a token and removes legacy saved passwords', { skip: !process.env.TEST_UI_URL }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const password = 'qa-browser-password-never-persist';
    const requests = [];
    await page.evaluateOnNewDocument(() => localStorage.setItem('devsnapkit_admin_secret', 'legacy-password'));
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().includes('/api/admin/auth')) {
        requests.push({ type: 'auth', body: JSON.parse(request.postData()) });
        request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, token: 'qa-session-token', expiresIn: 604800 }) });
      } else if (request.url().includes('/api/admin/stats')) {
        requests.push({ type: 'stats', headers: request.headers() });
        // Avoid rendering unrelated dashboard data: a failed stats request keeps login state.
        request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'QA stats unavailable' }) });
      } else request.continue();
    });
    await page.goto(new URL('/admin', process.env.TEST_UI_URL).href, { waitUntil: 'networkidle0' });
    assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_admin_secret')), null);
    assert.ok(!await page.evaluate(() => document.body.innerText.includes('devsnapkit_admin_2026')));
    await page.type('input[type=password]', password);
    await page.click('button[type=submit]');
    await page.waitForFunction(() => localStorage.getItem('devsnapkit_admin_token') === 'qa-session-token');
    await page.waitForFunction(() => !document.querySelector('input[type=password]'));
    assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_admin_secret')), null);
    assert.equal(requests.find(r => r.type === 'auth').body.secret, password);
    const stats = requests.find(r => r.type === 'stats');
    assert.equal(stats.headers.authorization, 'Bearer qa-session-token');
    assert.equal(stats.headers['x-admin-secret'], undefined);
    assert.ok(!await page.evaluate(password => Object.values(localStorage).some(value => value.includes(password)), password));
  } finally { await browser.close(); }
});
