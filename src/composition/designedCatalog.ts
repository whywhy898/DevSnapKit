import type { EditorSnapshot } from '../useHistory';
import type { CanvasTextLayer } from '../text/types';
import { validateText } from '../text/document';
import { createIndependentComposition } from './document';
import type { CompositionDocument, ObjectFrame, ShapeObject } from './types';
export const DESIGNED_TEMPLATES = [{ id: 'editorial-honey' as const, name: 'Editorial Honey', width: 1600, height: 1200,
  description: 'An editorial launch poster with expressive type, a website mockup and a detail card.' }];
export const logicalFrame = (x: number, y: number, width: number, height: number, rotation = 0): ObjectFrame => ({ centerX: (x + width / 2) / 1600, centerY: (y + height / 2) / 1200, widthRatio: width / 1600, heightRatio: height / 1200, rotation });

export function createHoneyComposition(): CompositionDocument {
  const doc = createIndependentComposition();
  const shape = (id: string, name: string, kind: ShapeObject['shape'], frame: ObjectFrame, fill: string, stroke?: string, radius?: number): ShapeObject => ({ id, name, kind: 'shape', shape: kind, frame, fill, stroke, radius });
  return { ...doc, templateId: 'editorial-honey', placements: { main: logicalFrame(560, 275, 980, 780, -3), secondary: logicalFrame(100, 884, 410, 184) }, detailVisible: true,
    objects: [
      { id: 'cta', name: 'Call to action', kind: 'button', frame: logicalFrame(80, 660, 244, 64), text: 'Find your focus', fontSize: 19, color: '#fffdf0', fill: '#272617', radius: 8, padding: 18, autoWidth: false, arrow: true },
      shape('brand-mark', 'Brand mark', 'mark', logicalFrame(80, 65, 34, 38), '#242313', '#ffdc38'),
    ], decorations: [
      shape('warm-glow', 'Warm glow', 'halo', logicalFrame(650, 100, 1100, 1040), '#ffe56c88'),
      shape('halo-ring', 'Fine circle', 'ellipse', logicalFrame(790, 230, 720, 720), 'transparent', '#e8d57c'),
      shape('top-rule', 'Header rule', 'line', logicalFrame(80, 139, 1440, 1), '#ddd6b8'),
      shape('bottom-rule', 'Footer rule', 'line', logicalFrame(80, 1099, 1440, 1), '#ddd6b8'),
      shape('detail-panel', 'Detail panel', 'rect', logicalFrame(80, 798, 450, 290), '#ffffff', '#eae2be', 18),
      shape('badge-outline', 'Header badge outline', 'rect', logicalFrame(1260, 70, 260, 45), 'transparent', '#d9d1ad', 24),
    ], order: ['main', 'secondary', 'brand-mark', 'cta'] };
}

export function buildDesignedSnapshot(before: EditorSnapshot, templateId: 'editorial-honey', prefix: string): EditorSnapshot {
  if (templateId !== 'editorial-honey') throw new Error('Unknown designed template');
  const id = (role: string) => `${prefix}-${role}`;
  const layer = (role: string, content: string, x: number, y: number, width: number, height: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CanvasTextLayer => validateText({
    id: id(role), content, centerX: (x + width / 2) / 1600, centerY: (y + height / 2) / 1200, widthRatio: width / 1600,
    font: 'manrope', fontSize, weight: 400, italic: false, color: '#242313', align: 'left', lineHeight: 1.25, ...extra,
  });
  const layers = [
    layer('brand', 'Bloomboard', 130, 63, 600, 40, 31, { weight: 800, letterSpacing: -1.5 }),
    layer('badge', 'Build something good', 1270, 82, 240, 18, 14, { weight: 600, letterSpacing: 1.6, textTransform: 'uppercase', align: 'center' }),
    layer('eyebrow', 'Your next chapter in discovery', 80, 232, 470, 16, 13, { weight: 800, letterSpacing: 2.6, textTransform: 'uppercase', color: '#8d711e' }),
    layer('headline', 'Make room\nfor your\nnext idea.', 80, 282, 470, 236.52, 73, { weight: 800, lineHeight: 1.08, letterSpacing: -4.3,
      runs: [{ text: 'Make room\nfor your\n' }, { text: 'next idea.', font: 'gelasio', weight: 400, italic: true, highlightColor: '#ffdb40' }] }),
    layer('description', 'Projects. People. Possibilities.\nA calmer way to move forward.', 80, 555, 450, 73.6, 23, { lineHeight: 1.6, color: '#746f56' }),
    layer('detail-label', 'How it works', 100, 820, 200, 13, 10, { weight: 600, color: '#8c7c45', letterSpacing: 1, textTransform: 'uppercase' }),
    layer('detail-status', 'Illustrative workflow', 310, 820, 200, 13, 10, { weight: 600, color: '#8c7c45', letterSpacing: 1, textTransform: 'uppercase', align: 'right' }),
    layer('detail-heading', 'Small steps. Thoughtful progress.', 100, 846, 410, 22, 17, { weight: 800, letterSpacing: -.3 }),
    layer('disclosure', 'Product preview · All names and numbers are illustrative', 600, 1060, 910, 20, 13, { color: '#756743', align: 'center' }),
    layer('website', 'bloomboard.example ↗', 80, 1130, 700, 32, 24, { weight: 800, letterSpacing: -.6 }),
    layer('credit', 'Visual crafted with DevSnapKit', 1000, 1134, 520, 22, 16, { color: '#9d9379', align: 'right' }),
  ];
  const replaceMain = !before.imageSrc || before.primaryMediaOrigin?.kind === 'builtin';
  const replaceDetail = !before.secondarySrc || before.secondaryMediaOrigin?.kind === 'builtin';
  const compositionDocument = createHoneyComposition();
  compositionDocument.knownTextIds = layers.map(text => text.id);
  compositionDocument.order.push(...layers.map(text => text.id));
  return { ...before, compositionDocument,
    templateContext: { id: templateId, version: 1, mediaRegion: { x: 0, y: 0, width: 1, height: 1 }, textRoles: { headline: id('headline'), description: id('description') } },
    textDocument: { version: 1, layers },
    imageSrc: replaceMain ? '/designed/examples/bloom-dashboard.svg' : before.imageSrc,
    imageName: replaceMain ? 'bloom-dashboard.svg' : before.imageName,
    primaryMediaOrigin: replaceMain ? { kind: 'builtin', sampleId: 'bloom-dashboard' } : before.primaryMediaOrigin ?? { kind: 'unknown' },
    windowTitle: replaceMain ? 'bloomboard.example' : before.windowTitle,
    secondarySrc: replaceDetail ? '/designed/examples/bloom-workflow.svg' : before.secondarySrc,
    secondaryName: replaceDetail ? 'bloom-workflow.svg' : before.secondaryName,
    secondaryMediaOrigin: replaceDetail ? { kind: 'builtin', sampleId: 'bloom-workflow' } : before.secondaryMediaOrigin ?? { kind: 'unknown' },
    aspectRatioId: 'custom', customCanvasSize: { width: 1600, height: 1200 }, bgType: 'solid', solidColor: '#fbf8eb',
    windowTheme: 'browser', padding: 0, roundedCorners: 14, shadowLevel: 'soft', shadowOpacity: 45, hideMockup: false,
    layoutMode: 'single', duoLayout: 'side', layoutPreset: 'flat', cornerStyle: 'default',
    mockupZoom: 100, mockupOffsetX: 0, mockupOffsetY: 0, imageZoom: 100, imageOffsetX: 0, imageOffsetY: 0,
    vfxGlow: false, vfxNoise: false, bgImageSrc: null,
  };
}
