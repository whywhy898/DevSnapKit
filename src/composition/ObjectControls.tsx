import type { CompositionDocument } from './types';
import { compositionFrame, moveCompositionObject, duplicateCompositionObject } from './document';
import { GeometryInput } from '../inspector/ImageControls';
import { Copy, Trash2 } from 'lucide-react';

export function ObjectControls({ document: doc, selected, size, onChange, onStart, onFinish }: {
  document: CompositionDocument | null; selected: string | null; size: { width: number; height: number };
  onChange: (doc: CompositionDocument) => void; onStart: () => void; onFinish: () => void;
}) {
  const node = [...(doc?.objects || []), ...(doc?.decorations || [])].find(item => item.id === selected);
  if (!doc || !node || (node.kind === 'shape' && node.shape === 'mark')) return null;
  const frame = compositionFrame(doc, node.id);
  const patch = (values: Record<string, unknown>) => onChange({ ...doc, objects: doc.objects.map(item => item.id === node.id ? { ...item, ...values } : item), decorations: doc.decorations.map(item => item.id === node.id ? { ...item, ...values } : item) });
  return <section data-object-properties className="image-controls"><div className="element-object-title"><h3>{node.name}</h3>{doc.objects.some(item => item.id === node.id) && <div className="element-actions"><button type="button" className="element-action element-duplicate" aria-label="Duplicate object" title="Duplicate object" onClick={() => { onFinish(); onChange(duplicateCompositionObject(doc, node.id, crypto.randomUUID())); }}><Copy size={16} aria-hidden="true" /><span className="sr-only">Duplicate</span></button><button type="button" className="element-action element-delete" aria-label="Delete object" title="Delete object" onClick={() => { onFinish(); onChange({ ...doc, objects: doc.objects.filter(item => item.id !== node.id), order: doc.order.filter(id => id !== node.id) }); }}><Trash2 size={16} aria-hidden="true" /><span className="sr-only">Delete object</span></button></div>}</div>
    <fieldset onFocusCapture={onStart} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) onFinish(); }}>
      {node.kind === 'button' ? <><label>Button label<input aria-label="Button label" value={node.text} onChange={event => patch({ text: event.target.value })} /></label>
        <div className="inspector-two-column">{([['Fill', 'fill', 'Button fill'], ['Text color', 'color', 'Button color']] as const).map(([label, key, aria]) => <label key={key}>{label}<span className="element-color"><span className="element-color-swatch" style={{ backgroundColor: node[key] }} /><span>{node[key].toUpperCase()}</span><input aria-label={aria} type="color" value={node[key]} onChange={event => patch({ [key]: event.target.value })} /></span></label>)}
        {([['fontSize', 'Font size'], ['padding', 'Padding'], ['radius', 'Corner radius']] as const).map(([key, label]) => <label key={key}>{label}<GeometryInput label={`Button ${key}`} value={node[key]} onCommit={value => { if (value >= (key === 'fontSize' ? 1 : 0)) patch({ [key]: value }); }} /></label>)}</div>
        <label className="element-check"><input aria-label="Button auto width" type="checkbox" checked={node.autoWidth} onChange={event => patch({ autoWidth: event.target.checked })} /> Fit width to content</label><label className="element-check"><input aria-label="Button arrow" type="checkbox" checked={node.arrow} onChange={event => patch({ arrow: event.target.checked })} /> Show arrow</label>
        <button type="button" onClick={() => patch({ border: node.border && node.border !== 'none' ? 'none' : '1px solid currentColor' })}>Toggle border</button>
      </> : <><label>Color<input aria-label="Decoration color" type="color" value={(node.fill === 'transparent' ? node.stroke : node.fill)?.slice(0, 7) || '#ffffff'} onChange={event => patch({ [node.fill === 'transparent' ? 'stroke' : 'fill']: event.target.value })} /></label><label>Opacity<input aria-label="Decoration opacity" type="range" min="0" max="1" step=".05" value={node.opacity ?? 1} onChange={event => patch({ opacity: Number(event.target.value) })} /></label></>}
      <div className="inspector-two-column">{([['centerX', 'Center X'], ['centerY', 'Center Y'], ['widthRatio', 'Width'], ['heightRatio', 'Height']] as const).map(([key, label]) => <label key={`${selected}-${key}`}>{label}<GeometryInput label={`Object ${key}`} disabled={node.kind === 'button' && node.autoWidth && key === 'widthRatio'} value={Math.round(frame[key] * (key === 'centerY' || key === 'heightRatio' ? size.height : size.width))} onCommit={value => { if (key.startsWith('center') || value > 0) onChange(moveCompositionObject(doc, node.id, { [key]: value / (key === 'centerY' || key === 'heightRatio' ? size.height : size.width) }, size)); }} /></label>)}</div>
    </fieldset>
  </section>;
}
