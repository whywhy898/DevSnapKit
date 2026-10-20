import { getFontEmbedCSS, toPng } from 'html-to-image';

let fontCSS: Promise<string> | undefined;
const imageData = new WeakMap<Blob, Promise<string>>();

function inlineLocalImage(blob: Blob): Promise<string> {
  let cached = imageData.get(blob);
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Local image could not be prepared.'));
      reader.onerror = () => reject(new Error('Local image could not be prepared.'));
      reader.readAsDataURL(blob);
    });
    imageData.set(blob, cached);
    cached.catch(() => imageData.delete(blob));
  }
  return cached;
}

export async function preparePoster(root: HTMLElement) {
  await Promise.all([
    document.fonts.load('800 73px "Poster Manrope"'),
    document.fonts.load('italic 400 78px "Poster Gelasio"'),
  ]);
  await document.fonts.ready;
  if (!document.fonts.check('800 73px "Poster Manrope"') || !document.fonts.check('italic 400 78px "Poster Gelasio"')) throw new Error('Poster fonts could not be loaded. Please try again.');
  await Promise.all(Array.from(root.querySelectorAll('img')).map(async image => {
    try { await image.decode(); } catch { throw new Error(`${image.alt || 'Poster image'} could not be loaded. Replace the image and try again.`); }
    if (!image.naturalWidth) throw new Error(`${image.alt || 'Poster image'} is missing.`);
  }));
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export function posterTextIssues(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLElement>('[data-poster-text]')].filter(node =>
    node.scrollHeight > node.clientHeight + 2 || node.scrollWidth > node.clientWidth + 2
  ).map(node => `${node.dataset.posterText}: text exceeds the layout. Shorten it or reduce the font size.`);
}

/** Export the exact artwork DOM. Only the preview shell is scaled; its ancestor
 * scale is removed by cloning the root at its stable 1600 × 1200 logical size. */
export async function exportPoster(root: HTMLElement, pixelRatio: 1 | 2, resolveBlob?: (url: string) => Blob | undefined): Promise<string> {
  await preparePoster(root);
  const issues = posterTextIssues(root);
  if (issues.length) throw new Error(issues.join('\n'));
  if (!root.querySelector('[data-poster-role="main"] img')) throw new Error('Main screenshot is required.');
  fontCSS ??= getFontEmbedCSS(root).catch(error => { fontCSS = undefined; throw error; });
  const fontEmbedCSS = await fontCSS;
  if (!fontEmbedCSS.includes('data:')) throw new Error('Poster font embedding failed. Please try again.');
  // The production CSP intentionally disallows fetch(blob:). Read original local
  // Blobs directly instead of relaxing connect-src or changing the user's preview.
  const artwork = root.cloneNode(true) as HTMLElement;
  for (const image of artwork.querySelectorAll('img')) {
    if (!image.src.startsWith('blob:')) continue;
    const blob = resolveBlob?.(image.src);
    if (!blob) throw new Error(`${image.alt || 'Poster image'} is no longer available. Replace it and try again.`);
    image.src = await inlineLocalImage(blob);
  }
  const host = document.createElement('div');
  Object.assign(host.style, { position: 'absolute', left: '-100000px', top: '0', width: '1600px', height: '1200px', pointerEvents: 'none' });
  host.setAttribute('aria-hidden', 'true');
  host.appendChild(artwork);
  root.parentElement!.appendChild(host);
  try {
    await Promise.all([...artwork.querySelectorAll('img')].map(image => image.decode()));
    return await toPng(artwork, { width: 1600, height: 1200, pixelRatio, fontEmbedCSS,
      backgroundColor: '#fbf8eb', cacheBust: false,
      style: { transform: 'none', transformOrigin: 'top left', margin: '0' },
      filter: node => !(node instanceof HTMLElement && node.dataset.exportIgnore === 'true'),
    });
  } finally { host.remove(); }
}

export function downloadPoster(dataUrl: string, pixelRatio: 1 | 2) {
  const a = document.createElement('a');
  a.download = `devsnapkit-poster-${1600 * pixelRatio}x${1200 * pixelRatio}.png`;
  a.href = dataUrl; a.click();
}
