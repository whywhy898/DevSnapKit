const svg = (width, height, accent, label) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#111827"/><rect x="20" y="20" width="${width - 40}" height="70" rx="12" fill="${accent}"/><circle cx="${width / 2}" cy="${height / 2}" r="${width / 5}" fill="${accent}"/><text x="32" y="64" fill="white" font-family="sans-serif" font-size="24">${label}</text><path d="M20 ${height - 60}H${width - 20}" stroke="white" stroke-width="4"/></svg>`).toString('base64')}`;
const primary = svg(820, 600, '#4f46e5', 'Baseline primary');
const secondary = svg(820, 600, '#0891b2', 'Baseline secondary');
const logo = svg(120, 60, '#059669', 'DSK');
const qr = await QRCode.toDataURL('https://example.com/baseline', { width: 160, margin: 1 });

export const baselineCases = ['single', 'duo'].flatMap((layoutMode, modeIndex) => ['browser', 'iphone-17'].flatMap((windowTheme, frameIndex) => ['solid', 'preset-gradient', 'custom-gradient', 'texture', 'alpha'].map((background, bgIndex) => {
  const index = modeIndex * 10 + frameIndex * 5 + bgIndex;
  return {
    id: `${layoutMode}-${windowTheme}-${background}`,
    patch: {
      textDocument: { version: 1, layers: index % 2 === 0 ? [] : [
        { id: 'baseline-headline', content: 'A clearer product update', centerX: .5, centerY: .12, widthRatio: .84, font: 'manrope', fontSize: 32, weight: 600, italic: false, color: '#FFFFFF', align: 'center' },
        { id: 'baseline-caption', content: 'Same artwork, same export.', centerX: .5, centerY: .2, widthRatio: .78, font: 'gelasio', fontSize: 18, weight: 600, italic: true, color: '#E2E8F0', align: 'center' },
      ] },
      imageSrc: primary, imageName: 'baseline-primary.svg', secondarySrc: layoutMode === 'duo' ? secondary : null, secondaryName: 'baseline-secondary.svg',
      layoutMode, windowTheme, windowTitle: 'Baseline browser', duoLayout: ['side', 'hero', 'stack'][index % 3],
      aspectRatioId: 'custom', customCanvasSize: { width: 960, height: 720 },
      padding: [48, 88, 124][index % 3], roundedCorners: 14, shadowLevel: ['soft', 'dramatic', '3d'][index % 3], shadowOpacity: 64,
      cornerStyle: 'default', layoutPreset: ['flat', 'tilt-left', 'tilt-right', 'dramatic', 'float'][index % 5],
      mockupZoom: [82, 100, 112][index % 3], mockupOffsetX: [0, -20, 22][index % 3], mockupOffsetY: [0, 16, -18][index % 3],
      bgType: background === 'alpha' ? 'transparent' : background === 'texture' ? 'pattern' : background === 'solid' ? 'solid' : 'gradient',
      solidColor: '#172554', isCustomGradient: background === 'custom-gradient', customGradColor1: '#155e75', customGradColor2: '#7e22ce', customGradAngle: 123,
      selectedPattern: ['dots', 'grid', 'spotlight', 'aurora'][index % 4], vfxGlow: index % 2 === 0, vfxGlowColor: '#38bdf8', vfxGlowOpacity: 28,
      vfxNoise: index % 3 === 1, vfxNoiseOpacity: 8,
      customBrandWatermark: index % 4 === 1 ? 'Baseline brand' : '', logoDataUrl: index % 4 === 2 ? logo : null,
      logoPos: ['bottom-left', 'top-left', 'top-right', 'bottom-right'][index % 4], logoScale: 7, logoOpacity: 0.8,
      qrUrl: '', qrPos: 'bottom-left', qrScale: 9, bgImageSrc: null, bgImageBlur: 0, bgImageOpacity: 100, bgImageFit: 'cover', hideMockup: false,
      imageZoom: 100, imageOffsetX: 0, imageOffsetY: 0,
    },
    extras: { gradientIndex: index % 5, pro: index % 4 !== 0, qrDataUrl: index % 4 === 3 ? qr : null },
  };
})));
import QRCode from 'qrcode';

