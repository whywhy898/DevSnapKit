import type { CuratedTemplateBlueprint, CuratedTextDefinition } from '../types';
import type { CanvasTextLayer } from '../../../text/types';
import { frameFromRect } from '../geometry';

const canvas = { width: 1600, height: 1200 };
const frame = (x: number, y: number, width: number, height: number, rotation = 0) => frameFromRect(canvas, { x, y, width, height }, rotation);
const text = (role: CuratedTextDefinition['role'], content: string, x: number, y: number, width: number, height: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CuratedTextDefinition => ({ role, layer: {
  content, centerX: (x + width / 2) / canvas.width, centerY: (y + height / 2) / canvas.height, widthRatio: width / canvas.width,
  font: 'manrope', fontSize, weight: 400, italic: false, color: '#233C30', align: 'left', lineHeight: 1.2, ...extra,
} });

/** Keep the published stable ID while presenting the approved Web & Mobile design. */
export const CODE_PREVIEW: CuratedTemplateBlueprint = {
  id: 'code-preview', version: 1, name: 'Web & Mobile', tier: 'pro', canvas, allowBleed: false,
  examples: {
    main: { sampleId: 'sidea-web', src: '/designed/examples/collection/sidea-web.png', name: 'sidea-web.png' },
    secondary: { sampleId: 'sidea-mobile', src: '/designed/examples/collection/sidea-mobile.png', name: 'sidea-mobile.png' },
  },
  placements: { main: frame(67, 543, 1110, 566, -2), secondary: frame(1167, 328, 348, 770, 4) },
  singlePlacement: frame(86, 543, 1428, 566, -2),
  mediaPresentation: {
    main: { frame: 'browser-light', fit: 'contain', align: 'center', title: 'side-a.example / discover', shadow: { x: 12, y: 14, blur: 0, color: '#BDC58D', referenceWidth: 1110 } },
    secondary: { frame: 'phone-light', fit: 'contain', align: 'center', title: 'SIDE A', shadow: { x: 13, y: 16, blur: 0, color: '#102A2255', referenceWidth: 348 } },
  },
  text: [
    text('brand', 'SIDE A', 64, 44, 300, 36, 30, { weight: 800, letterSpacing: -1.4 }),
    text('eyebrow', 'DIGITAL EXPERIENCES / 02', 480, 56, 650, 18, 14, { weight: 700, letterSpacing: 2 }),
    text('website', 'side-a.example', 1260, 56, 276, 18, 14, { color: '#E7EDAF', weight: 700, letterSpacing: 2, align: 'right' }),
    text('headline', 'Same rhythm.\nEvery screen.', 57, 159, 1080, 271.26, 137, { weight: 800, lineHeight: .99, letterSpacing: -8 }),
    text('description', 'One listening room.\nFrom your desk to wherever you go.', 68, 460, 1000, 60, 20, { lineHeight: 1.5 }),
    text('disclosure', 'Illustrative web & mobile experience', 67, 1153, 1100, 15, 12, { color: '#526A43' }),
    text('annotation', 'DESKTOP / MOBILE', 1260, 1152, 282, 15, 12, { color: '#DCE5BA', letterSpacing: 1, align: 'right' }),
  ],
  decorations: [
    { id: 'sidea-panel', name: 'Forest green side panel', kind: 'shape', shape: 'rect', frame: frame(1240, 0, 360, 1200), fill: '#244334' },
    { id: 'sidea-rule', name: 'Header rule', kind: 'shape', shape: 'rect', frame: frame(64, 104, 1472, 1), fill: '#789065' },
  ],
};
