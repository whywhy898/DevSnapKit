import { useEffect, useRef, useState } from 'react';
import type { CompositionDocument, MediaSlot } from '../composition/types';
import { compositionFrame, moveCompositionObject } from '../composition/document';

export function GeometryInput({ label, value, disabled = false, onCommit }: { label: string; value: number; disabled?: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const editing = useRef(false);
  const cancelled = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(String(value)); }, [value]);
  return <input aria-label={label} type="number" disabled={disabled} value={draft} onFocus={() => { editing.current = true; cancelled.current = false; }} onChange={event => setDraft(event.target.value)} onBlur={() => {
    editing.current = false; if (!cancelled.current && draft.trim() && Number.isFinite(Number(draft))) onCommit(Number(draft)); setDraft(String(value));
  }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { cancelled.current = true; event.currentTarget.blur(); } }} />;
}

export function ImageControls({ document: doc, selected, size, onChange, onStart, onFinish, onRestore, onResetTemplate, onIndependent, children }: {
  document: CompositionDocument; selected: MediaSlot; size: { width: number; height: number }; onChange: (doc: CompositionDocument) => void;
  onStart: () => void; onFinish: () => void; onRestore: () => void; onResetTemplate: () => void; onIndependent: () => void; children?: React.ReactNode;
}) {
  const frame = compositionFrame(doc, selected), label = selected === 'main' ? 'Image 1' : 'Image 2';
  const presentation = doc.mediaPresentation?.[selected];
  const independent = doc.mediaLayout === 'independent';
  const patch = (values: Partial<typeof frame>) => onChange(moveCompositionObject(doc, selected, values, size));
  const end = (event: React.FocusEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) onFinish(); };
  return <div className="image-controls">
    {independent && <fieldset onFocusCapture={onStart} onBlurCapture={end} onPointerDownCapture={event => { if ((event.target as HTMLElement).matches('input[type=range]')) onStart(); }} onPointerUpCapture={onFinish} onPointerCancelCapture={onFinish}>
      <label className="inspector-control-label">Size <span>{Math.round(frame.widthRatio * 100)}%</span></label>
      <input aria-label={`${label} scale`} type="range" min="5" max="150" value={Math.round(frame.widthRatio * 100)} onChange={event => { const widthRatio = Number(event.target.value) / 100; patch({ widthRatio, heightRatio: frame.heightRatio * widthRatio / frame.widthRatio }); }} />
      <p className="inspector-hint">Drag on the canvas to position. Drag a corner to resize.</p>
      <button type="button" onClick={() => patch({ centerX: .5, centerY: .5 })}>Reset position</button>
    </fieldset>}
    {!independent && <p className="inspector-hint">Image group uses the selected layout. Frame and camera settings apply to the whole group.</p>}
    {independent && presentation && <fieldset onFocusCapture={onStart} onBlurCapture={end} className="inspector-two-column">
      <label>Fit<select aria-label={`${label} fit`} value={presentation.fit} onChange={event => onChange({ ...doc, mediaPresentation: { ...doc.mediaPresentation, [selected]: { ...presentation, fit: event.target.value as 'contain' | 'cover' } } })}><option>contain</option><option>cover</option></select></label>
      <label>Focus<select aria-label={`${label} focus`} value={presentation.align} onChange={event => onChange({ ...doc, mediaPresentation: { ...doc.mediaPresentation, [selected]: { ...presentation, align: event.target.value as CompositionDocument['detailAlign'] } } })}>{['center','top','bottom','left','right'].map(value => <option key={value}>{value}</option>)}</select></label>
    </fieldset>}
    {selected === 'secondary' && independent && !presentation && <fieldset onFocusCapture={onStart} onBlurCapture={end} className="inspector-two-column">
      <label>Fit<select aria-label="Detail fit" value={doc.detailFit} onChange={event => onChange({ ...doc, detailFit: event.target.value as 'contain' | 'cover' })}><option>contain</option><option>cover</option></select></label>
      <label>Focus<select aria-label="Detail focus" value={doc.detailAlign} onChange={event => onChange({ ...doc, detailAlign: event.target.value as CompositionDocument['detailAlign'] })}>{['center','top','bottom','left','right'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Corner radius<GeometryInput label="Detail radius" value={doc.detailRadius} onCommit={value => { if (value >= 0 && value <= 100) onChange({ ...doc, detailRadius: value }); }} /></label>
      <button type="button" onClick={() => onChange({ ...doc, detailBorder: doc.detailBorder === 'none' ? '1px solid #d9d1ad' : 'none' })}>{doc.detailBorder === 'none' ? 'Add border' : 'Remove border'}</button>
      <button type="button" onClick={() => onChange({ ...doc, detailShadow: doc.detailShadow === 'none' ? '0 12px 28px #00000026' : 'none' })}>{doc.detailShadow === 'none' ? 'Add shadow' : 'Remove shadow'}</button>
    </fieldset>}
    <details data-image-advanced><summary>Advanced</summary><div className="inspector-advanced-content">
      {independent && <fieldset className="inspector-two-column" onFocusCapture={onStart} onBlurCapture={end}>{(['centerX','centerY','widthRatio','heightRatio'] as const).map(key => <label key={`${selected}-${key}`}>{({ centerX: 'Center X', centerY: 'Center Y', widthRatio: 'Width', heightRatio: 'Height' })[key]}<GeometryInput label={`Object ${key}`} value={Math.round(frame[key] * (key === 'centerY' || key === 'heightRatio' ? size.height : size.width))} onCommit={value => { if (key.startsWith('center') || value > 0) patch({ [key]: value / (key === 'centerY' || key === 'heightRatio' ? size.height : size.width) }); }} /></label>)}</fieldset>}
      <label><input aria-label="Allow image bleed" type="checkbox" checked={doc.allowBleed} onChange={event => onChange({ ...doc, allowBleed: event.target.checked })} /> Allow image bleed</label>
      <button type="button" onClick={() => independent ? onChange({ ...doc, mediaLayout: 'legacy' }) : onIndependent()}>{independent ? 'Use layout presets' : 'Independent two-slot layout'}</button>
      <button type="button" onClick={() => { if (window.confirm('Restore the template layout? You can Undo this change.')) onRestore(); }}>Restore layout</button>
      {doc.templateId && <button type="button" onClick={onResetTemplate}>Reset template</button>}
      {children}
    </div></details>
  </div>;
}
