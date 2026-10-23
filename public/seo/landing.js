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
