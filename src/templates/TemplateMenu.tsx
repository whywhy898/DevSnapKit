export function TemplateMenu({ onApply, disabled }: { onApply: () => void; disabled: boolean }) {
  return <div className="starter-demo-popover absolute bottom-full mb-2 left-0 w-64 bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-2xl z-50 backdrop-blur-xl">
    <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">Templates</div>
    <button type="button" onClick={onApply} disabled={disabled} aria-label="Apply Social Launch template" className="w-full text-left rounded-lg overflow-hidden border border-white/15 hover:border-indigo-400 disabled:opacity-50 cursor-pointer">
      <img src="/templates/social-launch-v1.png" width="1200" height="630" alt="Social Launch template exported in DevSnapKit" className="w-full h-auto object-contain bg-slate-950" />
      <div className="p-2 text-xs text-slate-100 font-semibold flex justify-between"><span>Social Launch</span><span className="text-indigo-300">Apply</span></div>
    </button>
    <p className="text-[10px] text-slate-400 mt-2">1200 × 630 · Keeps your screenshot, replaces styling and text. Undo to return to your previous canvas.</p>
  </div>;
}
