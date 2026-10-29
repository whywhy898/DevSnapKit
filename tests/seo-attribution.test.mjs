import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const file = new URL('../public/seo/attribution.js', import.meta.url);
const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const KEY = 'dsk_attribution_v1';
let sessionSequence = 0;
function browser({ path = '/screenshot-beautifier/', referrer = 'https://www.google.com/search?q=private', storage = new Map(), denied = false, beacon = true, now = 1_000_000 } = {}) {
  const sent = [], fetched = [], listeners = {};
  let clock = now;
  const sessionStorage = {
    getItem(key) { if (denied) throw Error('denied'); return storage.get(key) ?? null; },
    setItem(key, value) { if (denied) throw Error('denied'); storage.set(key, value); },
  };
  const document = { referrer, addEventListener(name, listener) { listeners[name] = listener; } };
  const location = new URL('https://devsnapkit.com' + path);
  const navigator = { userAgent: 'Chrome desktop', sendBeacon(url, blob) { if (beacon === 'throw') throw Error('offline'); if (beacon) sent.push({ url, blob }); return beacon; } };
  const window = { location, sessionStorage, navigator, innerWidth: 1440, crypto: { randomUUID: () => 'abcdefgh-1234-5678-9012-' + String(++sessionSequence).padStart(12, '0') }, fetch: async (url, options) => fetched.push({ url, body: options.body }) };
  const context = vm.createContext({ window, document, navigator, URL, Blob, Math, Date: class extends Date { static now() { return clock; } } });
  vm.runInContext(source, context);
  assert.equal(typeof window.DevSnapKitAnalytics?.track, 'function', 'shared attribution runtime must be available');
  return { window, storage, listeners, sent, fetched, advance(ms) { clock += ms; }, async payloads() { return Promise.all(sent.map(async x => JSON.parse(await x.blob.text()))); } };
}

test('landing emits anonymous first-entry context without full referrer or URL queries', async () => {
  const b = browser({ path: '/screenshot-beautifier/?email=secret@example.com#private' });
  const [event] = await b.payloads();
  assert.equal(event.event, 'seo_landing_view');
  assert.equal(event.metadata.seo_entry, '/screenshot-beautifier/');
  assert.equal(event.metadata.entry_referrer, 'www.google.com');
  assert.equal(event.metadata.attribution_storage, 'session');
  assert.equal(event.metadata.event_sequence, 1);
  assert.match(event.sessionId, /^s_/);
  assert.ok(!JSON.stringify(event).includes('private'));
  assert.ok(!JSON.stringify(event).includes('secret@example.com'));
});

test('editor upload and export retain the same first entry and session across navigation and refresh', async () => {
  const landing = browser();
  const [first] = await landing.payloads();
  const editor = browser({ path: '/?editor=1&aspect=og', referrer: 'https://devsnapkit.com/screenshot-beautifier/', storage: landing.storage });
  editor.window.DevSnapKitAnalytics.track('upload_image', { count: 1 });
  editor.window.DevSnapKitAnalytics.track('export_image', { format: 'png' });
  for (const e of await editor.payloads()) {
    assert.equal(e.sessionId, first.sessionId);
    assert.equal(e.metadata.seo_entry, '/screenshot-beautifier/');
    assert.equal(e.metadata.entry_referrer, 'www.google.com');
  }
  assert.deepEqual((await editor.payloads()).map(e => e.metadata.event_sequence), [2, 3]);
  const refreshed = browser({ path: '/?editor=1', referrer: '', storage: editor.storage });
  refreshed.window.DevSnapKitAnalytics.track('page_view');
  assert.equal((await refreshed.payloads())[0].sessionId, first.sessionId);
});

test('visiting another tool retains the original SEO entry', async () => {
  const b = browser();
  const other = browser({ path: '/og-image-generator/', storage: b.storage });
  assert.equal((await other.payloads())[0].metadata.seo_entry, '/screenshot-beautifier/');
});

test('expired session starts a new entry and does not revive old entry from internal referrer', async () => {
  const b = browser();
  const next = browser({ path: '/og-image-generator/', storage: new Map(b.storage), now: 1_000_000 + 31 * 60_000, referrer: '' });
  assert.equal((await next.payloads())[0].metadata.seo_entry, '/og-image-generator/');
  assert.notEqual((await next.payloads())[0].sessionId, (await b.payloads())[0].sessionId);
  const editor = browser({ path: '/?editor=1', storage: b.storage, now: 1_000_000 + 31 * 60_000, referrer: '' });
  editor.window.DevSnapKitAnalytics.track('page_view');
  assert.equal((await editor.payloads())[0].metadata.seo_entry, undefined);
});

test('inactivity expiry resets attribution even without a page reload', async () => {
  const b = browser({ path: '/?editor=1', referrer: 'https://devsnapkit.com/og-image-generator/' });
  b.advance(31 * 60_000);
  b.window.DevSnapKitAnalytics.track('export_image');
  assert.equal((await b.payloads())[0].metadata.seo_entry, undefined);
});

test('a landing CTA after inactivity starts a fresh landing cohort before the editor-open event', async () => {
  const b = browser();
  b.advance(31 * 60_000);
  b.listeners.click({ target: { closest: () => ({ href: 'https://devsnapkit.com/?editor=1' }) } });
  const events = await b.payloads();
  assert.deepEqual(events.map(e => e.event), ['seo_landing_view', 'seo_landing_view', 'seo_editor_open']);
  assert.notEqual(events[0].sessionId, events[1].sessionId);
  assert.equal(events[1].sessionId, events[2].sessionId);
});

test('upload telemetry excludes image and logo filenames while retaining size and method', async () => {
  const b = browser({ path: '/' });
  for (const event of ['upload_image', 'upload_logo']) b.window.DevSnapKitAnalytics.track(event, { name: 'private-client-file.png', size: 1234, method: 'file_picker' });
  for (const event of await b.payloads()) {
    assert.equal(event.metadata.name, undefined);
    assert.equal(event.metadata.size, 1234);
  }
});

test('denied storage degrades to page-local memory and recovers only allowlisted same-origin referrers', async () => {
  const b = browser({ path: '/?editor=1', denied: true, referrer: 'https://devsnapkit.com/og-image-generator/?token=private' });
  assert.doesNotThrow(() => b.window.DevSnapKitAnalytics.track('export_image'));
  const [e] = await b.payloads();
  assert.equal(e.metadata.seo_entry, '/og-image-generator/');
  assert.equal(e.metadata.attribution_storage, 'memory');
  assert.ok(!JSON.stringify(e).includes('token'));
  const foreign = browser({ path: '/', denied: true, referrer: 'https://evil.example/og-image-generator/' });
  foreign.window.DevSnapKitAnalytics.track('page_view');
  assert.equal((await foreign.payloads())[0].metadata.seo_entry, undefined);
});

test('invalid persisted state and caller metadata cannot inject an SEO entry', async () => {
  const storage = new Map([[KEY, JSON.stringify({ sid: 's_valid_12345', entry: '/admin?secret=private', referrer: 'not a hostname', lastSeen: 1_000_000 })]]);
  const b = browser({ path: '/', referrer: 'not-a-url', storage });
  b.window.DevSnapKitAnalytics.track('export_image', { seo_entry: '/admin', entry_referrer: 'private', event_sequence: 999, format: 'png' });
  const [e] = await b.payloads();
  assert.equal(e.metadata.seo_entry, undefined);
  assert.equal(e.metadata.entry_referrer, undefined);
  assert.equal(e.metadata.format, 'png');
  assert.equal(e.metadata.event_sequence, 1);
  assert.equal(e.referrer, 'direct');
});

test('editor CTA records a single event without changing the existing deep link', async () => {
  const b = browser();
  const href = 'https://devsnapkit.com/?editor=1&aspect=og';
  b.listeners.click({ target: { closest: () => ({ href }) } });
  const events = await b.payloads();
  assert.equal(events.length, 2);
  assert.equal(events[1].event, 'seo_editor_open');
  assert.equal(events[1].metadata.seo_entry, '/screenshot-beautifier/');
});

for (const beacon of [false, 'throw']) test('beacon failure falls back to fetch: ' + beacon, async () => {
  const b = browser({ beacon });
  assert.equal(b.fetched.length, 1);
  assert.equal(JSON.parse(b.fetched[0].body).event, 'seo_landing_view');
});

test('serialization and synchronous transport errors cannot break editor code', () => {
  const b = browser({ path: '/' });
  const circular = {}; circular.self = circular;
  assert.doesNotThrow(() => b.window.DevSnapKitAnalytics.track('page_view', circular));
  b.window.fetch = () => { throw Error('blocked'); };
  b.window.navigator.sendBeacon = () => false;
  assert.doesNotThrow(() => b.window.DevSnapKitAnalytics.track('page_view'));
});
