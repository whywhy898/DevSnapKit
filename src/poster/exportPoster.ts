import { toPng } from 'html-to-image';
import { artworkFontCSS, ensureArtworkFonts, prepareArtworkImages } from '../export/prepareArtworkExport';

export async function preparePoster(root: HTMLElement) {
  await ensureArtworkFonts(['normal 800 73px "Poster Manrope"', 'italic 400 78px "Poster Gelasio"']);
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
  const fontEmbedCSS = await artworkFontCSS(root);
  if (!fontEmbedCSS.includes('data:')) throw new Error('Poster font embedding failed. Please try again.');
  // The production CSP intentionally disallows fetch(blob:). Read original local
  // Blobs directly instead of relaxing connect-src or changing the user's preview.
  const artwork = root.cloneNode(true) as HTMLElement;
  await prepareArtworkImages(artwork, resolveBlob);
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
