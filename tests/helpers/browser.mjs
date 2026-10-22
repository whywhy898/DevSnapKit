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
  const hiddenTextAction = await page.evaluate(text => ![...document.querySelectorAll('button')].some(b => b.offsetParent !== null && b.innerText.replace(/\s+/g, ' ').trim() === text.replace(/\s+/g, ' ').trim()) && [...document.querySelectorAll('[data-canvas-text-controls] button')].some(b => b.innerText.replace(/\s+/g, ' ').trim() === text.replace(/\s+/g, ' ').trim()), text);
  if (hiddenTextAction) await clickButton(page, 'Text');
  await page.waitForFunction(text => [...document.querySelectorAll('button')].some(b => b.offsetParent !== null && b.innerText.replace(/\s+/g, ' ').trim() === text.replace(/\s+/g, ' ').trim()), {}, text);
  const handle = await page.evaluateHandle(text => [...document.querySelectorAll('button')].find(b => b.offsetParent !== null && b.innerText.replace(/\s+/g, ' ').trim() === text.replace(/\s+/g, ' ').trim()), text);
  await handle.evaluate(button => button.click());
  await handle.dispose();
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
  await page.waitForSelector('#studio-canvas');
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
  await fs.rmdir(downloadDirectory);
  return { path: target, milliseconds: Math.round(performance.now() - start) };
}
