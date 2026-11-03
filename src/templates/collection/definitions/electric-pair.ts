import type { CuratedTemplateBlueprint, CuratedTextDefinition } from '../types';
import type { CanvasTextLayer } from '../../../text/types';
import { frameFromRect } from '../geometry';

const canvas = { width: 1920, height: 1080 };
const frame = (x: number, y: number, width: number, height: number, rotation = 0) => frameFromRect(canvas, { x, y, width, height }, rotation);
const text = (role: CuratedTextDefinition['role'], content: string, x: number, y: number, width: number, _height: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CuratedTextDefinition => ({ role, layer: {
  content, centerX: (x + width / 2) / canvas.width, centerY: (y + content.split('\n').length * fontSize * (extra.lineHeight ?? 1.08) / 2) / canvas.height, widthRatio: width / canvas.width,
  font: 'manrope', fontSize, weight: 600, italic: false, color: '#FFFFFF', align: 'left', lineHeight: 1.08, ...extra,
} });

export const ELECTRIC_PAIR: CuratedTemplateBlueprint = {
  id: 'electric-pair', version: 1, name: 'Electric Pair', tier: 'pro', canvas,
  examples: {
    main: { sampleId: 'trio-workspace-overview', src: '/designed/examples/collection/trio-workspace-overview.svg', name: 'trio-workspace-overview.svg' },
    secondary: { sampleId: 'trio-workspace-activity', src: '/designed/examples/collection/trio-workspace-activity.svg', name: 'trio-workspace-activity.svg' },
  },
  placements: { main: frame(755, 185, 1040, 690, -4), secondary: frame(1570, 440, 290, 580, 7) },
  singlePlacement: frame(780, 200, 1050, 696, -4),
  mediaPresentation: {
    main: { frame: 'browser-dark', fit: 'contain', align: 'center', title: 'workspace.example', shadow: { x: 0, y: 22, blur: 30, color: '#00000066', referenceWidth: 1040 } },
    secondary: { frame: 'phone-dark', fit: 'contain', align: 'center', title: 'Your activity', shadow: { x: 0, y: 18, blur: 24, color: '#00000066', referenceWidth: 290 } },
  },
  text: [
    text('badge', 'DESKTOP + MOBILE', 60, 262, 670, 44, 32, { weight: 800, letterSpacing: 2 }),
    text('headline', 'From idea', 54, 370, 680, 123, 108, { weight: 800, letterSpacing: -5 }),
    text('after-heading', 'to everywhere.', 54, 490, 680, 110, 85, { weight: 800, letterSpacing: -4.3, color: '#A6EFFF' }),
    text('description', 'One product. Every screen.', 60, 620, 680, 60, 42, { weight: 400, letterSpacing: -1.5 }),
    text('website', 'YOUR PRODUCT', 60, 950, 650, 50, 37, { weight: 800 }),
  ],
  decorations: [
    { id: 'electric-plane', name: 'Cobalt diagonal plane', kind: 'shape', shape: 'rect', frame: frame(1000, -450, 650, 2100, 38), fill: '#0756FF' },
    { id: 'electric-orbit', name: 'Cyan elliptical orbit', kind: 'shape', shape: 'ellipse', frame: frame(760, 60, 1070, 970), fill: 'transparent', stroke: '#18EBF4', strokeWidth: 3 },
  ],
};
