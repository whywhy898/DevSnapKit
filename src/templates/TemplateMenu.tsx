import { TEMPLATE_CATALOG } from './catalog';
import type { MockupTemplate } from './types';
import { CURATED_TEMPLATE_CATALOG } from './collection/catalog';
import type { CuratedTemplateId } from './collection/types';

export function TemplateMenu({ onApply, onDesignedApply, disabled, busy }: { onApply: (template: MockupTemplate) => void; onDesignedApply?: (id: CuratedTemplateId) => void; disabled: boolean; busy: boolean }) {
  return <div className="starter-demo-popover absolute bottom-full mb-2 left-0 w-72 max-w-[calc(100vw-2rem)] max-h-[min(32rem,65dvh)] overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-2xl z-50 backdrop-blur-xl">
    <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">Templates</div>
    {busy && <p role="status" className="mb-2 text-xs text-indigo-200">Preparing artwork…</p>}
    {onDesignedApply && <div className="grid gap-2 mb-3">{CURATED_TEMPLATE_CATALOG.map(template => <button key={template.id} type="button" disabled={disabled} aria-label={`Apply ${template.name} template`} onClick={() => onDesignedApply(template.id)} className="text-left rounded-lg overflow-hidden border border-amber-200/30 bg-amber-100 text-slate-900 hover:bg-amber-50 disabled:opacity-50 cursor-pointer">
      {template.thumbnail && <img src={template.thumbnail} width={template.width} height={template.height} alt={`${template.name} exported in DevSnapKit`} className="w-full h-auto" />}
      <span className="block p-3"><span className="font-semibold">{template.name}</span><span className="block text-[10px] mt-1">Free designed poster · {template.width} × {template.height}</span><span className="block text-xs mt-2">{template.description}</span></span>
    </button>)}</div>}
    <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-2">Basic layouts</div>
    <div className="grid gap-2">{TEMPLATE_CATALOG.map(template => <button key={template.id} type="button" onClick={() => onApply(template)} disabled={disabled} aria-label={`Apply ${template.name} template`} className="w-full text-left rounded-lg overflow-hidden border border-white/15 hover:border-indigo-400 disabled:opacity-50 cursor-pointer">
      <img src={template.thumbnail} width={template.canvas.width} height={template.canvas.height} alt={`${template.name} template exported in DevSnapKit`} className="w-full h-24 object-contain bg-slate-950" />
      <div className="p-2 text-xs text-slate-100 space-y-1">
        <div className="font-semibold flex justify-between"><span>{template.name}</span><span className="text-indigo-300">Apply</span></div>
        <div className="text-slate-400 text-[10px]">{template.badge} · {template.canvas.width} × {template.canvas.height}</div>
        <p className="text-slate-300 text-[11px]">{template.description}</p>
      </div>
    </button>)}</div>
    <p className="text-[10px] text-slate-400 mt-2">Keeps your screenshot, replaces styling and text. Undo to return to your previous canvas. Demo screenshots use illustrative data.</p>
  </div>;
}
