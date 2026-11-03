import type { CuratedTemplateBlueprint, CuratedTextDefinition } from '../types';
import type { CanvasTextLayer } from '../../../text/types';
import { frameFromRect } from '../geometry';

const canvas = { width: 1080, height: 1350 };
const frame = (x: number, y: number, width: number, height: number, rotation = 0) => frameFromRect(canvas, { x, y, width, height }, rotation);
const text = (role: CuratedTextDefinition['role'], content: string, x: number, y: number, width: number, _height: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CuratedTextDefinition => ({ role, layer: {
  content, centerX: (x + width / 2) / canvas.width, centerY: (y + content.split('\n').length * fontSize * (extra.lineHeight ?? 1.02) / 2) / canvas.height, widthRatio: width / canvas.width,
  font: 'gelasio', fontSize, weight: 400, italic: false, color: '#17120F', align: 'left', lineHeight: 1.02, ...extra,
} });

export const PEACH_EDITORIAL: CuratedTemplateBlueprint = {
  id: 'peach-editorial', version: 1, name: 'Peach Editorial', tier: 'pro', canvas,
  examples: {
    main: { sampleId: 'trio-journal-home', src: '/designed/examples/collection/trio-journal-home.svg', name: 'trio-journal-home.svg' },
    secondary: { sampleId: 'trio-journal-article', src: '/designed/examples/collection/trio-journal-article.svg', name: 'trio-journal-article.svg' },
  },
  placements: { main: frame(440, 500, 590, 710, 6), secondary: frame(105, 765, 365, 460, -6) },
  singlePlacement: frame(365, 505, 630, 758, 5),
  mediaPresentation: {
    main: { frame: 'plain', fit: 'contain', align: 'center', title: 'Journal home', radius: 22, shadow: { x: 0, y: 12, blur: 22, color: '#5024143D', referenceWidth: 590 } },
    secondary: { frame: 'plain', fit: 'contain', align: 'center', title: 'Open spaces', radius: 18, shadow: { x: 0, y: 12, blur: 20, color: '#5024143D', referenceWidth: 365 } },
  },
  text: [
    text('badge', 'A DIFFERENT POINT OF VIEW', 46, 38, 990, 30, 20, { weight: 700, letterSpacing: 5 }),
    text('headline', 'Good ideas.\nBeautifully\npresented.', 40, 91, 1000, 354, 117, { weight: 700, lineHeight: 1, letterSpacing: -4.5 }),
    text('description', 'Give your next story\na frame worth keeping.', 46, 1250, 600, 74, 32, { lineHeight: 1.05, letterSpacing: -.8 }),
    text('website', 'YOUR STORY / ISSUE 01', 700, 1299, 335, 26, 16, { weight: 700, letterSpacing: 2.8, align: 'right' }),
  ],
  decorations: [
    { id: 'peach-plane', name: 'Coral angled plane', kind: 'shape', shape: 'rect', frame: frame(690, -180, 880, 2050, 31), fill: 'linear-gradient(110deg, #FB9982, #F7AB91)' },
    { id: 'peach-orbit', name: 'Fine coral arc', kind: 'shape', shape: 'ellipse', frame: frame(-250, 545, 480, 550, 24), fill: 'transparent', stroke: '#EE886D', strokeWidth: 2 },
  ],
};
