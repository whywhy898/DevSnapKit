import { createIndependentComposition } from '../composition/document';
import { CompositionRenderer } from '../composition/CompositionRenderer';
import { getSceneTemplate } from './collection/scenes';

/** Gallery and preview use the actual scene documents and native artwork renderers. */
export function SceneArtwork({ id }: { id: string }) {
  const scene = getSceneTemplate(id);
  if (!scene) return null;
  const { blueprint, background } = scene;
  const { width, height } = blueprint.canvas;
  const textDocument = { version: 1 as const, layers: blueprint.text.map(({ role, layer }) => ({ ...layer, id: role })) };
  const document = { ...createIndependentComposition(), placements: blueprint.placements, mediaPresentation: blueprint.mediaPresentation,
    order: ['main', ...textDocument.layers.map(layer => layer.id)] };
  return <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label={`${blueprint.name} scene preview`} style={{ display: 'block', maxHeight: '72dvh' }}>
    <foreignObject width={width} height={height}>
      <div style={{ position: 'relative', width, height, overflow: 'hidden', background }}>
        <CompositionRenderer document={document} size={blueprint.canvas} textDocument={textDocument}
          imageSrc={blueprint.examples.main.src} imageName={blueprint.examples.main.name} secondarySrc={null} secondaryName=""
          windowTheme="browser" windowTitle="Your product" shadowLevel="soft" shadowOpacity={35} cornerStyle="default" roundedCorners={12} hideMockup={false} layoutPreset="flat" preview={false} />
      </div>
    </foreignObject>
  </svg>;
}
