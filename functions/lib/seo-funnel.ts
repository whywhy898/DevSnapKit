const entries = [
  ['/screenshot-beautifier/', 'Screenshot beautifier'],
  ['/og-image-generator/', 'OG image generator'],
  ['/product-hunt-image-maker/', 'Product Hunt images'],
  ['/add-text-to-image/', 'Text on screenshots'],
] as const;

export interface SeoFunnelRow {
  entry: string;
  label: string;
  landings: number;
  editorOpens: number;
  uploads: number;
  exports: number;
  proOpens: number;
  checkoutClicks: number;
}
export interface SeoFunnelData {
  available: boolean;
  windowDays: number;
  rows: SeoFunnelRow[];
}

// The shared runtime persists an increasing per-session event sequence. Beacons
// may reach D1 out of order, so insertion time/ID cannot establish user order.
// Each stage finds the first matching event AFTER the preceding stage, not merely
// the first event of that type (a visitor may upload again later in a session).
const query = `
WITH normalized AS (
  SELECT id, event_type, session_id,
    CASE WHEN json_valid(metadata) THEN metadata ELSE '{}' END AS meta
  FROM events
  WHERE created_at >= datetime('now', '-30 days') AND created_at <= datetime('now')
    AND session_id LIKE 's_%' AND session_id != 's_anon'
    AND event_type IN ('seo_landing_view', 'seo_editor_open', 'upload_image',
      'media_slot_add', 'media_slot_replace', 'export_image', 'copy_image', 'pro_modal_open', 'checkout_click')
), eligible AS (
  SELECT *, json_extract(meta, '$.seo_entry') AS entry,
    json_extract(meta, '$.event_sequence') AS event_order FROM normalized
  WHERE json_extract(meta, '$.attribution_storage') = 'session'
    AND json_type(meta, '$.event_sequence') = 'integer'
    AND json_extract(meta, '$.event_sequence') BETWEEN 1 AND 999999999
    AND json_extract(meta, '$.seo_entry') IN (
      '/screenshot-beautifier/', '/og-image-generator/',
      '/product-hunt-image-maker/', '/add-text-to-image/')
), landed AS (
  SELECT entry, session_id, MIN(event_order) AS landed_at
  FROM eligible WHERE event_type = 'seo_landing_view' GROUP BY entry, session_id
), opened AS (
  SELECT l.*, (SELECT MIN(e.event_order) FROM eligible e WHERE e.entry = l.entry
    AND e.session_id = l.session_id AND e.event_type = 'seo_editor_open'
    AND e.event_order > l.landed_at) AS opened_at FROM landed l
), uploaded AS (
  SELECT o.*, (SELECT MIN(e.event_order) FROM eligible e WHERE e.entry = o.entry
    AND e.session_id = o.session_id AND (e.event_type = 'upload_image' OR
      (e.event_type IN ('media_slot_add', 'media_slot_replace') AND json_extract(e.meta, '$.slot') = 2 AND json_extract(e.meta, '$.size') > 0))
    AND e.event_order > o.opened_at) AS uploaded_at FROM opened o
), exported AS (
  SELECT u.*, (SELECT MIN(e.event_order) FROM eligible e WHERE e.entry = u.entry
    AND e.session_id = u.session_id AND e.event_type IN ('export_image', 'copy_image')
    AND e.event_order > u.uploaded_at) AS exported_at FROM uploaded u
)
SELECT entry, COUNT(*) AS landings,
  COUNT(opened_at) AS editorOpens, COUNT(uploaded_at) AS uploads, COUNT(exported_at) AS exports,
  SUM(CASE WHEN EXISTS (SELECT 1 FROM eligible e WHERE e.entry = c.entry
    AND e.session_id = c.session_id AND e.event_type = 'pro_modal_open'
    AND e.event_order > c.opened_at) THEN 1 ELSE 0 END) AS proOpens,
  SUM(CASE WHEN EXISTS (SELECT 1 FROM eligible e WHERE e.entry = c.entry
    AND e.session_id = c.session_id AND e.event_type = 'checkout_click'
    AND e.event_order > c.opened_at) THEN 1 ELSE 0 END) AS checkoutClicks
FROM exported c GROUP BY entry`;

export async function readSeoFunnel(db?: { prepare(sql: string): { all(): Promise<{ results?: Record<string, unknown>[] }> } }): Promise<SeoFunnelData> {
  const empty = entries.map(([entry, label]) => ({ entry, label, landings: 0, editorOpens: 0, uploads: 0, exports: 0, proOpens: 0, checkoutClicks: 0 }));
  if (!db) return { available: false, windowDays: 30, rows: empty };
  try {
    const result = await db.prepare(query).all();
    if (!Array.isArray(result.results)) return { available: false, windowDays: 30, rows: empty };
    const rows = empty.map(row => {
      const found = result.results!.find(item => item.entry === row.entry);
      if (!found) return row;
      for (const key of ['landings', 'editorOpens', 'uploads', 'exports', 'proOpens', 'checkoutClicks'] as const) {
        row[key] = Math.max(0, Number(found[key]) || 0);
      }
      return row;
    });
    return { available: true, windowDays: 30, rows };
  } catch {
    return { available: false, windowDays: 30, rows: empty };
  }
}
