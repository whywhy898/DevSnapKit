import { useState } from 'react';
import { CURATED_TEMPLATE_CATALOG } from './collection/catalog';
import type { CuratedTemplateId } from './collection/types';
import type { MockupTemplate } from './types';
import { TemplatePreview } from './TemplatePreview';

/** The legacy factory remains available to saved projects; recommendations are curated. */
export function TemplateMenu({ onDesignedApply, disabled, busy }: { onApply: (template: MockupTemplate) => void; onDesignedApply?: (id: CuratedTemplateId) => void; disabled: boolean; busy: boolean }) {
  const [preview, setPreview] = useState<typeof CURATED_TEMPLATE_CATALOG[number] | null>(null);
  return <div data-template-gallery data-text-editor-ui aria-label="Template gallery" className="starter-demo-popover absolute bottom-full mb-2 left-0 w-80 max-w-[calc(100vw-2rem)] max-h-[min(38rem,70dvh)] overflow-y-auto overscroll-contain bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-2xl z-50 backdrop-blur-xl">
    <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">Templates</div>
    {busy && <p role="status" className="mb-2 text-xs text-indigo-200">Preparing artwork…</p>}
    <div className="grid gap-3">{CURATED_TEMPLATE_CATALOG.map(template => <article key={template.id} className="min-w-0 rounded-lg overflow-hidden border border-white/15 bg-slate-950 text-slate-100">
      <button type="button" aria-label={`Preview ${template.name} template`} onClick={() => setPreview(template)} className="block w-full cursor-pointer hover:bg-slate-800 focus-visible:outline focus-visible:outline-indigo-400">
        <img src={template.thumbnail} width={template.width} height={template.height} alt={`${template.name} exported in DevSnapKit`} className="w-full h-36 object-contain" />
      </button>
      <div className="p-3">
        <div className="flex justify-between gap-2 text-sm font-semibold"><span>{template.name}</span><span className={template.tier === 'free' ? 'text-emerald-300' : 'text-amber-300'}>{template.tier === 'free' ? 'Free' : 'Pro'}</span></div>
        <p className="text-[10px] text-slate-400 mt-1">{template.width} × {template.height}</p>
        <p className="text-xs text-slate-300 mt-2">{template.description}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" onClick={() => setPreview(template)} className="rounded border border-slate-600 px-2.5 py-1.5 text-xs hover:bg-slate-800">Preview</button>
          <button type="button" disabled={disabled || !onDesignedApply} aria-label={`Apply ${template.name} template`} onClick={() => onDesignedApply?.(template.id)} className="rounded bg-indigo-500 px-2.5 py-1.5 text-xs font-semibold hover:bg-indigo-400 disabled:opacity-50">Use template</button>
        </div>
      </div>
    </article>)}</div>
    <p className="text-[10px] text-slate-400 mt-3">Keeps your screenshots, replaces styling and text. Undo to return to your previous canvas. Demo screenshots use illustrative data.</p>
    {preview && <TemplatePreview template={preview} onClose={() => setPreview(null)} />}
  </div>;
}
