const comparison = document.querySelector('[data-comparison]');
const reveal = document.querySelector('#reveal');
if (comparison && reveal) {
  const updateReveal = () => {
    const position = Number(reveal.value);
    comparison.style.setProperty('--reveal', `${position}%`);
    reveal.setAttribute('aria-valuetext', `${100 - position}% of the styled export revealed`);
  };
  reveal.addEventListener('input', updateReveal);
  updateReveal();
}

const root = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : systemTheme.matches;
const syncThemeLabel = () => {
  if (!themeToggle) return;
  themeToggle.textContent = isDark() ? 'Light' : 'Dark';
  themeToggle.setAttribute('aria-label', `Switch to ${isDark() ? 'light' : 'dark'} theme`);
};
themeToggle?.addEventListener('click', () => {
  root.dataset.theme = isDark() ? 'light' : 'dark';
  try { localStorage.setItem('devsnapkit_landing_theme', root.dataset.theme); } catch {}
  syncThemeLabel();
});
systemTheme.addEventListener('change', syncThemeLabel);
syncThemeLabel();

// Reveal related content when it enters view; static content remains available without JS.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06 });
  document.querySelectorAll('.reveal').forEach(section => observer.observe(section));
  root.classList.add('js-motion');
  const revealAll = () => {
    if (!reducedMotion.matches) return;
    root.classList.remove('js-motion');
    observer.disconnect();
  };
  reducedMotion.addEventListener('change', revealAll);
  addEventListener('pagehide', () => observer.disconnect(), { once: true });
}

// Floating "open the studio" card (replaces the header pill). Static pages only: the editor never
// loads this file (index.html skips landing.js in app mode). Per-page target/label come from
// <body data-studio-cta data-studio-cta-label>. Dismissal is remembered for 7 days.
(() => {
  const KEY = 'dsk_studio_cta_dismissed_until';
  const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
  if (root.classList.contains('dsk-app') || document.querySelector('.studio-cta')) return;
  try { if (Number(localStorage.getItem(KEY)) > Date.now()) return; } catch {}
  const body = document.body;
  const href = body.dataset.studioCta || '/?editor=1';
  const label = body.dataset.studioCtaLabel || 'Open the Studio';
  const compact = matchMedia('(max-width: 640px)');
  let started = false;
  let timer = 0;
  let card;
  let dismissed = false;
  const nearEnd = () => {
    // Exclude the bar's reserved space so showing it cannot move its own scroll threshold.
    const padding = body.classList.contains('has-studio-cta') ? parseFloat(getComputedStyle(body).paddingBottom) || 0 : 0;
    return scrollY + innerHeight >= (root.scrollHeight - padding) * 0.75;
  };
  function syncVisibility() {
    if (!card || dismissed) return;
    const visible = !compact.matches || nearEnd();
    card.hidden = !visible;
    body.classList.toggle('has-studio-cta', visible);
    if (!visible) card.classList.remove('is-shown');
    else requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!card.hidden && !dismissed) card.classList.add('is-shown');
    }));
  }
  const onScroll = () => {
    if (dismissed) return;
    if (compact.matches ? nearEnd() : scrollY > innerHeight * 0.25) start();
    syncVisibility();
  };
  function start() {
    if (started || dismissed) return;
    started = true;
    clearTimeout(timer);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/seo/studio-cta.css';
    css.onload = mount;
    document.head.appendChild(css);
  }
  function mount() {
    card = document.createElement('aside');
    card.className = 'studio-cta';
    card.setAttribute('aria-label', 'DevSnapKit Studio');
    card.innerHTML = '<button class="studio-cta__close" type="button" aria-label="Dismiss the studio card"><span aria-hidden="true">×</span></button>'
      + '<div class="studio-cta__top"><div><p class="studio-cta__eyebrow"><span aria-hidden="true">✦</span> DEVSNAPKIT STUDIO</p>'
      + '<p class="studio-cta__title">Turn screenshots into polished mockups</p>'
      + '<p class="studio-cta__text">Add a frame, background and headline, then export, right in your browser.</p></div>'
      + '<img class="studio-cta__visual" src="/seo/examples/cta-thumb.webp" width="336" height="237" alt="" loading="lazy" decoding="async"></div>'
      + '<p class="studio-cta__mini"><strong>DevSnapKit Studio</strong>Free • No uploads</p>'
      + '<a class="studio-cta__button"><span></span><span aria-hidden="true">↗</span></a>'
      + '<p class="studio-cta__meta">Free • 100% in-browser • No uploads</p>';
    const link = card.querySelector('.studio-cta__button');
    link.setAttribute('href', href);
    link.firstChild.textContent = label;
    card.querySelector('.studio-cta__close').addEventListener('click', () => {
      dismissed = true;
      try { localStorage.setItem(KEY, String(Date.now() + DISMISS_MS)); } catch {}
      card.remove();
      body.classList.remove('has-studio-cta');
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
    });
    body.appendChild(card);
    syncVisibility();
  }
  // Desktop: after 2.5 s or a little scroll. Mobile: only while in the last quarter of the page.
  if (!compact.matches) timer = setTimeout(start, 2500);
  compact.addEventListener('change', () => {
    clearTimeout(timer);
    if (!compact.matches && !started && !dismissed) timer = setTimeout(start, 2500);
    onScroll();
  });
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  if (compact.matches) onScroll();
})();
