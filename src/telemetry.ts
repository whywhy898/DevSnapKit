// Client-side lightweight telemetry for DevSnapKit (devsnapkit.com)
// 100% privacy-compliant, zero cookies, anonymous session tracking

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem('dsk_session_id');
    if (!sid) {
      sid = 's_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      sessionStorage.setItem('dsk_session_id', sid);
    }
    return sid;
  } catch {
    return 's_anon';
  }
}

function detectDevice(): 'desktop' | 'mobile' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua) || (width >= 768 && width <= 1024)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua) || width < 768) {
    return 'mobile';
  }
  return 'desktop';
}

function detectBrowser(): string {
  if (typeof window === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Other';
}

export type TelemetryEventType = 
  | 'page_view'
  | 'upload_image'
  | 'upload_logo'
  | 'preset_change'
  | 'theme_change'
  | 'bg_type_change'
  | 'export_image'
  | 'copy_image'
  | 'pro_modal_open'
  | 'checkout_click'
  | 'media_slot_add'
  | 'media_slot_replace'
  | 'layout_mode_change'
  | 'duo_layout_change'
  | 'undo_action'
  | 'redo_action'
  | 'hide_mockup_toggle'
  | 'zoom_change'
  | 'mockup_zoom_change'
  | 'bg_image_upload'
  | 'theme_mode_toggle';

export function trackEvent(eventType: TelemetryEventType, metadata?: Record<string, any>) {
  if (typeof window === 'undefined') return;

  const payload = {
    event: eventType,
    sessionId: getSessionId(),
    path: window.location.pathname,
    referrer: document.referrer ? new URL(document.referrer, window.location.origin).hostname : 'direct',
    device: detectDevice(),
    browser: detectBrowser(),
    metadata,
    timestamp: new Date().toISOString(),
  };

  const endpoint = '/api/telemetry/event';
  const payloadStr = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payloadStr], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
      return;
    }
  } catch {}

  // Fallback to fetch
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payloadStr,
    keepalive: true,
  }).catch(() => {
    // Silent fail so user experience is never interrupted
  });
}
