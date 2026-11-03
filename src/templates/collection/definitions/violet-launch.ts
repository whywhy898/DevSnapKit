import type { CuratedTemplateBlueprint, CuratedTextDefinition } from '../types';
import type { CanvasTextLayer } from '../../../text/types';
import { frameFromRect } from '../geometry';

const canvas = { width: 1920, height: 1080 };
const frame = (x: number, y: number, width: number, height: number, rotation = 0) => frameFromRect(canvas, { x, y, width, height }, rotation);
const text = (role: CuratedTextDefinition['role'], content: string, x: number, y: number, width: number, _height: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CuratedTextDefinition => ({ role, layer: {
  content, centerX: (x + width / 2) / canvas.width, centerY: (y + content.split('\n').length * fontSize * (extra.lineHeight ?? 1.1) / 2) / canvas.height, widthRatio: width / canvas.width,
  font: 'manrope', fontSize, weight: 600, italic: false, color: '#FFFFFF', align: 'left', lineHeight: 1.1, ...extra,
} });

export const VIOLET_LAUNCH: CuratedTemplateBlueprint = {
  id: 'violet-launch', version: 1, name: 'Violet Launch', tier: 'free', canvas,
  examples: {
    main: { sampleId: 'trio-studio-library', src: '/designed/examples/collection/trio-studio-library.svg', name: 'trio-studio-library.svg' },
    secondary: { sampleId: 'trio-studio-detail', src: '/designed/examples/collection/trio-studio-detail.svg', name: 'trio-studio-detail.svg' },
  },
  placements: { main: frame(875, 100, 440, 880, -9), secondary: frame(1335, 100, 440, 880, 9) },
  singlePlacement: frame(1130, 60, 480, 960, 6),
  mediaPresentation: {
    main: { frame: 'phone-light', fit: 'contain', align: 'center', title: 'Studio library', shadow: { x: 0, y: 22, blur: 32, color: '#00000066', referenceWidth: 440 } },
    secondary: { frame: 'phone-dark', fit: 'contain', align: 'center', title: 'Launch visual', shadow: { x: 0, y: 22, blur: 32, color: '#00000066', referenceWidth: 440 } },
  },
  text: [
    text('badge', 'NEW RELEASE', 70, 204, 365, 50, 38, { weight: 800, align: 'center' }),
    text('headline', 'Make your\nnext launch\nunmissable.', 64, 316, 810, 405, 122, { weight: 800, lineHeight: 1.04, letterSpacing: -6 }),
    text('description', 'Two screens. One beautiful story.', 70, 747, 785, 58, 41, { color: '#C79AF3', letterSpacing: -1.2 }),
    text('website', 'YOUR PRODUCT / VERSION 2.0', 70, 979, 740, 38, 27, { color: '#DCC6EE', letterSpacing: 1.6 }),
  ],
  decorations: [
    { id: 'violet-ground', name: 'Purple lower ellipse', kind: 'shape', shape: 'ellipse', frame: frame(620, 730, 2200, 850, -12), fill: 'linear-gradient(125deg, #BD37F2 0%, #7521D3 55%, #39157A 100%)' },
    { id: 'violet-orbit', name: 'Pink upper arc', kind: 'shape', shape: 'ellipse', frame: frame(-650, -550, 1400, 685, -12), fill: 'transparent', stroke: '#F025CF', strokeWidth: 5 },
    { id: 'violet-badge', name: 'Release badge', kind: 'shape', shape: 'rect', frame: frame(70, 191, 365, 77), radius: 40, fill: '#F52298' },
  ],
};
