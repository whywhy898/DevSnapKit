import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { FittedScene, DeviceComposition } from '../CanvasLayout';
import type { MockupArtworkProps } from '../MockupArtwork';
import { CanvasTextLayerRenderer } from '../text/CanvasTextLayerRenderer';
import type { CompositionDocument, ObjectFrame } from './types';
import { ButtonRenderer } from './ButtonRenderer';
import { DecorationRenderer } from './DecorationRenderer';
import { MediaHoverOverlay } from '../MockupUnit';
import { canUse } from '../../shared/productCapabilities';
import { compositionFrame } from './document';
import { MediaShell } from './MediaShell';
const noop = () => {};
export const frameStyle = (frame: ObjectFrame): CSSProperties => ({ position: 'absolute', left: `${frame.centerX * 100}%`, top: `${frame.centerY * 100}%`,
  width: `${frame.widthRatio * 100}%`, height: `${frame.heightRatio * 100}%`, transform: `translate(-50%, -50%) rotate(${frame.rotation}deg)`, transformOrigin: 'center' });
type Props = Pick<MockupArtworkProps, 'imageSrc' | 'imageName' | 'secondarySrc' | 'secondaryName' | 'windowTheme' | 'windowTitle' | 'shadowLevel' | 'shadowOpacity' | 'cornerStyle' | 'roundedCorners' | 'hideMockup' | 'layoutPreset' | 'textDocument' | 'preview' | 'editingTextId'> & {
  logoDataUrl?: string | null; logoOpacity?: number; isProUnlocked?: boolean;
  document: CompositionDocument; size: { width: number; height: number };
  onReplace?: () => void; onReplaceSecondary?: () => void;
  legacy?: Pick<MockupArtworkProps, 'effectivePaddingX' | 'effectivePaddingY' | 'layoutMode' | 'duoLayout' | 'mockupZoom' | 'mockupOffsetX' | 'mockupOffsetY' | 'isPhoneTheme' | 'zoomStyle' | 'handleNaturalSceneSize'>;
  onObjectPointerDown?: (id: string, event: PointerEvent<HTMLDivElement>) => void;
};

/** All composition artwork is independent of selection UI and uses canonical slot sources. */
export function CompositionRenderer(props: Props) {
  const { document: doc, size, preview, textDocument, editingTextId } = props;
  const key = useMemo(() => ({}), [props.imageSrc, props.windowTheme, props.windowTitle, props.cornerStyle, props.roundedCorners, props.layoutPreset, props.hideMockup, props.legacy?.layoutMode, props.legacy?.duoLayout, props.secondarySrc]);
  const main = compositionFrame(doc, 'main');
  const order = [...doc.order, ...textDocument.layers.map(layer => layer.id).filter(id => !doc.order.includes(id))];
  return <>
    {doc.decorations.filter(node => !node.hidden && !doc.hiddenIds.includes(node.id)).map(node => <div key={node.id} data-composition-decoration={node.id} style={{ ...frameStyle(node.frame), opacity: node.opacity ?? 1, pointerEvents: 'none' }}><DecorationRenderer object={node}/></div>)}
    {order.filter(id => !doc.hiddenIds.includes(id) && (id !== 'secondary' || (doc.mediaLayout === 'independent' && doc.detailVisible))).map((id, index) => {
      const graphic = doc.objects.find(node => node.id === id);
      const text = textDocument.layers.find(node => node.id === id);
      if ((id === 'main' || id === 'secondary') && doc.mediaLayout === 'independent' && doc.mediaPresentation?.[id]) {
        const src = id === 'main' ? props.imageSrc : props.secondarySrc;
        return src ? <PresentedMedia key={id} props={props} slot={id} src={src} zIndex={index + 1} /> : null;
      }
      if (text) return <div key={id} data-composition-text={id} style={{ position: 'absolute', inset: 0, zIndex: index + 1, pointerEvents: 'none' }}><CanvasTextLayerRenderer document={{ version: 1, layers: [text] }} size={size} editingId={preview ? editingTextId : null} /></div>;
      if (graphic) return graphic.hidden ? null : <div key={id} data-composition-object={id} style={{ ...frameStyle(graphic.frame), ...(graphic.kind === 'button' && graphic.autoWidth ? { width: 'max-content' } : {}), zIndex: index + 1, opacity: graphic.opacity ?? 1 }} onPointerDown={event => props.onObjectPointerDown?.(id, event)}>
        {graphic.kind === 'button' ? <ButtonRenderer object={graphic} contentScale={graphic.referenceSize && graphic.referenceSize.width > 0 && graphic.referenceSize.height > 0 ? Math.min(1, graphic.frame.widthRatio * size.width / graphic.referenceSize.width, graphic.frame.heightRatio * size.height / graphic.referenceSize.height) : undefined} /> : graphic.shape === 'mark' && canUse('brand_logo', Boolean(props.isProUnlocked)) && props.logoDataUrl
          ? <img src={props.logoDataUrl} alt="Brand Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: props.logoOpacity ?? 1, pointerEvents: 'none' }} /> : <DecorationRenderer object={graphic} />}
      </div>;
      if (id === 'main') return <div key={id} data-composition-object="main" style={{ ...(doc.mediaLayout === 'legacy' ? { position: 'absolute' as const, inset: 0 } : frameStyle(main)), zIndex: index + 1 }} onPointerDown={event => props.onObjectPointerDown?.(id, event)}>
        <FittedScene width={doc.mediaLayout === 'legacy' ? size.width : main.widthRatio * size.width} height={doc.mediaLayout === 'legacy' ? size.height : main.heightRatio * size.height}
          paddingX={doc.mediaLayout === 'legacy' ? props.legacy?.effectivePaddingX ?? 0 : 0} paddingY={doc.mediaLayout === 'legacy' ? props.legacy?.effectivePaddingY ?? 0 : 0}
          basisWidth={doc.mediaLayout === 'legacy' && props.legacy?.isPhoneTheme && props.legacy.layoutMode === 'single' ? 375 : 1024}
          zoom={doc.mediaLayout === 'legacy' ? props.legacy?.mockupZoom ?? 100 : 100} offsetX={doc.mediaLayout === 'legacy' ? props.legacy?.mockupOffsetX ?? 0 : 0} offsetY={doc.mediaLayout === 'legacy' ? props.legacy?.mockupOffsetY ?? 0 : 0}
          projection={props.layoutPreset} onNaturalSize={doc.mediaLayout === 'legacy' ? props.legacy?.handleNaturalSceneSize ?? noop : noop} measurementKey={key}>
          <DeviceComposition mode={doc.mediaLayout === 'legacy' ? props.legacy?.layoutMode ?? 'single' : 'single'} duoLayout={props.legacy?.duoLayout ?? 'side'} secondarySrc={doc.mediaLayout === 'legacy' ? props.secondarySrc : null} secondaryName={props.secondaryName} onReplaceSecondary={props.onReplaceSecondary ?? noop} emptySlot={null}
            theme={props.windowTheme} imageSrc={props.imageSrc} imageName={props.imageName} interactive={Boolean(preview && !editingTextId)} deferHoverOverlay
            onReplace={props.onReplace} mediaFit={doc.mediaLayout === 'independent' ? 'contain' : undefined} zoomStyle={doc.mediaLayout === 'legacy' ? props.legacy?.zoomStyle : undefined} windowTitle={props.windowTitle} shadowLevel={props.shadowLevel} shadowOpacity={props.shadowOpacity}
            cornerStyle={props.cornerStyle} roundedCorners={props.roundedCorners} hideFrame={props.hideMockup} />
        </FittedScene>
      </div>;
      if (id === 'secondary' && props.secondarySrc) return <DetailMedia key={id} props={props} zIndex={index + 1} />;
      return null;
    })}
  </>;
}

function PresentedMedia({ props, slot, src, zIndex }: { props: Props; slot: 'main' | 'secondary'; src: string; zIndex: number }) {
  const [hovered, setHovered] = useState(false), pointer = useRef<{ x: number; y: number } | null>(null);
  const interactive = Boolean(props.preview && !props.editingTextId);
  const replace = slot === 'main' ? props.onReplace : props.onReplaceSecondary;
  return <div className="group/media" data-composition-object={slot} data-media-surface style={{ ...frameStyle(compositionFrame(props.document, slot)), zIndex, cursor: interactive ? 'pointer' : undefined }}
    onPointerEnter={() => setHovered(true)} onPointerLeave={event => { setHovered(false); if (event.buttons) pointer.current = null; }} onPointerCancel={() => { pointer.current = null; }}
    onPointerDown={event => { pointer.current = interactive && event.button === 0 ? { x: event.clientX, y: event.clientY } : null; props.onObjectPointerDown?.(slot, event); }}
    onClick={event => { const start = pointer.current; pointer.current = null; if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4) replace?.(); }}>
    <MediaShell src={src} name={slot === 'main' ? props.imageName : props.secondaryName} presentation={props.document.mediaPresentation![slot]!}
      logicalWidth={compositionFrame(props.document, slot).widthRatio * props.size.width} />
    {interactive && hovered && <MediaHoverOverlay />}
  </div>;
}

function DetailMedia({ props, zIndex }: { props: Props; zIndex: number }) {
  const [hovered, setHovered] = useState(false), pointer = useRef<{ x: number; y: number } | null>(null);
  const interactive = props.preview && !props.editingTextId, doc = props.document;
  return <div className="group/media" data-composition-object="secondary" data-media-surface style={{ ...frameStyle(doc.placements.secondary), zIndex,
    borderRadius: doc.detailRadius, border: doc.detailBorder, boxShadow: doc.detailShadow, overflow: 'hidden', cursor: interactive ? 'pointer' : undefined }}
    onPointerEnter={() => setHovered(true)} onPointerLeave={event => { setHovered(false); if (event.buttons) pointer.current = null; }} onPointerCancel={() => { pointer.current = null; }}
    onPointerDown={event => { pointer.current = interactive && event.button === 0 ? { x: event.clientX, y: event.clientY } : null; props.onObjectPointerDown?.('secondary', event); }}
    onClick={event => { const start = pointer.current; pointer.current = null; if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4) props.onReplaceSecondary?.(); }}>
    <img src={props.secondarySrc!} alt={props.secondaryName || 'Detail screenshot'} style={{ display: 'block', width: '100%', height: '100%', objectFit: doc.detailFit, objectPosition: doc.detailAlign, pointerEvents: 'none' }} />
    {interactive && hovered && <MediaHoverOverlay />}
  </div>;
}
