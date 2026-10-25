import type { CompositionDocument } from './types';
import type { CanvasTextDocument } from '../text/types';
import { useEffect, useState } from 'react';
import { compositionFrame, moveCompositionObject, toggleCompositionObject, reorderCompositionObject, duplicateCompositionObject } from './document';
export function ObjectControls({ document: doc, texts, selected, size, customLogo, onSelect, onChange, onStart, onFinish, onIndependent, onReplace, onRestore, onRemoveDetail, onAddButton, onResetTemplate, onDuplicateText }: {
  document: CompositionDocument | null; texts: CanvasTextDocument; selected: string | null; size: { width: number; height: number };
  onSelect: (id: string) => void; onChange: (doc: CompositionDocument) => void; onStart: () => void; onFinish: () => void;
  onIndependent: () => void; onReplace: (slot: 'main' | 'secondary') => void; onRestore: () => void; onRemoveDetail: () => void;
  onAddButton?: () => void;
  onResetTemplate?: () => void; onDuplicateText?: (id: string) => void;
  customLogo?: boolean;
}) {
  const label = (id: string) => id === 'main' ? doc?.mediaLayout === 'legacy' && doc.detailVisible ? 'Image group' : 'Main screenshot' : id === 'secondary' ? 'Detail screenshot' : texts.layers.find(layer => layer.id === id)?.content.slice(0, 24) || [...(doc?.objects || []), ...(doc?.decorations || [])].find(node => node.id === id)?.name || id;
  let frame; try { if (doc && selected && !(selected === 'main' && doc.mediaLayout === 'legacy')) frame = compositionFrame(doc, selected); } catch { /* Text properties live in Text inspector. */ }
  const button = 'rounded border border-white/15 px-2 py-1.5 text-[11px] hover:bg-white/10 disabled:opacity-30';
  return <details data-composition-controls className="rounded-lg border border-white/10 p-2 text-xs">
    <summary className="cursor-pointer font-semibold">Objects{selected ? ` · ${label(selected)}` : ''}</summary>
    {!doc ? <div className="flex gap-2 mt-2"><button type="button" className={button} onClick={onIndependent}>Use independent two-slot layout</button><button type="button" className={button} onClick={onAddButton}>Add button</button>{selected && texts.layers.some(layer => layer.id === selected) && <button type="button" className={button} onClick={() => onDuplicateText?.(selected)}>Duplicate text</button>}</div> : <div className="space-y-3 pt-2">
      <div className="max-h-44 overflow-y-auto space-y-1">{[...doc.order.filter(id => id === 'main' || id === 'secondary' || texts.layers.some(layer => layer.id === id) || doc.objects.some(node => node.id === id)), ...texts.layers.map(layer => layer.id).filter(id => !doc.order.includes(id)), ...doc.decorations.map(node => node.id)].map(id => <div key={id} className="flex gap-1 items-center">
        <button type="button" aria-label={`Select ${label(id)}`} onClick={() => onSelect(id)} className={`flex-1 text-left truncate rounded px-2 py-1.5 ${selected === id ? 'bg-indigo-500/25' : 'hover:bg-white/5'}`}>{label(id)}</button>
        <button type="button" className={button} aria-label={`Toggle ${label(id)}`} onClick={() => onChange(toggleCompositionObject(doc, id))}>{(id === 'secondary' ? !doc.detailVisible : doc.hiddenIds.includes(id)) ? 'Show' : 'Hide'}</button>
      </div>)}</div>
      <div className="flex gap-1 flex-wrap">
        <button type="button" className={button} onClick={() => onReplace('main')}>Replace main</button>
        <button type="button" className={button} onClick={() => onReplace('secondary')}>Replace detail</button>
        <button type="button" className={button} onClick={() => onChange({ ...doc, detailVisible: !doc.detailVisible })}>{doc.detailVisible ? 'Hide detail' : 'Enable detail'}</button>
        {doc.mediaLayout === 'legacy' && doc.detailVisible && <button type="button" className={button + ' text-red-300'} onClick={onRemoveDetail}>Remove detail</button>}
        <button type="button" className={button} onClick={onRestore}>Restore layout</button>
        {doc.templateId && <button type="button" className={button + ' text-red-300'} onClick={onResetTemplate}>Reset template</button>}
        <button type="button" className={button} onClick={onAddButton}>Add button</button>
        {doc.mediaLayout === 'legacy' ? <button type="button" className={button} onClick={onIndependent}>Independent two-slot layout</button> : <button type="button" className={button} onClick={() => onChange({ ...doc, mediaLayout: 'legacy' })}>Use layout presets</button>}
      </div>
      {selected && <div className="flex gap-1 flex-wrap">
        {texts.layers.some(layer => layer.id === selected) && <button type="button" className={button} onClick={() => onDuplicateText?.(selected)}>Duplicate text</button>}
        {(doc.order.includes(selected) || texts.layers.some(layer => layer.id === selected)) && (() => { const ordered = { ...doc, knownTextIds: [...new Set([...(doc.knownTextIds || []), ...texts.layers.map(layer => layer.id)])], order: [...doc.order, ...texts.layers.map(layer => layer.id).filter(id => !doc.order.includes(id))] };
          return <><button type="button" className={button} onClick={() => onChange(reorderCompositionObject(ordered, selected, -1))}>Move back</button><button type="button" className={button} onClick={() => onChange(reorderCompositionObject(ordered, selected, 1))}>Move forward</button></>; })()}
        {doc.objects.some(node => node.id === selected && !(node.kind === 'shape' && node.shape === 'mark')) && <><button type="button" className={button} onClick={() => onChange(duplicateCompositionObject(doc, selected, crypto.randomUUID()))}>Duplicate</button><button type="button" className={button + ' text-red-400 border-red-400/40'} onClick={() => onChange({ ...doc, objects: doc.objects.filter(node => node.id !== selected), order: doc.order.filter(id => id !== selected) })}>Delete object</button></>}
        {selected === 'secondary' && <button type="button" className={button + ' text-red-400'} onClick={onRemoveDetail}>Remove detail</button>}
      </div>}
      {frame && selected && <fieldset className="grid grid-cols-2 gap-2" onFocusCapture={onStart} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) onFinish(); }}>
        {(['centerX', 'centerY', 'widthRatio', 'heightRatio'] as const).map(key => <label key={key} className="space-y-1">{({ centerX: 'Center X', centerY: 'Center Y', widthRatio: 'Width', heightRatio: 'Height' })[key]}<GeometryInput key={`${selected}-${key}`} label={`Object ${key}`} disabled={key === 'widthRatio' && doc.objects.some(node => node.id === selected && node.kind === 'button' && node.autoWidth)} value={Math.round(frame![key] * (key.includes('Y') || key === 'heightRatio' ? size.height : size.width))} onCommit={value => {
          if (Number.isFinite(value) && (key.startsWith('center') || value > 0)) onChange(moveCompositionObject(doc, selected, { [key]: value / (key.includes('Y') || key === 'heightRatio' ? size.height : size.width) }, size));
        }} /></label>)}
      </fieldset>}
      {selected === 'secondary' && <div className="flex gap-2"><label>Fit <select aria-label="Detail fit" value={doc.detailFit} className="bg-slate-800 p-1 rounded" onChange={e => onChange({ ...doc, detailFit: e.target.value as 'contain' | 'cover' })}><option>contain</option><option>cover</option></select></label><label>Focus <select aria-label="Detail focus" value={doc.detailAlign} className="bg-slate-800 p-1 rounded" onChange={e => onChange({ ...doc, detailAlign: e.target.value as CompositionDocument['detailAlign'] })}>{['center','top','bottom','left','right'].map(x => <option key={x}>{x}</option>)}</select></label></div>}
      {selected === 'secondary' && <div className="flex flex-wrap gap-2"><label>Corner radius <input aria-label="Detail radius" type="number" min="0" max="100" className="w-16 bg-transparent border rounded p-1" value={doc.detailRadius} onChange={e => { const n = Number(e.target.value); if (n >= 0 && n <= 100) onChange({ ...doc, detailRadius: n }); }} /></label>
        <button type="button" className={button} onClick={() => onChange({ ...doc, detailBorder: doc.detailBorder === 'none' ? '1px solid #d9d1ad' : 'none' })}>{doc.detailBorder === 'none' ? 'Add border' : 'Remove border'}</button>
        <button type="button" className={button} onClick={() => onChange({ ...doc, detailShadow: doc.detailShadow === 'none' ? '0 12px 28px #00000026' : 'none' })}>{doc.detailShadow === 'none' ? 'Add shadow' : 'Remove shadow'}</button></div>}
      {doc.objects.find(node => node.id === selected)?.kind === 'button' && (() => { const node = doc.objects.find(node => node.id === selected)!; if (node.kind !== 'button') return null;
        const patch = (key: string, value: string | number | boolean) => onChange({ ...doc, objects: doc.objects.map(o => o.id === node.id ? { ...node, [key]: value } : o) });
        return <fieldset className="space-y-2" onFocusCapture={onStart} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) onFinish(); }}><label>Button label<input aria-label="Button label" className="block w-full bg-transparent rounded border p-2" value={node.text} onChange={e => patch('text', e.target.value)} /></label><label>Fill <input type="color" aria-label="Button fill" value={node.fill} onChange={e => patch('fill', e.target.value)} /></label><label> Text <input type="color" aria-label="Button color" value={node.color} onChange={e => patch('color', e.target.value)} /></label>
          <div className="grid grid-cols-3 gap-2">{(['fontSize','padding','radius'] as const).map(key => <label key={key}>{key}<input aria-label={`Button ${key}`} type="number" className="block w-full rounded border bg-transparent p-1" min={key === 'fontSize' ? 1 : 0} value={node[key]} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= (key === 'fontSize' ? 1 : 0)) patch(key, n); }} /></label>)}</div>
          <label className="block"><input type="checkbox" aria-label="Button auto width" checked={node.autoWidth} onChange={e => patch('autoWidth', e.target.checked)} /> Fit width to content</label>
          <label className="block"><input type="checkbox" aria-label="Button arrow" checked={node.arrow} onChange={e => patch('arrow', e.target.checked)} /> Arrow</label>
          <button type="button" className={button} onClick={() => patch('border', node.border && node.border !== 'none' ? 'none' : '1px solid currentColor')}>Toggle border</button>
        </fieldset>;
      })()}
      {(() => { const node = [...doc.objects, ...doc.decorations].find(node => node.id === selected); if (!node || node.kind !== 'shape') return null;
        const patch = (key: 'fill' | 'stroke' | 'opacity', value: string | number) => onChange({ ...doc, objects: doc.objects.map(o => o.id === node.id ? { ...node, [key]: value } : o), decorations: doc.decorations.map(o => o.id === node.id ? { ...node, [key]: value } : o) });
        const colorKey = node.fill === 'transparent' && node.stroke ? 'stroke' : 'fill', color = node[colorKey] || '#ffffff';
        return <fieldset className="flex gap-3" onFocusCapture={onStart} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) onFinish(); }}>{customLogo && node.shape === 'mark' ? <span>Custom logo · change image in Brand</span> : <label>Color <input className="cursor-pointer" aria-label="Decoration color" type="color" value={color.startsWith('#') ? color.slice(0,7) : '#ffffff'} onChange={e => patch(colorKey, e.target.value)} /></label>}<label>Opacity <input aria-label="Decoration opacity" type="range" min="0" max="1" step=".05" value={node.opacity ?? 1} onChange={e => patch('opacity', Number(e.target.value))} /></label></fieldset>;
      })()}
      <label className="block"><input type="checkbox" aria-label="Allow image bleed" checked={doc.allowBleed} onChange={e => onChange({ ...doc, allowBleed: e.target.checked })} /> Allow image bleed (confirm clipping on export)</label>
    </div>}
  </details>;
}

function GeometryInput({ label, value, disabled, onCommit }: { label: string; value: number; disabled: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <input aria-label={label} type="number" disabled={disabled} placeholder={disabled ? 'Auto' : undefined} className="w-full rounded border border-white/15 bg-transparent p-1.5" value={disabled ? '' : draft}
    onChange={event => setDraft(event.target.value)} onBlur={() => { if (draft.trim() && Number.isFinite(Number(draft))) onCommit(Number(draft)); setDraft(String(value)); }}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />;
}
