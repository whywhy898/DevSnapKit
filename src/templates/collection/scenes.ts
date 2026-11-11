import type { CuratedTemplateBlueprint, CuratedTemplateId } from './types';
import type { TextCanvasSize } from '../../text/types';
import { addText, emptyTextDocument, updateText } from '../../text/document';
import { frameFromRect } from './geometry';

type SceneId = 'producthunt' | 'og' | 'appstore';
type Rect = { x: number; y: number; width: number; height: number };

function scene(sceneId: SceneId, name: string, canvas: TextCanvasSize, screenshot: Rect, background: string, headline: string) {
  const phone = sceneId === 'appstore';
  // Work at a readable reference size, then project the same phase-1 placement
  // into native pixels. Supply the title as occupied space for the subtitle.
  const scale = phone ? canvas.width / 600 : 1;
  const size = { width: canvas.width / scale, height: canvas.height / scale };
  const media = [{ left: screenshot.x / scale, top: screenshot.y / scale, width: screenshot.width / scale, height: screenshot.height / scale }];
  let text = addText(emptyTextDocument(), size, '#111827', 'headline', undefined, media);
  text = updateText(text, 'headline', { content: headline });
  text = addText(text, size, '#111827', 'description', undefined, media);
  text = updateText(text, 'description', { content: 'One place to make it happen.', fontSize: 24, weight: 400 });
  const example = phone
    ? { sampleId: 'shelf-library', src: '/designed/examples/collection/shelf-library.svg', name: 'shelf-library.svg' }
    : { sampleId: 'folio-workspace', src: '/designed/examples/collection/folio-workspace.svg', name: 'folio-workspace.svg' };
  const frame = frameFromRect(canvas, screenshot);
  const blueprint: CuratedTemplateBlueprint = {
    id: `scene-${sceneId}`, version: 1, name, tier: 'free', canvas, singleScreenshot: true,
    examples: { main: example, secondary: example },
    placements: { main: frame, secondary: { ...frame } },
    mediaPresentation: {
      main: { frame: phone ? 'phone-light' : 'browser-light', fit: 'contain', align: 'center' },
      secondary: { frame: 'plain', fit: 'contain', align: 'center' },
    },
    text: text.layers.map(({ id, ...layer }) => ({ role: id === 'headline' ? 'headline' : 'description', layer: { ...layer, fontSize: layer.fontSize * scale } })),
    decorations: [],
  };
  return { scene: sceneId, blueprint, background };
}

/** Scenes are ordinary free curated blueprints, rendered and edited by the same documents. */
export const SCENE_TEMPLATES = [
  scene('producthunt', 'Product Hunt gallery image', { width: 1270, height: 760 }, { x: 650, y: 70, width: 550, height: 620 }, '#FFF1EB', 'Meet your product.'),
  scene('og', 'OG / Twitter share image', { width: 1200, height: 630 }, { x: 650, y: 70, width: 490, height: 490 }, '#EEF2FF', 'Made to be shared.'),
  // The App Store guide demonstrates this exact size in both caption and instructions.
  scene('appstore', 'App Store iPhone screenshot', { width: 1290, height: 2796 }, { x: 160, y: 820, width: 970, height: 1810 }, '#EAF2FA', 'Your day, simplified.'),
];

export const getSceneTemplate = (id: string) => SCENE_TEMPLATES.find(item => item.blueprint.id === id);

/** Read without consuming or rewriting marketing/attribution parameters. */
export function sceneTemplateId(params: { get(name: string): string | null }): CuratedTemplateId | undefined {
  return SCENE_TEMPLATES.find(item => item.scene === params.get('scene'))?.blueprint.id;
}
