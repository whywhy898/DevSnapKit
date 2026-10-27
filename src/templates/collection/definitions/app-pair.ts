import type { CuratedTemplateBlueprint, CuratedTextDefinition } from '../types';
import type { CanvasTextLayer } from '../../../text/types';
import { frameFromRect } from '../geometry';

const canvas = { width: 1080, height: 1920 };
const frame = (x: number, y: number, width: number, height: number) => frameFromRect(canvas, { x, y, width, height });
const text = (role: CuratedTextDefinition['role'], content: string, x: number, y: number, width: number, height: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CuratedTextDefinition => ({ role, layer: {
  content, centerX: (x + width / 2) / canvas.width, centerY: (y + height / 2) / canvas.height, widthRatio: width / canvas.width,
  font: 'manrope', fontSize, weight: 400, italic: false, color: '#203B59', align: 'left', lineHeight: 1.2, ...extra,
} });

export const APP_PAIR: CuratedTemplateBlueprint = {
  id: 'app-pair', version: 1, name: 'App Pair', tier: 'free', canvas,
  examples: {
    main: { sampleId: 'shelf-library', src: '/designed/examples/collection/shelf-library.svg', name: 'shelf-library.svg' },
    secondary: { sampleId: 'shelf-notes', src: '/designed/examples/collection/shelf-notes.svg', name: 'shelf-notes.svg' },
  },
  placements: { main: frame(64, 580, 464, 1050), secondary: frame(552, 580, 464, 1050) },
  mediaPresentation: {
    main: { frame: 'phone-light', fit: 'contain', align: 'center', title: 'Your library' },
    secondary: { frame: 'phone-light', fit: 'contain', align: 'center', title: 'Reading notes' },
  },
  text: [
    text('brand', 'shelf', 108, 66, 300, 48, 38, { weight: 800 }),
    text('headline', 'Good ideas,\nkept close.', 64, 190, 952, 260, 112, { weight: 800, lineHeight: 1.04 }),
    text('eyebrow', 'A HOME FOR WHAT YOU READ', 64, 480, 952, 36, 24, { color: '#557DA7' }),
    text('description', 'Save a thought. Find it again.', 64, 1690, 952, 58, 40),
    // Leave the default bottom-right QR area clear; custom QR geometry stays user controlled.
    text('website', 'shelf.example', 560, 1812, 292, 30, 20, { align: 'right', color: '#557DA7' }),
    text('disclosure', 'Illustrative app demo', 560, 1848, 292, 22, 14, { align: 'right', color: '#557DA7' }),
  ],
  decorations: [
    { id: 'app-pair-blue', name: 'Blue color strip', kind: 'shape', shape: 'rect', frame: frame(64, 1836, 92, 12), fill: '#A8C8E5' },
    { id: 'app-pair-apricot', name: 'Apricot color strip', kind: 'shape', shape: 'rect', frame: frame(168, 1836, 64, 12), fill: '#EDC5A3' },
    { id: 'app-pair-cream', name: 'Cream color strip', kind: 'shape', shape: 'rect', frame: frame(244, 1836, 44, 12), fill: '#F4E5C5' },
  ],
};

// Reuse the existing native mark; a book-spine variant is not supported by the renderer.
export const APP_PAIR_BRAND_MARK = { id: 'brand-mark', name: 'Brand mark', kind: 'shape' as const, shape: 'mark' as const, frame: frame(64, 72, 30, 36), fill: '#203B59', stroke: '#EAF2FA' };
