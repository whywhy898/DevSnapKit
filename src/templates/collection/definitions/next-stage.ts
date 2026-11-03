import type { CuratedTemplateBlueprint, CuratedTextDefinition } from '../types';
import type { CanvasTextLayer } from '../../../text/types';
import { frameFromRect } from '../geometry';

const canvas = { width: 1080, height: 1920 };
const frame = (x: number, y: number, width: number, height: number, rotation = 0) => frameFromRect(canvas, { x, y, width, height }, rotation);
const text = (role: CuratedTextDefinition['role'], content: string, x: number, y: number, width: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CuratedTextDefinition => ({ role, layer: {
  content, centerX: (x + width / 2) / canvas.width,
  centerY: (y + content.split('\n').length * fontSize * (extra.lineHeight ?? 1.05) / 2) / canvas.height,
  widthRatio: width / canvas.width, font: 'manrope', fontSize, weight: 800, italic: false,
  color: '#F4F0DB', align: 'left', lineHeight: 1.05, ...extra,
} });

/** Private authoring proof. Publication and access are owned by the catalog. */
export const NEXT_STAGE: CuratedTemplateBlueprint = {
  id: 'next-stage', version: 1, name: 'NEXT Stage', tier: 'pro', canvas,
  examples: {
    main: { sampleId: 'tone-player', src: '/designed/examples/next-stage/tone-player.svg', name: 'tone-player.svg' },
    secondary: { sampleId: 'tone-collection', src: '/designed/examples/next-stage/tone-collection.svg', name: 'tone-collection.svg' },
  },
  // At a 430px native shell width the content is 410x722 after chrome.
  placements: { main: frame(450, 260, 560, 1068, -6), secondary: frame(300, 1110, 400, 763, -9) },
  singlePlacement: frame(420, 380, 590, 1125, -6),
  textBehindMedia: ['headline'],
  mediaPresentation: {
    main: { frame: 'phone-dark', fit: 'cover', align: 'center', title: 'Sample tone — player', shadow: { x: 8, y: 26, blur: 38, color: '#0000009C', referenceWidth: 560 } },
    secondary: { frame: 'phone-dark', fit: 'cover', align: 'center', title: 'Sample tone — collection', shadow: { x: 8, y: 22, blur: 30, color: '#0000009C', referenceWidth: 400 } },
  },
  text: [
    text('headline', 'N\nE\nX\nT', 22, 4, 470, 512, { weight: 800, lineHeight: .87, letterSpacing: -27, color: '#D5FF38' }),
    text('eyebrow', 'THE NEXT /\nCHAPTER', 652, 51, 380, 49, { align: 'right', letterSpacing: -1.7, lineHeight: 1.02 }),
    text('description', 'Good things\nare coming.', 747, 1698, 296, 43, { align: 'right', letterSpacing: -1.9, lineHeight: 1.04 }),
    text('website', 'YOUR APP / 03', 758, 1839, 282, 22, { align: 'right', weight: 600, letterSpacing: 3.2 }),
  ],
  decorations: [
    { id: 'next-orbit', name: 'Acid lime orbit', kind: 'shape', shape: 'ellipse', frame: frame(345, 158, 660, 1245, 24), fill: 'transparent', stroke: '#D5FF38', strokeWidth: 1.6 },
  ],
};
