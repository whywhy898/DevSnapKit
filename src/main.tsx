// "/" ships as a static landing page (index.html). The studio is loaded on demand only for
// editor URLs (e.g. /?editor=1, PayPal returns, /admin); index.html marks them with "dsk-app".
import { readPendingOrder } from './paypalCheckout';
let studioStarted = false;
function openStudio() {
  if (studioStarted) return;
  studioStarted = true;
  document.documentElement.classList.add('dsk-app');
  document.getElementById('landing-css')?.remove();
  document.querySelector('.studio-cta')?.remove();
  document.body.classList.remove('has-studio-cta');
  document.getElementById('landing')?.remove();
  void import('./studio');
}
window.addEventListener('dsk:open-editor', openStudio);
if (document.documentElement.classList.contains('dsk-app') || readPendingOrder()) openStudio();

export {};
