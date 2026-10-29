import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

export async function launchBrowser(extraArgs = []) {
  const candidates = [process.env.BROWSER_EXECUTABLE, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
  let executablePath;
  for (const candidate of candidates) { try { await fs.access(candidate); executablePath = candidate; break; } catch {} }
  if (!executablePath) throw new Error('Install Chrome/Edge or set BROWSER_EXECUTABLE');
  return puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--no-proxy-server', ...extraArgs] });
}

export async function clickButton(page, text) {
  if (text === 'Text' && await page.$('[data-elements-tab]')) {
    await page.$eval('[data-elements-tab]', button => button.click());
    const textSection = await page.$('[data-element-section="text"]');
    if (textSection) await textSection.evaluate(button => button.click());
    return;
  }
  const hiddenTextAction = await page.evaluate(text => ![...document.querySelectorAll('button')].some(b => b.offsetParent !== null && b.innerText.replace(/\s+/g, ' ').trim() === text.replace(/\s+/g, ' ').trim()) && [...document.querySelectorAll('[data-canvas-text-controls] button')].some(b => b.innerText.replace(/\s+/g, ' ').trim() === text.replace(/\s+/g, ' ').trim()), text);
  if (hiddenTextAction) await clickButton(page, 'Text');
  await page.waitForFunction(text => [...document.querySelectorAll('button')].some(b => b.offsetParent !== null && b.innerText.replace(/\s+/g, ' ').trim() === text.replace(/\s+/g, ' ').trim()), {}, text);
  const handle = await page.evaluateHandle(text => [...document.querySelectorAll('button')].find(b => b.offsetParent !== null && b.innerText.replace(/\s+/g, ' ').trim() === text.replace(/\s+/g, ' ').trim()), text);
  await handle.evaluate(button => button.click());
  await handle.dispose();
}

export async function selectElement(page, label) {
  const expanded = await page.$eval('[aria-label="Elements"]', node => node.getAttribute('aria-expanded') === 'true');
  if (!expanded) await page.click('[aria-label="Elements"]');
  await page.click(`[data-element-picker] button[aria-label^="Select ${label}"]`);
}

export async function openImageAdvanced(page) {
  await page.$eval('[data-image-advanced]', node => { if (!node.open) node.querySelector('summary').click(); });
}

// Finish through the shipped Inspector tab, including when Text is already active.
export async function finishTextEditing(page) {
  await clickButton(page, 'Text');
}

// Invalid drafts expose recovery; valid drafts use the editor's real Escape path.
export async function discardTextChanges(page) {
  const recovery = await page.$('[data-text-edit-recovery] [data-text-cancel]');
  if (recovery && await recovery.evaluate(node => node.getClientRects().length > 0)) {
    await recovery.click();
  } else {
    const selector = await page.evaluate(() => {
      const controls = '[data-canvas-text-controls] input, [data-canvas-text-controls] textarea, [data-canvas-text-controls] select, [aria-label="Text content"]';
      if (document.activeElement?.matches(controls)) return null;
      if (document.querySelector('[aria-label="Text content"]')?.getClientRects().length) return '[aria-label="Text content"]';
      return '[data-canvas-text-controls] [aria-label="Text size"]';
    });
    if (selector) await page.focus(selector);
    await page.keyboard.press('Escape');
  }
  await recovery?.dispose();
}

export function legacyPosterUrl(url) {
  const target = new URL(url);
  target.searchParams.set('editor', '1');
  target.searchParams.set('mode', 'poster');
  return target.href;
}

// Navigate the shipped Inspector before interacting; never fill a hidden tab.
export async function revealInspectorControl(page, selector) {
  const tab = await page.evaluate(selector => {
    const node = document.querySelector(selector);
    if (node?.getClientRects().length) return null;
    if (/Canvas (width|height)/.test(selector)) return 'Export';
    if (/data-canvas-text-controls|aria-label="(?:Current text|Text )/.test(selector)) return 'Text';
    return null;
  }, selector);
  if (tab) await clickButton(page, tab);
  await page.waitForSelector(selector, { visible: true });
}

export async function preparePage(browser, url, options = {}) {
  const page = await browser.newPage();
  await page.setViewport(options.viewport || { width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('devsnapkit_welcome_seen', '1');
    sessionStorage.setItem('dsk_session_id', 'qa_poster_v1_' + crypto.randomUUID());
  });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector(new URL(url).searchParams.get('mode') === 'poster' ? '[data-poster-editor]' : '#studio-canvas');
  return page;
}

// Captures the browser's real download stream, never a replacement renderer.
export async function downloadPng(page, directory, filename, trigger) {
  await fs.mkdir(directory, { recursive: true });
  const downloadDirectory = await fs.mkdtemp(path.join(path.resolve(directory), '.download-'));
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDirectory });
  const start = performance.now();
  await trigger();
  let found;
  for (let attempt = 0; attempt < 300; attempt++) {
    const files = await fs.readdir(downloadDirectory);
    found = files.find(file => file.endsWith('.png'));
    if (found) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await client.detach();
  if (!found) {
    const state = await page.evaluate(() => [...document.querySelectorAll('.poster-error,[role=alertdialog]')].map(n => n.textContent).join('; '));
    throw new Error(`No downloaded PNG appeared within 30 seconds${state ? ': ' + state : ''}`);
  }
  const target = path.join(directory, filename);
  await fs.rename(path.join(downloadDirectory, found), target);
  const png = await fs.readFile(target);
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.subarray(-8, -4).toString() !== 'IEND' || !png.readUInt32BE(16) || !png.readUInt32BE(20)) throw new Error('Downloaded PNG is incomplete.');
  let cleanupWarning;
  // Chrome can briefly retain download bookkeeping after the PNG is moved.
  // Retry only transient cleanup failures; never delete any remaining contents.
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await fs.rmdir(downloadDirectory);
      break;
    } catch (error) {
      if (!['ENOTEMPTY', 'EBUSY'].includes(error?.code)) throw error;
      if (attempt === 19) {
        const remaining = await fs.readdir(downloadDirectory);
        // Chrome on Windows can recreate the completed file's name as an empty
        // bookkeeping file after rename. Preserve it; the verified PNG succeeded.
        if (remaining.length !== 1 || remaining[0] !== found || (await fs.stat(path.join(downloadDirectory, found))).size !== 0) throw error;
        cleanupWarning = { code: error.code, directory: downloadDirectory, emptyBookkeepingFile: found };
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  return { path: target, milliseconds: Math.round(performance.now() - start), ...(cleanupWarning ? { cleanupWarning } : {}) };
}
