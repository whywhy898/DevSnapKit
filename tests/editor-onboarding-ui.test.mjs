import test from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, clickButton } from './helpers/browser.mjs';

const origin = process.env.TEST_UI_URL;
async function withPage(run) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1100 });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/') || (url.protocol.startsWith('http') && url.origin !== new URL(origin).origin)) {
        void request.respond({ status: 200, contentType: 'application/json', body: '{}' });
      } else void request.continue();
    });
    await page.goto(new URL('/?editor=1', origin).href, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#studio-canvas');
    await run(page);
  } finally { await browser.close(); }
}

test('fresh CTA editor entries never show onboarding or write welcome storage flags', { skip: !origin }, () => withPage(async page => {
  for (const query of ['?editor=1', '?editor=1&tool=text', '?editor=1&mode=duo', '?title=Launch', '?theme=dark', '?tx=QA-RETURN', '?status=success', '?claim=true', '?legal=contact']) {
    await page.goto(new URL('/' + query, origin).href, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#studio-canvas');
    assert.equal(await page.$('[data-testid="welcome-overlay"], .welcome-container'), null);
    assert.deepEqual(await page.evaluate(() => ['devsnapkit_welcome_seen', 'dsk_onboarded'].map(key => localStorage.getItem(key))), [null, null]);
    if (/tx=|status=|claim=/.test(query)) assert.ok(await page.$('[data-claim-modal]'), 'Payment returns still open license recovery');
    if (query.includes('title=')) assert.equal(await page.evaluate(() => window.__mockupBaseline.snapshot.windowTitle), 'Launch');
  }
  await page.goto(new URL('/admin', origin).href, { waitUntil: 'networkidle0' });
  assert.equal(await page.$('#studio-canvas, [data-testid="welcome-overlay"]'), null);
}));

test('homepage, tool page and floating studio card CTAs go straight to the editor', { skip: !origin }, () => withPage(async page => {
  for (const [path, selector] of [['/', '.hero a.button'], ['/add-text-to-image/', '.hero-copy a.button'], ['/og-image-generator/', '.studio-cta a']]) {
    await page.goto(new URL(path, origin).href, { waitUntil: 'networkidle0' });
    if (selector.startsWith('.studio-cta')) await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForSelector(selector, { visible: true });
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click(selector)]);
    await page.waitForSelector('#studio-canvas');
    assert.equal(await page.$('[data-testid="welcome-overlay"], .welcome-container'), null);
  }
}));

test('Add text focuses selected placeholder above media, including when padding needs reserving', { skip: !origin }, () => withPage(async page => {
  for (const [padding, small] of [[88, false], [0, false], [0, true]]) {
    await page.evaluate(({ padding, small }) => window.__mockupBaseline.apply({ textDocument: { version: 1, layers: [] }, aspectRatioId: small ? 'custom' : '16-9', customCanvasSize: { width: 320, height: 200 }, padding }), { padding, small });
    await new Promise(resolve => setTimeout(resolve, 200));
    await page.click('[aria-label="Add text"]');
    await page.waitForSelector('[aria-label="Text content"]', { visible: true });
    assert.deepEqual(await page.$eval('[aria-label="Text content"]', el => ({ focused: el === document.activeElement, start: el.selectionStart, end: el.selectionEnd, value: el.value })), { focused: true, start: 0, end: 4, value: 'Text' });
    const bounds = await page.evaluate(() => {
      const text = document.querySelector('[data-text-edit-layout]').getBoundingClientRect();
      const canvas = document.querySelector('#studio-canvas').getBoundingClientRect();
      const media = [...document.querySelectorAll('#studio-canvas [data-media-surface]')].map(el => el.getBoundingClientRect());
      return { clear: media.every(box => text.bottom <= box.top + 1 || text.top >= box.bottom - 1 || text.right <= box.left + 1 || text.left >= box.right - 1), inside: text.left >= canvas.left - 1 && text.right <= canvas.right + 1 && text.top >= canvas.top - 1 && text.bottom <= canvas.bottom + 1 };
    });
    assert.deepEqual(bounds, { clear: true, inside: true });
    await page.keyboard.type('Launch headline');
    assert.equal(await page.$eval('[aria-label="Text content"]', el => el.value), 'Launch headline');
    await clickButton(page, 'Text');
  }
}));

test('Add text reserves a header for a full-canvas independent composition', { skip: !origin }, () => withPage(async page => {
  for (const size of [{ width: 960, height: 600 }, { width: 800, height: 300 }]) {
  await page.evaluate(size => window.__mockupBaseline.apply({
    aspectRatioId: 'custom', customCanvasSize: size, padding: 0, textDocument: { version: 1, layers: [] },
    compositionDocument: {
      version: 1, mediaLayout: 'independent', placements: {
        main: { centerX: .5, centerY: .5, widthRatio: 1, heightRatio: 1, rotation: 0 },
        secondary: { centerX: .5, centerY: .5, widthRatio: .3, heightRatio: .3, rotation: 0 },
      }, mediaPresentation: { main: { frame: 'plain', fit: 'cover', align: 'center' } },
      detailVisible: false, detailFit: 'contain', detailAlign: 'center', detailRadius: 10, detailBorder: 'none', detailShadow: 'none',
      objects: [], decorations: [], order: ['main', 'secondary'], hiddenIds: [], allowBleed: false,
    },
  }), size);
  await new Promise(resolve => setTimeout(resolve, 200));
  await page.click('[aria-label="Add text"]');
  await page.waitForSelector('[aria-label="Text content"]', { visible: true, timeout: 3000 });
  assert.equal(await page.evaluate(() => document.querySelector('[data-text-edit-layout]').getBoundingClientRect().bottom <= document.querySelector('[data-composition-object="main"]').getBoundingClientRect().top), true);
  await clickButton(page, 'Text');
  }
}));

test('resolution labels truthfully identify the QHD and 3.2K exceptions', { skip: !origin }, () => withPage(async page => {
  await clickButton(page, 'Export');
  await page.evaluate(() => window.__mockupBaseline.apply({ aspectRatioId: '16-9' }));
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(el => el.textContent.trim() === 'Free QHD'));
  await page.evaluate(() => window.__mockupBaseline.apply({ aspectRatioId: '4-3' }));
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(el => el.textContent.trim() === 'Pro 3.2K'));
  await page.evaluate(() => window.__mockupBaseline.apply({}, { pro: true }));
  await clickButton(page, 'Pro 3.2K');
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(el => el.textContent.trim() === 'Download 3.2K (3200×2400)'));
}));

test('free export is labeled and batch controls stay unchecked and open Pro; Esc restores focus', { skip: !origin }, () => withPage(async page => {
  await clickButton(page, 'Export');
  for (const label of ['Free 2x', 'Pro 4K']) assert.ok(await page.evaluate(label => [...document.querySelectorAll('button')].some(el => el.textContent.trim() === label), label));
  assert.equal(await page.$$eval('[data-batch-export] input:checked', inputs => inputs.length), 0);
  await page.click('[data-batch-export] input[type="checkbox"]');
  await page.waitForSelector('[data-pro-modal]');
  assert.equal(await page.$$eval('[data-batch-export] input:checked', inputs => inputs.length), 0);
  await page.focus('[data-pro-modal] input');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-pro-modal]', { hidden: true });
  await page.waitForFunction(() => !!document.activeElement?.closest('[data-batch-export]'));
  // Verified Pro retains the existing default four selected sizes.
  await page.evaluate(() => window.__mockupBaseline.apply({}, { pro: true }));
  await page.waitForFunction(() => document.querySelectorAll('[data-batch-export] input:checked').length === 4);
}));

test('upgrade, claim, shortcuts and legal dialogs dismiss with Esc from fields and restore focus', { skip: !origin }, () => withPage(async page => {
  await clickButton(page, 'Export');
  const resolution = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Pro 4K'));
  await resolution.asElement().click();
  await page.waitForSelector('[data-pro-modal]');
  assert.equal(await page.$eval('[data-pro-modal]', el => el.contains(document.activeElement)), true);
  await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
  assert.equal(await page.$eval('[data-pro-modal]', el => el.contains(document.activeElement)), true);
  const claim = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Claim with PayPal Transaction ID'));
  await claim.asElement().click();
  await page.waitForSelector('[data-claim-modal]');
  await page.focus('[data-claim-modal] input'); await page.keyboard.press('Escape');
  await page.waitForSelector('[data-claim-modal]', { hidden: true });
  await page.waitForFunction(() => document.activeElement?.textContent.trim() === 'Pro 4K');
  await page.click('[title="Keyboard Shortcuts (?)"]');
  await page.waitForSelector('[role="dialog"][aria-label="Keyboard shortcuts"]');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { hidden: true });
  await page.waitForFunction(() => document.activeElement?.getAttribute('title') === 'Keyboard Shortcuts (?)', { timeout: 2000 }).catch(async error => {
    throw new Error('Shortcuts focus restore: ' + await page.evaluate(() => document.activeElement?.outerHTML.slice(0,500)), { cause: error });
  });
  await page.goto(new URL('/?legal=contact', origin).href, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[role="dialog"][aria-label="Contact & support"]');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { hidden: true });
  await page.goto(new URL('/?claim=true&legal=contact', origin).href, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[role="dialog"][aria-label="Contact & support"]');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"][aria-label="Contact & support"]', { hidden: true });
  await page.waitForFunction(() => !!document.activeElement?.closest('[data-claim-modal]'), { timeout: 2000 });
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { hidden: true });
}));
