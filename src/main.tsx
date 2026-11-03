// "/" ships as a static landing page (index.html). The studio is loaded on demand only for
// editor URLs (e.g. /?editor=1, PayPal returns, /admin); index.html marks them with "dsk-app".
if (document.documentElement.classList.contains('dsk-app')) {
  document.getElementById('landing')?.remove();
  void import('./studio');
}

export {};
