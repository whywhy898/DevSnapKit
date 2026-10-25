import { useState } from 'react';
import type { CompositionDocument } from '../composition/types';
import type { CanvasTextDocument } from '../text/types';
import type { TemplateContext } from '../templates/types';
import { reorderCompositionObject, toggleCompositionObject } from '../composition/document';
import { elementItems } from './model';

export function ElementPicker({ document: doc, texts, context, selected, onSelect, onChange }: {
  document: CompositionDocument | null; texts: CanvasTextDocument; context: TemplateContext | null; selected: string | null;
  onSelect: (id: string) => void; onChange: (doc: CompositionDocument) => void;
}) {
  const [open, setOpen] = useState(false);
  const items = elementItems(doc, texts, context), current = items.find(item => item.id === (selected || 'main')) || items[0];
  return <div data-element-picker className="element-picker">
    <button type="button" aria-label="Elements" aria-expanded={open} className="element-current" onClick={() => setOpen(!open)}><span>{current?.label || 'Elements'}</span><span aria-hidden>⌄</span></button>
    {open && <div className="element-menu" aria-label="Elements list"><div className="element-menu-heading"><strong>Elements</strong><button type="button" onClick={() => setOpen(false)}>Done</button></div>
      {items.map(item => <div className="element-row" key={item.id} data-selected={current?.id === item.id}>
        <button type="button" className="element-label" title={item.title} aria-label={item.selectionLabel} onClick={() => { onSelect(item.id); setOpen(false); }}><strong>{item.label}</strong>{item.preview && <span>{item.preview}</span>}</button>
        {doc && <button type="button" aria-label={`Toggle ${item.label}`} onClick={() => onChange(item.id === 'secondary' && item.hidden ? { ...doc, detailVisible: true, hiddenIds: doc.hiddenIds.filter(id => id !== item.id) } : toggleCompositionObject(doc, item.id))}>{item.hidden ? 'Show' : 'Hide'}</button>}
        {doc && item.reorderable && <div className="element-order"><button type="button" aria-label={`Move ${item.label} back`} disabled={doc.order.indexOf(item.id) === 0} onClick={() => onChange(reorderCompositionObject(doc, item.id, -1))}>↓</button><button type="button" aria-label={`Move ${item.label} forward`} disabled={doc.order.indexOf(item.id) === doc.order.length - 1} onClick={() => onChange(reorderCompositionObject(doc, item.id, 1))}>↑</button></div>}
      </div>)}
    </div>}
  </div>;
}
