// Called only after the browser's download click has succeeded. Best effort UI.
export function downloadStarted() {
  try { window.dispatchEvent(new Event('dsk:download-started')); } catch {}
}
