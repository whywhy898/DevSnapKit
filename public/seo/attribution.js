// Shared by static pages and the studio. No cookies, image data or fingerprinting.
(function () {
  'use strict';
  if (window.DevSnapKitAnalytics) return;
  const key = 'dsk_attribution_v2';
  const fields = ['utm_source', 'utm_medium', 'utm_campaign', 'ref'];
  let state = { sessionId: 's_' + (window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)) };
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(key) || 'null');
    if (saved && typeof saved.sessionId === 'string' && /^s_[a-zA-Z0-9_-]{8,60}$/.test(saved.sessionId)) state = saved;
  } catch {}
  const params = new URL(window.location.href).searchParams;
  for (const field of fields) {
    // First landing URL wins for the browser session, including direct traffic.
    if (typeof state[field] !== 'string') state[field] = (params.get(field) || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120);
    else state[field] = state[field].replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120);
  }
  try { window.sessionStorage.setItem(key, JSON.stringify(state)); } catch {}
  let editorOpened = false;
  function context() {
    return Object.fromEntries(['sessionId', ...fields].map(field => [field, state[field]]).concat([['path', window.location.pathname.slice(0, 512)]]));
  }
  function endpoint(path) {
    const host = window.location.hostname;
    const production = host === 'devsnapkit.com' || host === 'www.devsnapkit.com';
    return path + (!production && new URL(window.location.href).searchParams.get('simulate_api_fail') === '1' ? '?simulate_api_fail=1' : '');
  }
  function track(name) {
    try {
      const event = ({ page_view: 'editor_open', seo_editor_open: 'editor_open', export_image: 'export', copy_image: 'export', poster_export_success: 'export' })[name] || name;
      if (!['visit', 'editor_open', 'export'].includes(event)) return;
      if (event === 'editor_open') { if (editorOpened) return; editorOpened = true; }
      const body = JSON.stringify({ ...context(), event });
      const url = endpoint('/api/event');
      try { if (window.navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return; } catch {}
      Promise.resolve(window.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true, credentials: 'omit' })).catch(() => {});
    } catch { /* Analytics must never interrupt the product. */ }
  }
  window.DevSnapKitAnalytics = { track, context, endpoint };
  track('visit');
}());
