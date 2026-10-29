import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const file = new URL('../functions/lib/seo-funnel.ts', import.meta.url);
const module = { exports: {} };
if (fs.existsSync(file)) new Function('exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText)(module.exports);
const read = (...args) => { assert.equal(typeof module.exports.readSeoFunnel, 'function', 'SEO cohort report must exist'); return module.exports.readSeoFunnel(...args); };
const entry = '/screenshot-beautifier/';
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE events (id INTEGER PRIMARY KEY, event_type TEXT, session_id TEXT, path TEXT, referrer TEXT, country TEXT, device_type TEXT, browser TEXT, metadata TEXT, created_at TEXT DEFAULT (datetime('now')))");
  const insert = db.prepare("INSERT INTO events(event_type, session_id, metadata, created_at) VALUES (?, ?, ?, datetime('now', ?))");
  const sequences = new Map();
  function event(session, name, age = '-10 minutes', options = {}) {
    const sequence = options.sequence ?? (sequences.get(session) || 0) + 1;
    sequences.set(session, Math.max(sequence, sequences.get(session) || 0));
    const meta = options.raw ?? JSON.stringify({ seo_entry: options.entry ?? entry, attribution_storage: options.storage ?? 'session', event_sequence: sequence, size: 1234, slot: 2 });
    insert.run(name, session, meta, age);
  }
  const binding = { prepare(sql) { let args = []; return { bind(...values) { args = values; return this; }, async run() { return db.prepare(sql).run(...args); }, async all() { return { results: db.prepare(sql).all(...args) }; } }; } };
  return { db, event, binding };
}

test('funnel deduplicates sessions and requires landing, editor, own-image upload, then export', async () => {
  const f = fixture();
  try {
    for (const type of ['seo_landing_view', 'seo_editor_open', 'upload_image', 'export_image', 'pro_modal_open', 'checkout_click']) {
      f.event('s_complete_1234', type); f.event('s_complete_1234', type);
    }
    for (const type of ['seo_landing_view', 'seo_editor_open', 'export_image']) f.event('s_incomplete_1234', type);
    f.event('s_wrong_order_1234', 'seo_editor_open', '-11 minutes');
    for (const type of ['seo_landing_view', 'upload_image', 'export_image']) f.event('s_wrong_order_1234', type);
    f.event('s_retry_upload_1234', 'seo_landing_view', '-12 minutes');
    f.event('s_retry_upload_1234', 'upload_image', '-11 minutes');
    f.event('s_retry_upload_1234', 'seo_editor_open', '-10 minutes');
    f.event('s_retry_upload_1234', 'upload_image', '-9 minutes');
    f.event('s_retry_upload_1234', 'copy_image', '-8 minutes');
    const result = await read(f.binding);
    assert.equal(result.available, true);
    assert.equal(result.windowDays, 30);
    assert.equal(result.rows.length, 4);
    const row = result.rows.find(x => x.entry === entry);
    assert.deepEqual({ ...row, label: undefined }, { entry, label: undefined, landings: 4, editorOpens: 3, uploads: 2, exports: 2, proOpens: 1, checkoutClicks: 1 });
    assert.ok(row.exports <= row.uploads && row.uploads <= row.editorOpens && row.editorOpens <= row.landings);
  } finally { f.db.close(); }
});

test('invalid JSON, unrecognized entries, memory sessions, old events and events without a landing are excluded', async () => {
  const f = fixture();
  try {
    for (const [sid, options, age] of [
      ['s_memory_1234', { storage: 'memory' }, '-1 minute'],
      ['s_unknown_1234', { entry: '/admin/' }, '-1 minute'],
      ['s_json_1234', { raw: '{broken' }, '-1 minute'],
      ['s_old_1234', {}, '-31 days'],
    ]) for (const type of ['seo_landing_view', 'seo_editor_open', 'upload_image', 'export_image']) f.event(sid, type, age, options);
    f.event('s_no_landing_1234', 'export_image');
    f.event('s_og_valid_1234', 'seo_landing_view', '-1 minute', { entry: '/og-image-generator/' });
    const result = await read(f.binding);
    assert.equal(result.rows.find(x => x.entry === entry).landings, 0);
    assert.equal(result.rows.find(x => x.entry === '/og-image-generator/').landings, 1);
    assert.equal(result.rows.find(x => x.entry === '/og-image-generator/').editorOpens, 0);
  } finally { f.db.close(); }
});

test('missing or failing D1 is reported as unavailable, not a successful empty report', async () => {
  assert.equal((await read()).available, false);
  assert.equal((await read({ prepare() { throw Error('not available'); } })).available, false);
});

test('network arrival order does not erase a valid client journey', async () => {
  const f = fixture();
  try {
    for (const [name, sequence] of [['export_image', 4], ['upload_image', 3], ['seo_editor_open', 2], ['seo_landing_view', 1]]) {
      f.event('s_reordered_1234', name, '-1 minute', { sequence });
    }
    const row = (await read(f.binding)).rows.find(x => x.entry === entry);
    assert.equal(row.editorOpens, 1); assert.equal(row.uploads, 1); assert.equal(row.exports, 1);
  } finally { f.db.close(); }
});

test('a real secondary-image upload also completes the upload stage', async () => {
  const f = fixture();
  try {
    for (const name of ['seo_landing_view', 'seo_editor_open', 'media_slot_replace', 'export_image']) f.event('s_secondary_1234', name);
    const row = (await read(f.binding)).rows.find(x => x.entry === entry);
    assert.equal(row.uploads, 1); assert.equal(row.exports, 1);
  } finally { f.db.close(); }
});

test('the real ingestion handler preserves journey metadata for the SQLite cohort report', async () => {
  const handler = { exports: {} };
  new Function('exports', ts.transpileModule(fs.readFileSync(new URL('../functions/api/telemetry/event.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText)(handler.exports);
  const f = fixture();
  try {
    let sequence = 0;
    for (const event of ['seo_landing_view', 'seo_editor_open', 'upload_image', 'export_image']) {
      const response = await handler.exports.onRequestPost({ request: new Request('https://devsnapkit.com/api/telemetry/event', {
        method: 'POST', body: JSON.stringify({ event, sessionId: 's_ingest_12345678', path: '/', referrer: 'www.google.com',
          metadata: { seo_entry: entry, entry_referrer: 'www.google.com', attribution_storage: 'session', format: 'png', event_sequence: ++sequence } }),
      }), env: { DB: f.binding } });
      assert.equal(response.status, 200);
    }
    const row = (await read(f.binding)).rows.find(x => x.entry === entry);
    assert.equal(row.landings, 1); assert.equal(row.exports, 1);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM events').get().count, 4);
  } finally { f.db.close(); }
});
