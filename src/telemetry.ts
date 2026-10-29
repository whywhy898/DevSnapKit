// The shared runtime is loaded before the studio entry in index.html.
declare global {
  interface Window {
    DevSnapKitAnalytics?: { track(event: string, metadata?: Record<string, unknown>): void };
  }
}

export type TelemetryEventType = 
  | 'seo_landing_view'
  | 'seo_editor_open'
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
  | 'theme_mode_toggle'
  | 'poster_open'
  | 'poster_asset_replaced'
  | 'poster_export_success'
  | 'poster_export_failed';

export function trackEvent(eventType: TelemetryEventType, metadata?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  try { window.DevSnapKitAnalytics?.track(eventType, metadata); } catch {}
}
