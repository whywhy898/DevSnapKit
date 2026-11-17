(function () {
  const zone = document.querySelector('[data-hero-drop]');
  const input = document.querySelector('#hero-image');
  const error = document.querySelector('#hero-image-error');
  if (!zone || !input) return;
  function open(file) {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) {
      error.textContent = 'Choose an image up to 15 MB.'; input.value = ''; return;
    }
    // Keep the File in this document's memory; never upload or persist pixels.
    window.DevSnapKitPendingImage = file;
    const url = new URL(window.location.href); url.searchParams.set('editor', '1');
    history.pushState(null, '', url);
    window.dispatchEvent(new Event('dsk:open-editor'));
  }
  input.addEventListener('change', () => open(input.files?.[0]));
  for (const name of ['dragenter', 'dragover']) zone.addEventListener(name, event => { event.preventDefault(); zone.classList.add('is-dragging'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-dragging'));
  zone.addEventListener('drop', event => { event.preventDefault(); zone.classList.remove('is-dragging'); open(event.dataTransfer?.files?.[0]); });
}());
