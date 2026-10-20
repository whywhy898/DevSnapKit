import { getFontEmbedCSS, toPng } from 'html-to-image';

let fontCSS: Promise<string> | undefined;

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
export async function exportPoster(root: HTMLElement, pixelRatio: 1 | 2): Promise<string> {
  await preparePoster(root);
  const issues = posterTextIssues(root);
  if (issues.length) throw new Error(issues.join('\n'));
  if (!root.querySelector('[data-poster-role="main"] img')) throw new Error('Main screenshot is required.');
  fontCSS ??= getFontEmbedCSS(root).catch(error => { fontCSS = undefined; throw error; });
  const fontEmbedCSS = await fontCSS;
  if (!fontEmbedCSS.includes('data:')) throw new Error('Poster font embedding failed. Please try again.');
  return toPng(root, { width: 1600, height: 1200, pixelRatio, fontEmbedCSS,
    backgroundColor: '#fbf8eb', cacheBust: false,
    style: { transform: 'none', transformOrigin: 'top left', margin: '0' },
    filter: node => !(node instanceof HTMLElement && node.dataset.exportIgnore === 'true'),
  });
}

export function downloadPoster(dataUrl: string, pixelRatio: 1 | 2) {
  const a = document.createElement('a');
  a.download = `devsnapkit-poster-${1600 * pixelRatio}x${1200 * pixelRatio}.png`;
  a.href = dataUrl; a.click();
}
