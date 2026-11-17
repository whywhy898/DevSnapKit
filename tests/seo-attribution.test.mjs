import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../public/seo/attribution.js', import.meta.url), 'utf8');
function browser({ path = '/', host = 'devsnapkit.com', storage = new Map(), denied = false, beacon = true, fetchFailure = false } = {}) {
  const sent = [], fetched = [];
  const window = { location: new URL('https://' + host + path), crypto,
    sessionStorage: { getItem(k) { if (denied) throw Error('denied'); return storage.get(k); }, setItem(k, v) { if (denied) throw Error('denied'); storage.set(k, v); } },
    navigator: { sendBeacon(url, blob) { if (beacon === 'throw') throw Error('offline'); if (beacon) sent.push({ url, blob }); return beacon; } },
    fetch(url, options) { if (fetchFailure) throw Error('offline'); fetched.push({ url, body: options.body }); return Promise.resolve({ ok: true }); },
  };
  vm.runInNewContext(source, { window, URL, Blob, Math, Date });
  return { window, storage, sent, fetched, async events() { return Promise.all(sent.map(async s => ({ url: s.url, ...JSON.parse(await s.blob.text()) }))); } };
}
test('landing saves campaign fields and random session, excluding full URLs and image metadata', async () => {
  const b = browser({ path: '/screenshot-beautifier/?utm_source=newsletter&utm_medium=email&utm_campaign=launch&ref=friend&email=private@example.com#secret' });
  const [e] = await b.events();
  assert.equal(e.event, 'visit'); assert.equal(e.utm_source, 'newsletter'); assert.equal(e.utm_medium, 'email'); assert.equal(e.utm_campaign, 'launch'); assert.equal(e.ref, 'friend'); assert.equal(e.path, '/screenshot-beautifier/'); assert.match(e.sessionId, /^s_/);
  assert.ok(!JSON.stringify(e).includes('private@example.com')); assert.ok(!JSON.stringify(e).includes('secret')); assert.equal(b.storage.size, 1);
});
test('first-touch campaign persists through navigation refresh and later campaigns', async () => {
  const first = browser({ path: '/?utm_source=first&ref=friend' });
  const b = browser({ path: '/?editor=1&utm_source=second', storage: first.storage });
  b.window.DevSnapKitAnalytics.track('page_view'); b.window.DevSnapKitAnalytics.track('export_image', { name: 'private.png', image: 'secret' });
  for (const e of await b.events()) { assert.equal(e.utm_source, 'first'); assert.equal(e.ref, 'friend'); assert.equal(e.sessionId, (await first.events())[0].sessionId); assert.ok(!JSON.stringify(e).includes('secret')); }
});
test('direct first touch stays direct throughout the session', async () => {
  const first = browser(); assert.equal((await browser({ path: '/?utm_source=later', storage: first.storage }).events())[0].utm_source, '');
});
test('only three client event names emit, editor opens once and client payment attempts are ignored', async () => {
  const b = browser();
  for (const name of ['page_view', 'page_view', 'seo_editor_open', 'upload_image', 'theme_change', 'checkout_click', 'payment', 'unknown', 'export_image', 'copy_image', 'poster_export_success']) b.window.DevSnapKitAnalytics.track(name);
  assert.deepEqual((await b.events()).map(e => e.event), ['visit', 'editor_open', 'export', 'export', 'export']);
  assert.ok((await b.events()).every(e => e.url === '/api/event'));
});
test('campaign strings are bounded and control characters removed', async () => {
  const [e] = await browser({ path: '/?utm_source=' + 'x'.repeat(130) + '&ref=a%0Ab' }).events(); assert.equal(e.utm_source.length, 120); assert.equal(e.ref, 'ab');
});
test('denied and corrupt storage never interrupt the editor', async () => {
  for (const options of [{ denied: true }, { storage: new Map([['dsk_attribution_v2', '{invalid']]) }, { storage: new Map([['dsk_attribution_v2', '{"sessionId":"bad"}']]) }]) {
    const b = browser(options); assert.doesNotThrow(() => b.window.DevSnapKitAnalytics.track('export_image')); assert.equal((await b.events()).length, 2);
  }
});
for (const beacon of [false, 'throw']) test('beacon fallback and synchronous network failure are safe: ' + beacon, () => {
  const b = browser({ beacon }); assert.equal(b.fetched.length, 1); assert.equal(JSON.parse(b.fetched[0].body).event, 'visit'); assert.doesNotThrow(() => browser({ beacon, fetchFailure: true }));
});
test('simulation affects both endpoints on preview and dev, never production', async () => {
  for (const [host, suffix] of [['branch.pages.dev', '?simulate_api_fail=1'], ['localhost', '?simulate_api_fail=1'], ['devsnapkit.com', ''], ['www.devsnapkit.com', '']]) {
    const b = browser({ host, path: '/?simulate_api_fail=1' }); assert.equal((await b.events())[0].url, '/api/event' + suffix); assert.equal(b.window.DevSnapKitAnalytics.endpoint('/api/feedback'), '/api/feedback' + suffix);
  }
});
test('runtime reload cannot emit a duplicate automatic visit', async () => {
  const b = browser(); vm.runInNewContext(source, { window: b.window, URL, Blob, Math, Date }); assert.equal((await b.events()).length, 1);
});

test('visit is limited to one per document even if another caller requests it; a real reload counts again', async () => {
  const b = browser({ path: '/?utm_source=landing&utm_campaign=one' });
  b.window.DevSnapKitAnalytics.track('visit');
  b.window.location = new URL('https://devsnapkit.com/?editor=1&utm_source=changed');
  for (const name of ['visit', 'page_view', 'seo_editor_open', 'visit', 'export_image', 'export_image']) b.window.DevSnapKitAnalytics.track(name);
  assert.deepEqual((await b.events()).map(e => e.event), ['visit', 'editor_open', 'export', 'export']);
  const reloaded = browser({ path: '/?editor=1&utm_source=changed', storage: b.storage });
  reloaded.window.DevSnapKitAnalytics.track('visit');
  reloaded.window.DevSnapKitAnalytics.track('page_view');
  assert.deepEqual((await reloaded.events()).map(e => e.event), ['visit', 'editor_open']);
  for (const e of [...await b.events(), ...await reloaded.events()]) {
    assert.equal(e.sessionId, (await b.events())[0].sessionId);
    assert.equal(e.utm_source, 'landing');
    assert.equal(e.utm_campaign, 'one');
  }
});
