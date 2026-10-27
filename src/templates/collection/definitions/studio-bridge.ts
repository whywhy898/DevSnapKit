import type { CuratedTemplateBlueprint, CuratedTextDefinition } from '../types';
import type { CanvasTextLayer } from '../../../text/types';
import { frameFromRect } from '../geometry';

const canvas = { width: 1920, height: 1080 };
const frame = (x: number, y: number, width: number, height: number, rotation = 0) => frameFromRect(canvas, { x, y, width, height }, rotation);
const text = (role: CuratedTextDefinition['role'], content: string, x: number, y: number, width: number, height: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CuratedTextDefinition => ({ role, layer: {
  content, centerX: (x + width / 2) / canvas.width, centerY: (y + height / 2) / canvas.height, widthRatio: width / canvas.width,
  font: 'manrope', fontSize, weight: 600, italic: false, color: '#16130F', align: 'left', lineHeight: 1.2, ...extra,
} });

export const STUDIO_BRIDGE: CuratedTemplateBlueprint = {
  id: 'studio-bridge', version: 1, name: 'Big Type Launch', tier: 'pro', canvas, allowBleed: true, textBehindMedia: ['headline'],
  examples: {
    main: { sampleId: 'kiln-overview', src: '/designed/examples/collection/kiln-overview.svg', name: 'kiln-overview.svg' },
    secondary: { sampleId: 'kiln-deploy', src: '/designed/examples/collection/kiln-deploy.svg', name: 'kiln-deploy.svg' },
  },
  placements: { main: frame(905, 200, 960, 620, -3), secondary: frame(1556, 600, 308, 640, 7) },
  mediaPresentation: {
    main: { frame: 'browser-dark', fit: 'contain', align: 'center', title: 'kiln.example', shadow: { x: 16, y: 16, blur: 0, color: '#16130F', referenceWidth: 960 } },
    secondary: { frame: 'phone-light', fit: 'contain', align: 'center', title: 'Deployment', shadow: { x: 12, y: 12, blur: 0, color: '#16130F', referenceWidth: 308 } },
  },
  text: [
    text('brand', 'kiln', 96, 40, 320, 32, 26, { weight: 800 }),
    text('badge', 'Release 4.0', 520, 44, 320, 30, 22),
    text('eyebrow', 'Preview deploys · Instant rollbacks', 976, 44, 600, 30, 22),
    text('website', 'kiln.example', 1600, 44, 256, 30, 22, { align: 'right' }),
    text('headline', 'Ship\nit.', 46, 118, 1100, 741.28, 452, { weight: 800, lineHeight: .82, letterSpacing: -28.024 }),
    text('description', 'Deploys in 41 seconds.\nRollbacks in one.', 470, 742, 620, 96, 38, { weight: 700, lineHeight: 1.14, letterSpacing: -.76 }),
    text('disclosure', 'Illustrative product demo', 64, 1012, 900, 30, 20),
  ],
  decorations: [{ id: 'kiln-rule', name: 'Header rule', kind: 'shape', shape: 'rect', frame: frame(64, 96, 1792, 2), fill: '#16130F' }],
};
export const STUDIO_BRAND_MARK = { id: 'brand-mark', name: 'Brand mark', kind: 'shape' as const, shape: 'mark' as const, markVariant: 'orbit' as const, frame: frame(64, 43, 24, 24), fill: '#16130F', stroke: '#FF5B1F' };
