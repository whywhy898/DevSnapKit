import type { EditorSnapshot } from '../useHistory';
import { MOCKUP_PRESETS } from '../templates';

export const SOCIAL_SAMPLE = MOCKUP_PRESETS.find(sample => sample.id === 'saas')!;
export const SOCIAL_TEMPLATE_ID = 'social-launch';

/** Pure snapshot construction. IDs belong to the command, never the catalog. */
export function buildSocialLaunchSnapshot(before: EditorSnapshot, ids: { headline: string; description: string }): EditorSnapshot {
  const replaceSample = before.primaryMediaOrigin?.kind === 'builtin';
  return {
    ...before,
    templateContext: { id: SOCIAL_TEMPLATE_ID, version: 1, mediaRegion: { x: 0, y: .30, width: 1, height: .68 }, textRoles: { ...ids } },
    primaryMediaOrigin: replaceSample ? { kind: 'builtin', sampleId: SOCIAL_SAMPLE.id } : before.primaryMediaOrigin ?? { kind: 'unknown' },
    imageSrc: replaceSample ? SOCIAL_SAMPLE.svgDataUri : before.imageSrc,
    imageName: replaceSample ? 'social-launch-sample.svg' : before.imageName,
    windowTitle: before.windowTitle,
    selectedPreset: replaceSample ? SOCIAL_SAMPLE.id : before.selectedPreset,
    textDocument: { version: 1, layers: [
      { id: ids.headline, content: 'Ship it.', centerX: .5, centerY: .13, widthRatio: .84, font: 'manrope', fontSize: 72, weight: 800, italic: false, color: '#FFFFFF', align: 'center' },
      { id: ids.description, content: 'One screenshot. One clear update.', centerX: .5, centerY: .25, widthRatio: .82, font: 'manrope', fontSize: 28, weight: 400, italic: false, color: '#E2E8F0', align: 'center' },
    ] },
    aspectRatioId: 'og', customCanvasSize: { width: 1500, height: 900 },
    gradientId: 'mesh-dark', windowTheme: 'browser', padding: 64, roundedCorners: 12,
    shadowLevel: 'soft', shadowOpacity: 35, activeCuratedLayout: 'center-hero',
    cornerStyle: 'default', layoutPreset: 'flat', layoutMode: 'single', duoLayout: 'side',
    bgType: 'gradient', solidColor: '#0b0f19', isCustomGradient: false,
    customGradColor1: '#6366f1', customGradColor2: '#ec4899', customGradAngle: 135, selectedPattern: 'dots',
    vfxNoise: false, vfxNoiseOpacity: 8, vfxGlow: false, vfxGlowColor: '#6366f1', vfxGlowOpacity: 30,
    bgImageSrc: null, bgImageBlur: 0, bgImageOpacity: 100, bgImageFit: 'cover',
    hideMockup: false, mockupZoom: 100, mockupOffsetX: 0, mockupOffsetY: 0,
    imageZoom: 100, imageOffsetX: 0, imageOffsetY: 0,
  };
}
