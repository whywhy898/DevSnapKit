(() => {
  const video = document.querySelector('[data-demo-player]');
  const button = document.querySelector('[data-demo-play]');
  const status = document.querySelector('[data-demo-status]');
  if (!video || !button) return;

  // Progressive enhancement: the HTML keeps native controls if JS is absent.
  // Do not request media or move the poster until the visitor chooses to play.
  video.controls = false;
  video.tabIndex = -1;
  button.hidden = false;
  const showFailure = () => {
    video.pause();
    video.controls = true;
    video.tabIndex = 0;
    button.dataset.replay = '';
    button.querySelector('.demo-play-label').textContent = 'Try playback again';
    button.setAttribute('aria-label', 'Try playing the add-text walkthrough again');
    button.hidden = false;
    if (status) {
      status.textContent = 'The video could not start. Try again or use the Open video link below.';
      status.hidden = false;
    }
  };
  button.addEventListener('click', async () => {
    button.hidden = true;
    video.controls = true;
    video.tabIndex = 0;
    video.focus({ preventScroll: true });
    if (status) status.hidden = true;
    try {
      if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) video.load();
      if (video.ended) video.currentTime = 0;
      await video.play();
    } catch (error) {
      if (error.name === 'AbortError' && !video.error && video.networkState !== HTMLMediaElement.NETWORK_NO_SOURCE) return;
      showFailure();
    }
  });
  video.addEventListener('error', showFailure);
  // A failing child <source> can leave play() pending instead of rejecting.
  video.querySelectorAll('source').forEach(source => source.addEventListener('error', showFailure));
  video.addEventListener('play', () => { button.hidden = true; });
  video.addEventListener('ended', () => {
    button.dataset.replay = '';
    button.querySelector('.demo-play-label').textContent = 'Replay walkthrough';
    button.setAttribute('aria-label', 'Replay the add-text walkthrough');
    button.hidden = false;
  });
})();
