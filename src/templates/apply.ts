import type { EditorSnapshot } from '../useHistory';
import { MOCKUP_PRESETS } from '../templates';
import type { MockupTemplate } from './types';
import { TEMPLATE_CATALOG } from './catalog';

export const SOCIAL_SAMPLE = MOCKUP_PRESETS.find(sample => sample.id === 'saas')!;
export const SOCIAL_TEMPLATE_ID = 'social-launch';

/** Pure snapshot construction. IDs belong to the command, never the catalog. */
export function buildSocialLaunchSnapshot(before: EditorSnapshot, ids: { headline: string; description: string }): EditorSnapshot {
  return buildTemplateSnapshot(before, TEMPLATE_CATALOG[0], ids);
}

export function buildTemplateSnapshot(before: EditorSnapshot, template: MockupTemplate, ids: { headline: string; description: string }): EditorSnapshot {
  const sample = MOCKUP_PRESETS.find(item => item.id === template.sampleId);
  if (!sample) throw new Error('Template sample not found');
  const replaceSample = before.primaryMediaOrigin?.kind === 'builtin';
  // Refresh inherited sample labels, including stale labels from older template
  // sessions. A custom title (or any user/unknown media title) remains user-owned.
  const inheritedSampleTitle = MOCKUP_PRESETS.some(preset => preset.title === before.windowTitle);
  return {
    ...before,
    templateContext: { id: template.id, version: template.version, mediaRegion: { ...template.mediaRegion }, textRoles: { ...ids } },
    primaryMediaOrigin: replaceSample ? { kind: 'builtin', sampleId: sample.id } : before.primaryMediaOrigin ?? { kind: 'unknown' },
    imageSrc: replaceSample ? sample.svgDataUri : before.imageSrc,
    imageName: replaceSample ? `${template.id}-sample.svg` : before.imageName,
    windowTitle: replaceSample && inheritedSampleTitle ? sample.title : before.windowTitle,
    selectedPreset: replaceSample ? sample.id : before.selectedPreset,
    textDocument: { version: 1, layers: [
      { ...template.text.headline, id: ids.headline },
      { ...template.text.description, id: ids.description },
    ] },
    aspectRatioId: template.canvas.aspectRatioId, customCanvasSize: { width: 1500, height: 900 },
    ...template.style, activeCuratedLayout: 'center-hero',
    cornerStyle: 'default', layoutPreset: 'flat', layoutMode: 'single', duoLayout: 'side',
    bgType: 'gradient', solidColor: '#0b0f19', isCustomGradient: false,
    customGradColor1: '#6366f1', customGradColor2: '#ec4899', customGradAngle: 135, selectedPattern: 'dots',
    vfxNoise: false, vfxNoiseOpacity: 8, vfxGlow: false, vfxGlowColor: '#6366f1', vfxGlowOpacity: 30,
    bgImageSrc: null, bgImageBlur: 0, bgImageOpacity: 100, bgImageFit: 'cover',
    hideMockup: false, mockupZoom: 100, mockupOffsetX: 0, mockupOffsetY: 0,
    imageZoom: 100, imageOffsetX: 0, imageOffsetY: 0,
  };
}

/** Restore geometry without resurrecting deleted text or replacing user styling. */
export function restoreTemplateLayout(before: EditorSnapshot, template: MockupTemplate): EditorSnapshot {
  if (!before.templateContext || before.templateContext.id !== template.id) return before;
  const roles = before.templateContext.textRoles;
  return {
    ...before, aspectRatioId: template.canvas.aspectRatioId, customCanvasSize: { width: 1500, height: 900 },
    templateContext: { ...before.templateContext, mediaRegion: { ...template.mediaRegion } },
    mockupZoom: 100, mockupOffsetX: 0, mockupOffsetY: 0,
    textDocument: { ...before.textDocument, layers: before.textDocument.layers.map(layer => {
      const target = layer.id === roles.headline ? template.text.headline : layer.id === roles.description ? template.text.description : null;
      return target ? { ...layer, centerX: target.centerX, centerY: target.centerY, widthRatio: target.widthRatio } : layer;
    }) },
  };
}

export function releaseTemplateMediaRegion(before: EditorSnapshot): EditorSnapshot {
  return before.templateContext ? { ...before, templateContext: { ...before.templateContext, mediaRegion: { x: 0, y: 0, width: 1, height: 1 } } } : before;
}
