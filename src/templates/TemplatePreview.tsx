import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CURATED_TEMPLATE_CATALOG } from './collection/catalog';

export function TemplatePreview({ template, onClose }: { template: typeof CURATED_TEMPLATE_CATALOG[number]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    return () => { dialog.current?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const src = template.id === 'editorial-honey' ? template.thumbnail : `/designed/collection/${template.id}-preview.webp`;
  return createPortal(<dialog data-template-preview data-text-editor-ui ref={dialog} aria-label={`${template.name} preview`} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()} className="m-auto w-[calc(100vw-2rem)] max-w-5xl max-h-[90dvh] overflow-auto rounded-2xl border border-slate-600 bg-slate-950 p-3 sm:p-5 text-slate-100 backdrop:bg-black/80">
    <div className="flex items-start justify-between gap-3 mb-3"><div><h2 className="font-semibold">{template.name}</h2><p className="text-xs text-slate-400">{template.tier === 'free' ? 'Free' : 'Pro'} · {template.width} × {template.height}</p></div><button autoFocus type="button" aria-label="Close template preview" onClick={onClose} className="shrink-0 rounded border border-slate-600 px-3 py-2 text-xs hover:bg-slate-800">Close</button></div>
    <img src={src} width={template.width} height={template.height} alt={`${template.name} full exported design`} className="block w-full h-auto max-h-[72dvh] object-contain" />
  </dialog>, document.body);
}
