// Shared by static SEO pages and the studio. No image data, cookies or URL queries.
(function () {
  'use strict';
  if (window.DevSnapKitAnalytics) return;
  const paths = ['/screenshot-beautifier/', '/og-image-generator/', '/product-hunt-image-maker/', '/add-text-to-image/'];
  const key = 'dsk_attribution_v1';
  const timeout = 30 * 60 * 1000;
  const entryPath = path => paths.find(value => value === path || value.slice(0, -1) === path);
  const hostname = value => {
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) ? url.hostname.slice(0, 253) : 'direct';
    } catch { return 'direct'; }
  };
  const newSession = () => ({
    sid: 's_' + (window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)),
    entry: null,
    referrer: hostname(document.referrer),
    sequence: 0,
    lastSeen: Date.now(),
  });
  let state = newSession();
  let persistent = false;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(key) || 'null');
    if (saved && /^s_[a-zA-Z0-9_-]{8,60}$/.test(saved.sid) &&
        (saved.entry === null || paths.includes(saved.entry)) &&
        (saved.referrer === 'direct' || /^[a-z0-9.-]{1,253}$/i.test(saved.referrer)) &&
        Number.isSafeInteger(saved.sequence) && saved.sequence >= 0 && saved.sequence < 999999999 &&
        Number.isFinite(saved.lastSeen) && saved.lastSeen <= Date.now() && Date.now() - saved.lastSeen < timeout) {
      state = saved;
    }
  } catch {}
  const currentEntry = entryPath(window.location.pathname);
  if (!state.entry) {
    if (currentEntry) state.entry = currentEntry;
    else {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.origin === window.location.origin) state.entry = entryPath(referrer.pathname) || null;
      } catch {}
    }
  }
  const save = () => {
    try { window.sessionStorage.setItem(key, JSON.stringify(state)); persistent = true; }
    catch { persistent = false; }
  };
  save();

  function track(event, metadata) {
    try {
      const expired = Date.now() - state.lastSeen >= timeout || state.sequence >= 999999999;
      if (expired) {
        state = newSession();
        state.entry = currentEntry || null;
      }
      if (expired && currentEntry && event !== 'seo_landing_view') track('seo_landing_view');
      state.lastSeen = Date.now();
      state.sequence += 1;
      save();
      const meta = { ...metadata };
      if (event === 'upload_image' || event === 'upload_logo') delete meta.name;
      // Reserved fields always come from validated first-entry context.
      delete meta.seo_entry;
      delete meta.entry_referrer;
      delete meta.attribution_storage;
      meta.event_sequence = state.sequence;
      if (state.entry) {
        meta.seo_entry = state.entry;
        meta.entry_referrer = state.referrer;
      }
      meta.attribution_storage = persistent ? 'session' : 'memory';
      const ua = window.navigator.userAgent || '';
      const device = /tablet|ipad|playbook|silk|android(?!.*mobi)/i.test(ua) || (window.innerWidth >= 768 && window.innerWidth <= 1024)
        ? 'tablet' : /mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua) || window.innerWidth < 768 ? 'mobile' : 'desktop';
      const browser = /Firefox/.test(ua) ? 'Firefox' : /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Other';
      const body = JSON.stringify({ event, sessionId: state.sid, path: window.location.pathname,
        referrer: hostname(document.referrer), device, browser, metadata: meta, timestamp: new Date().toISOString() });
      try {
        if (window.navigator.sendBeacon?.('/api/telemetry/event', new Blob([body], { type: 'application/json' }))) return;
      } catch {}
      Promise.resolve(window.fetch('/api/telemetry/event', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true,
      })).catch(() => {});
    } catch { /* Analytics must never interrupt the product. */ }
  }
  window.DevSnapKitAnalytics = { track };
  if (currentEntry) {
    track('seo_landing_view');
    document.addEventListener('click', event => {
      try {
        const anchor = event.target?.closest?.('a[href]');
        if (!anchor) return;
        const url = new URL(anchor.href, window.location.origin);
        if (url.origin === window.location.origin && url.pathname === '/' && url.searchParams.get('editor') === '1') track('seo_editor_open');
      } catch {}
    });
  }
}());
