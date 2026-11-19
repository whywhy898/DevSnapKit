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

// Single-pass indexed read avoids O(m^3) correlated subqueries while preserving
// exact ordered per-session cohort semantics via sequence-ordered reduction.
const query = `
SELECT
  json_extract(metadata, '$.seo_entry') AS entry,
  session_id,
  event_type,
  json_extract(metadata, '$.event_sequence') AS event_order
FROM events
WHERE created_at >= datetime('now', '-30 days')
  AND created_at <= datetime('now')
  AND +session_id LIKE 's_%'
  AND +session_id != 's_anon'
  AND +event_type IN (
    'seo_landing_view', 'seo_editor_open', 'upload_image',
    'media_slot_add', 'media_slot_replace',
    'export_image', 'copy_image', 'pro_modal_open', 'checkout_click'
  )
  AND json_valid(metadata)
  AND json_extract(metadata, '$.attribution_storage') = 'session'
  AND json_type(metadata, '$.event_sequence') = 'integer'
  AND json_extract(metadata, '$.event_sequence') BETWEEN 1 AND 999999999
  AND json_extract(metadata, '$.seo_entry') IN (
    '/screenshot-beautifier/', '/og-image-generator/',
    '/product-hunt-image-maker/', '/add-text-to-image/'
  )
  AND (
    +event_type NOT IN ('media_slot_add', 'media_slot_replace')
    OR (json_extract(metadata, '$.slot') = 2 AND json_extract(metadata, '$.size') > 0)
  )`;

export async function readSeoFunnel(db?: { prepare(sql: string): { all(): Promise<{ results?: Record<string, unknown>[] }> } }): Promise<SeoFunnelData> {
  const empty: SeoFunnelRow[] = entries.map(([entry, label]) => ({ entry, label, landings: 0, editorOpens: 0, uploads: 0, exports: 0, proOpens: 0, checkoutClicks: 0 }));
  if (!db) return { available: false, windowDays: 30, rows: empty };
  try {
    const result = await db.prepare(query).all();
    if (!Array.isArray(result.results)) return { available: false, windowDays: 30, rows: empty };

    const rowByEntry = new Map(empty.map(row => [row.entry, row]));
    const sessions = new Map<string, { entry: string; events: Array<{ type: string; order: number }> }>();

    for (const item of result.results) {
      const entry = typeof item.entry === 'string' ? item.entry : '';
      const sessionId = typeof item.session_id === 'string' ? item.session_id : '';
      const type = typeof item.event_type === 'string' ? item.event_type : '';
      const order = Number(item.event_order);
      if (!rowByEntry.has(entry) || !sessionId || !type || !Number.isSafeInteger(order)) continue;
      const key = `${entry}\0${sessionId}`;
      let group = sessions.get(key);
      if (!group) {
        group = { entry, events: [] };
        sessions.set(key, group);
      }
      group.events.push({ type, order });
    }

    for (const { entry, events } of sessions.values()) {
      const targetRow = rowByEntry.get(entry);
      if (!targetRow) continue;

      let landedAt: number | undefined;
      for (const e of events) {
        if (e.type === 'seo_landing_view' && (landedAt === undefined || e.order < landedAt)) {
          landedAt = e.order;
        }
      }
      if (landedAt === undefined) continue;
      targetRow.landings += 1;

      let openedAt: number | undefined;
      for (const e of events) {
        if (e.type === 'seo_editor_open' && e.order > landedAt && (openedAt === undefined || e.order < openedAt)) {
          openedAt = e.order;
        }
      }
      if (openedAt === undefined) continue;
      targetRow.editorOpens += 1;

      if (events.some(e => e.type === 'pro_modal_open' && e.order > openedAt)) {
        targetRow.proOpens += 1;
      }
      if (events.some(e => e.type === 'checkout_click' && e.order > openedAt)) {
        targetRow.checkoutClicks += 1;
      }

      let uploadedAt: number | undefined;
      for (const e of events) {
        if (
          (e.type === 'upload_image' || e.type === 'media_slot_add' || e.type === 'media_slot_replace') &&
          e.order > openedAt &&
          (uploadedAt === undefined || e.order < uploadedAt)
        ) {
          uploadedAt = e.order;
        }
      }
      if (uploadedAt === undefined) continue;
      targetRow.uploads += 1;

      if (events.some(e => (e.type === 'export_image' || e.type === 'copy_image') && e.order > uploadedAt)) {
        targetRow.exports += 1;
      }
    }

    return { available: true, windowDays: 30, rows: empty };
  } catch {
    return { available: false, windowDays: 30, rows: empty };
  }
}
