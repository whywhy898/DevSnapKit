// Built UI + real Pages handler integration. No live credentials or deployment.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core'), ts = require('typescript');
const root = path.resolve(import.meta.dirname, '..'), cache = new Map();
function load(file) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const m = {exports: {}}; cache.set(filename, m);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
  new Function('require', 'module', 'exports', 'crypto', code)(name => name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts'))) : require(name), m, m.exports, webcrypto);
  return m.exports;
}

test('built browser activation, cached-key recheck, rotation and mobile activation', {timeout: 90000}, async () => {
  const handler = load('functions/api/verify-license.ts').onRequestPost;
  const key = 'DSK-ADMIN-' + 'C3'.repeat(32), nextKey = 'DSK-ADMIN-' + 'D4'.repeat(32);
  const canonicalOrigin = 'https://admin-pro-browser.test';
  const env = {DSK_ADMIN_PRO_KEY: key, DSK_ADMIN_PRO_ORIGINS: canonicalOrigin};
  let verifications = 0;
  // Serve the build and adapt the Pages handler to Node HTTP. In this local
  // harness only, the canonical HTTPS URL simulates Cloudflare's request URL.
  const dist = path.join(root, 'dist');
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, canonicalOrigin);
      if (url.pathname === '/api/verify-license') {
        verifications++;
        let body = ''; for await (const chunk of req) body += chunk;
        const result = await handler({request: new Request(url, {method: 'POST', body}), env});
        res.writeHead(result.status, Object.fromEntries(result.headers));
        res.end(await result.text()); return;
      }
      if (url.pathname.startsWith('/api/')) {
        res.writeHead(200, {'Content-Type': 'application/json'}); res.end('{"enabled":false}'); return;
      }
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      let file = path.resolve(dist, relative || 'index.html');
      if (!file.startsWith(dist + path.sep) && file !== path.join(dist, 'index.html')) {res.writeHead(404); res.end(); return;}
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
      const mime = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp'};
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'}); res.end(fs.readFileSync(file));
    } catch {res.writeHead(500); res.end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({executablePath: process.env.TEST_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-sandbox', '--no-proxy-server']});
    const page = await browser.newPage();
    await page.setViewport({width: 1440, height: 1000});
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`http://127.0.0.1:${server.address().port}/?editor=1`, {waitUntil: 'networkidle0'});
    async function activate(credential) {
      await page.click('button[title="Activate or Redeem License Key"]');
      await page.waitForSelector('input[placeholder="DSK-XXXX-XXXX-XXXX"]');
      await page.type('input[placeholder="DSK-XXXX-XXXX-XXXX"]', credential);
      await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Activate Pro Lifetime Pass').click());
      await page.waitForFunction(() => !!document.querySelector('button[title="Manage License Key"]'));
    }
    await activate(key);
    assert.equal(verifications, 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_license_key')), key);
    await page.reload({waitUntil: 'networkidle0'});
    await page.waitForSelector('button[title="Manage License Key"]');
    assert.equal(verifications, 2);
    env.DSK_ADMIN_PRO_KEY = nextKey;
    await page.reload({waitUntil: 'networkidle0'});
    await page.waitForSelector('button[title="Activate or Redeem License Key"]');
    assert.equal(verifications, 3);
    assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_pro_unlocked')), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('devsnapkit_license_key')), null);
    await page.evaluate(() => localStorage.setItem('devsnapkit_pro_unlocked', 'true'));
    await page.reload({waitUntil: 'networkidle0'});
    assert.equal(await page.$('button[title="Manage License Key"]'), null);
    await page.setViewport({width: 390, height: 844});
    await activate(nextKey);
    assert.equal(verifications, 4);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
