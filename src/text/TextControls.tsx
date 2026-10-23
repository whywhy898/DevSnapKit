import type { CanvasTextDocument } from './types';
import { AlignLeft, AlignCenter, AlignRight, Palette, Trash2 } from 'lucide-react';
import type { useCanvasTextEditor } from './useCanvasTextEditor';
type Editor = ReturnType<typeof useCanvasTextEditor>;
const field = 'canvas-text-field min-w-0 rounded-lg border border-white/10 bg-white/[0.04] text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60';
const button = field + ' text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
export function TextControls({ document, editor, disabled, exportError }: { document: CanvasTextDocument; editor: Editor; disabled: boolean; exportError?: string }) {
  const { active, session } = editor;
  const numericOrColor = (kind: 'fontSize' | 'color' | 'x' | 'y' | 'width', label: string) => <label className="flex min-w-0 flex-col gap-1.5 text-xs text-white/60">{label}
    <input aria-label={kind === 'fontSize' ? 'Text size' : kind === 'color' ? 'Text color' : `Text ${kind}`} type="text" inputMode={kind === 'color' ? 'text' : 'decimal'}
      className={field + ' w-full'} value={session?.kind === kind ? session.value : active ? kind === 'x' ? Math.round(active.centerX * editor.size.width * 100) / 100 : kind === 'y' ? Math.round(active.centerY * editor.size.height * 100) / 100 : kind === 'width' ? Math.round(active.widthRatio * editor.size.width * 100) / 100 : active[kind] : ''}
      aria-invalid={session?.kind === kind && !!session.error} onFocus={() => editor.styleStart(kind)}
      onChange={event => editor.changeStyle(kind, event.target.value)} onBlur={event => { if (!(event.relatedTarget as HTMLElement | null)?.closest('[data-text-cancel]')) editor.finishStyle(kind); }}
      onCompositionStart={event => { if (editor.styleStart(kind)) editor.change(event.currentTarget.value, true); }}
      onCompositionEnd={event => { if (editor.styleStart(kind)) editor.change(event.currentTarget.value, false); }}
      onKeyDown={event => { if (event.nativeEvent.isComposing) return; if (event.key === 'Enter') { if (editor.finish()) event.currentTarget.blur(); } if (event.key === 'Escape') { editor.cancel(); event.currentTarget.blur(); } }} />
  </label>;
  return <div data-canvas-text-controls data-text-editor-ui data-export-ignore="true" className="w-full min-w-0 space-y-5" aria-label="Canvas text controls">
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="text-sm font-bold text-white">Text</h3><p className="mt-1 text-xs leading-relaxed text-white/50">Click a text box on the canvas to edit it.</p></div>
      <button type="button" aria-label="Add another text" disabled={disabled || document.layers.length >= 20} onClick={editor.add} className={button + ' shrink-0'}>+ Add</button>
    </div>
    <label className="flex flex-col gap-1.5 text-xs text-white/60">Selected text
    <select aria-label="Current text" className={field + ' w-full'} value={editor.activeId ?? ''} onChange={event => editor.select(event.target.value || null)}>
      <option value="">No text selected</option>{document.layers.map((layer, i) => <option value={layer.id} key={layer.id}>{i + 1}. {layer.content.trim().slice(0, 24) || '(empty)'}</option>)}
    </select></label>
    {active && <>
      <div className="flex flex-wrap gap-2">
      {editor.editingId !== active.id && <button type="button" aria-label="Edit text" className={button} onClick={() => editor.edit(active.id)}>Edit text</button>}
      <button type="button" aria-label="Delete text" className="canvas-text-delete inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400" onClick={editor.remove}><Trash2 size={16} aria-hidden="true" />Delete text</button>
      </div>
      <fieldset className="space-y-3"><legend className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/50">Typography</legend>
      <label className="flex flex-col gap-1.5 text-xs text-white/60">Font
      <select aria-label="Text font" className={field + ' w-full'} value={active.font} onChange={event => editor.style(event.target.value as 'manrope' | 'gelasio')}>
        <option value="manrope">Manrope</option><option value="gelasio">Gelasio</option>
      </select></label>
      <div className="grid grid-cols-2 gap-3">{numericOrColor('fontSize', 'Size')}
      <label className="flex min-w-0 flex-col gap-1.5 text-xs text-white/60">Weight
      <select aria-label="Text weight" className={field + ' w-full'} value={active.weight} onChange={event => editor.style({ weight: Number(event.target.value) as 400 | 600 | 700 | 800 })}>
        {(active.font === 'manrope' ? [400, 600, 700, 800] : [400, 600, 700]).map(weight => <option key={weight} value={weight}>{weight}</option>)}
      </select></label></div>
      <div className="flex items-center justify-between gap-3">
      <button type="button" aria-label="Text italic" aria-pressed={active.italic} disabled={active.font === 'manrope'} className={button + ' italic'} onClick={() => editor.style({ italic: !active.italic })}>Italic</button>
      <div className="flex gap-1" role="group" aria-label="Text alignment">{(['left', 'center', 'right'] as const).map(align => {
        const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
        return <button type="button" aria-label={`Align ${align}`} title={`Align ${align}`} aria-pressed={active.align === align} key={align} onClick={() => editor.style({ align })} className={button + ' inline-flex min-h-10 min-w-10 items-center justify-center' + (active.align === align ? ' bg-white/15 border-indigo-400' : '')}><Icon size={18} aria-hidden="true" /></button>;
      })}</div>
      </div></fieldset>
      <fieldset className="space-y-3"><legend className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/50">Color</legend>
      <label data-text-color-control className="canvas-text-color-control relative flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-400">
        <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-lg border-2 border-slate-400" style={{ backgroundColor: active.color }} />
        <span className="min-w-0 flex-1 text-sm font-semibold">Choose color<span className="block text-[11px] font-normal opacity-70">Open color palette</span></span>
        <Palette size={20} aria-hidden="true" />
        <input aria-label="Text color picker" title="Choose text color" type="color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={active.color} onFocus={() => editor.styleStart('color')} onChange={event => editor.changeStyle('color', event.target.value)} onBlur={event => { if (!(event.relatedTarget as HTMLElement | null)?.closest('[data-text-cancel]')) editor.finishStyle('color'); }}
          onKeyDown={event => { if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); editor.cancel(); event.currentTarget.blur(); } }} />
      </label>
      {numericOrColor('color', 'Hex color')}
      <div className="flex gap-2">
      <button type="button" className={button} onClick={() => editor.style({ color: '#111827' })}>Dark text</button>
      <button type="button" className={button} onClick={() => editor.style({ color: '#FFFFFF' })}>Light text</button>
      </div></fieldset>
      <fieldset className="space-y-3"><legend className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/50">Position &amp; size</legend>
      <div className="grid grid-cols-2 gap-3">{numericOrColor('x', 'Center X')}{numericOrColor('y', 'Center Y')}</div>
      {numericOrColor('width', 'Text box width')}
      <p className="text-[11px] leading-relaxed text-white/50">Measured in canvas pixels. Drag the handles to move or reflow text. Arrow keys move 1 px; Shift moves 10 px.</p>
      </fieldset>
    </>}
    {!active && <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-white/60">Use Add text to create a title or caption, or select an existing text box above.</p>}
    {document.layers.length >= 20 && <p className="w-full text-xs text-amber-300">Maximum 20 text boxes. Delete a box before adding another.</p>}
    {editor.message && <p role={session?.error || session?.composing ? 'alert' : 'status'} className="w-full text-xs text-amber-300 whitespace-pre-wrap">{editor.message}</p>}
    {exportError && <p role="alert" className="w-full text-xs text-red-400 whitespace-pre-wrap">{exportError}</p>}
  </div>;
}
