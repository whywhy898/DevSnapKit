import type { ReactNode } from 'react';
import type { CompositionDocument } from '../composition/types';
import type { CanvasTextDocument } from '../text/types';
import type { TemplateContext } from '../templates/types';
import { ImageControls } from './ImageControls';
import { resolveImageSlots } from './model';

export function SelectionControls({ document: doc, texts, selected, size, tab, layoutMode, imageSrc, secondarySrc, imageName, secondaryName, angleControls, starterControls, onSelect, onChange, onStart, onFinish, onIndependent, onReplace, onRestore, onRemoveDetail, onResetTemplate, onDuplicateText }: {
  document: CompositionDocument | null; texts: CanvasTextDocument; selected: string | null; size: { width: number; height: number }; context: TemplateContext | null;
  tab: string; layoutMode: 'single' | 'duo'; imageSrc: string; secondarySrc: string | null; imageName: string; secondaryName: string; angleControls: ReactNode; starterControls: ReactNode;
  onSelect: (id: string) => void; onChange: (doc: CompositionDocument) => void; onStart: () => void; onFinish: () => void;
  onIndependent: () => void; onReplace: (slot: 'main' | 'secondary') => void; onRestore: () => void; onRemoveDetail: () => void;
  onResetTemplate: () => void; onDuplicateText: (id: string) => void; customLogo?: boolean;
}) {
  const slots = resolveImageSlots(doc, layoutMode, imageSrc, secondarySrc), image = selected === 'secondary' ? 'secondary' : 'main';
  return <div className="inspector-selection">
    {tab === 'style' && <><section className="inspector-images"><h3>Images <span>{slots.filter(slot => slot.loaded).length} / {slots.length} loaded</span></h3>
      {slots.map(slot => <div key={slot.id} className="inspector-image-row" data-selected={image === slot.id}>
        <button type="button" className="inspector-image-pick" aria-label={`Select ${slot.label}`} onClick={() => onSelect(slot.id)}><span className="inspector-image-thumb">{(slot.id === 'main' ? imageSrc : secondarySrc) && <img src={(slot.id === 'main' ? imageSrc : secondarySrc)!} alt="" />}</span><span><strong>{slot.label}</strong><small>{(slot.id === 'main' ? imageName : secondaryName) || 'No image loaded'}</small></span></button>
        <button type="button" aria-label={`Replace ${slot.label}`} onClick={() => onReplace(slot.id)}>Replace</button>
      </div>)}
      {doc && <button type="button" className="inspector-quiet" onClick={() => onChange({ ...doc, detailVisible: !doc.detailVisible, ...(doc.detailVisible ? {} : { hiddenIds: doc.hiddenIds.filter(id => id !== 'secondary') }) })}>{doc.detailVisible ? 'Hide Image 2' : 'Enable Image 2'}</button>}
    </section>
    {image === 'main' && (!selected || selected === 'main') && doc?.mediaLayout !== 'independent' && angleControls}
    {doc ? <ImageControls key={image} document={doc} selected={image} size={size} onChange={onChange} onStart={onStart} onFinish={onFinish} onRestore={onRestore} onResetTemplate={onResetTemplate} onIndependent={onIndependent}>{image === 'main' && starterControls}{(image === 'secondary' || (doc.mediaLayout === 'legacy' && doc.detailVisible)) && <button type="button" onClick={onRemoveDetail}>Remove detail</button>}</ImageControls> : <details className="inspector-advanced"><summary>Advanced</summary><button type="button" onClick={onIndependent}>Independent two-slot layout</button>{starterControls}</details>}
    </>}
    {tab === 'text' && selected && texts.layers.some(layer => layer.id === selected) && <button type="button" className="inspector-add" onClick={() => onDuplicateText(selected)}>Duplicate text</button>}
  </div>;
}
