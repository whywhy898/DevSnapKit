(() => {
  const video = document.querySelector('[data-demo-player]');
  const toggle = document.querySelector('[data-demo-play]');
  const expand = document.querySelector('[data-demo-expand]');
  const frame = document.querySelector('[data-demo-frame]');
  const slot = document.querySelector('[data-demo-slot]');
  const dialog = document.querySelector('[data-demo-dialog]');
  const close = document.querySelector('[data-demo-close]');
  const status = document.querySelector('[data-demo-status]');
  if (!video || !toggle || !expand || !frame || !slot || !dialog || !status) return;
  const icon = toggle.querySelector('[data-demo-icon]');
  let desiredPlaying = false;
  let failed = false;
  let hiddenWasPlaying = false;
  let moving = false;
  function label() {
    const state = failed ? 'retry' : video.ended ? 'replay' : desiredPlaying ? 'pause' : 'play';
    toggle.dataset.state = state;
    toggle.setAttribute('aria-label', `${state[0].toUpperCase() + state.slice(1)} walkthrough`);
    icon.textContent = state === 'pause' ? 'Ⅱ' : state === 'retry' || state === 'replay' ? '↻' : '▶';
  }
  function failure() {
    failed = true;
    desiredPlaying = false;
    video.pause();
    status.textContent = 'The video could not load. Retry, open the video link, or follow the written steps below.';
    status.hidden = false;
    label();
  }
  async function play() {
    desiredPlaying = true;
    status.hidden = true;
    if (failed || video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
      failed = false;
      video.load();
    }
    if (video.ended) video.currentTime = 0;
    label();
    try {
      await video.play();
      if (!desiredPlaying) video.pause();
    } catch (error) {
      if (error.name === 'AbortError' || !desiredPlaying) return;
      if (error.name === 'NotAllowedError') {
        desiredPlaying = false;
        label();
      } else failure();
    }
  }
  toggle.hidden = false;
  video.controls = false;
  video.muted = true;
  video.addEventListener('error', failure);
  video.querySelectorAll('source').forEach(source => source.addEventListener('error', failure));
  video.addEventListener('ended', () => { desiredPlaying = false; label(); });
  video.addEventListener('play', () => { if (!desiredPlaying && !moving) video.pause(); label(); });
  toggle.addEventListener('click', () => {
    if (desiredPlaying && !failed) { desiredPlaying = false; hiddenWasPlaying = false; video.pause(); label(); }
    else play();
  });
  function relocate(target) {
    const resume = desiredPlaying && !video.ended;
    const time = video.currentTime;
    moving = true;
    target.append(frame);
    // Reparenting a media element can pause it in some browsers.
    if (Math.abs(video.currentTime - time) > .1) video.currentTime = time;
    moving = false;
    if (resume) play();
  }
  if (typeof dialog.showModal === 'function') {
    expand.hidden = false;
    expand.addEventListener('click', () => {
      if (dialog.open) { dialog.close(); return; }
      dialog.showModal();
      document.documentElement.classList.add('demo-expanded');
      relocate(dialog.querySelector('[data-demo-expanded-slot]'));
      expand.setAttribute('aria-label', 'Collapse walkthrough');
      close.focus();
    });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      relocate(slot);
      document.documentElement.classList.remove('demo-expanded');
      expand.setAttribute('aria-label', 'Expand walkthrough');
      expand.focus({ preventScroll: true });
    });
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenWasPlaying = desiredPlaying;
      video.pause();
    } else if (hiddenWasPlaying && desiredPlaying) {
      hiddenWasPlaying = false;
      play();
    }
  });
  label();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion && !navigator.connection?.saveData) play();
})();
