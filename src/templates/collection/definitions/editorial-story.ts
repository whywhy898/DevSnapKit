import type { CuratedTemplateBlueprint, CuratedTextDefinition } from '../types';
import type { CanvasTextLayer } from '../../../text/types';
import { frameFromRect } from '../geometry';

const canvas = { width: 1080, height: 1350 };
const frame = (x: number, y: number, width: number, height: number, rotation = 0) => frameFromRect(canvas, { x, y, width, height }, rotation);
const text = (role: CuratedTextDefinition['role'], content: string, x: number, y: number, width: number, height: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CuratedTextDefinition => ({ role, layer: {
  content, centerX: (x + width / 2) / canvas.width, centerY: (y + height / 2) / canvas.height, widthRatio: width / canvas.width,
  font: 'manrope', fontSize, weight: 400, italic: false, color: '#1C1A17', align: 'left', lineHeight: 1.2, ...extra,
} });
export const EDITORIAL_STORY: CuratedTemplateBlueprint = {
  id: 'editorial-story', version: 1, name: 'Cover Story', tier: 'pro', canvas, allowBleed: true,
  examples: {
    main: { sampleId: 'halden-journal', src: '/designed/examples/collection/halden-journal.svg', name: 'halden-journal.svg' },
    secondary: { sampleId: 'halden-week', src: '/designed/examples/collection/halden-week.svg', name: 'halden-week.svg' },
  },
  placements: { main: frame(536, 612, 440, 940, -4), secondary: frame(72, 800, 350, 404, -2.5) },
  mediaPresentation: {
    main: { frame: 'phone-light', fit: 'contain', align: 'center', title: 'Journal', shadow: { x: 0, y: 40, blur: 80, color: '#14080659', referenceWidth: 440 } },
    secondary: { frame: 'plain', fit: 'contain', align: 'center', title: 'This week', radius: 14, shadow: { x: 0, y: 24, blur: 50, color: '#28180C38', referenceWidth: 350 } },
  },
  text: [
    text('brand', 'halden', 90, 40, 430, 54, 44, { font: 'gelasio', italic: true }),
    text('eyebrow', 'No. 07 — Autumn edition', 570, 62, 454, 24, 15, { align: 'right', weight: 700, letterSpacing: 2.4, textTransform: 'uppercase' }),
    text('headline', 'Write slower.\nThink further.', 52, 138, 972, 266.56, 136, { font: 'gelasio', lineHeight: .98, letterSpacing: -3.4, runs: [{ text: 'Write slower.\n' }, { text: 'Think further.', italic: true }] }),
    text('description', 'A private journal for long thoughts.\nNo streaks, no feeds, no noise.', 56, 456, 470, 65, 24, { lineHeight: 1.35 }),
    text('badge', '01', 56, 598, 280, 20, 13, { color: '#6F1D1B' }),
    text('credit', 'Capture', 56, 629, 300, 40, 30, { font: 'gelasio', italic: true }),
    text('disclosure', 'Illustrative app demo', 192, 1290, 210, 24, 15, { color: '#5D564D' }),
    text('website', 'halden.example', 56, 1290, 132, 24, 15, { color: '#5D564D' }),
    text('annotation', 'One line is enough to begin.', 56, 671, 330, 26, 18, { lineHeight: 1.35 }),
  ],
  decorations: [
    { id: 'halden-rule', name: 'Masthead rule', kind: 'shape', shape: 'rect', frame: frame(56, 116, 968, 1.5), fill: '#1C1A17' },
    { id: 'halden-burgundy', name: 'Burgundy panel', kind: 'shape', shape: 'rect', frame: frame(404, 566, 700, 820), fill: '#6F1D1B' },
  ],
};
export const EDITORIAL_STORY_BRAND_MARK = { id: 'brand-mark', name: 'Brand mark', kind: 'shape' as const, shape: 'mark' as const, markVariant: 'orbit' as const, frame: frame(56, 55, 22, 22), fill: '#1C1A17', stroke: '#EEE7D9' };
