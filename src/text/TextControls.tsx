import type { CanvasTextDocument } from './types';
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
      {session ? <><button type="button" className={button} onClick={editor.finish}>Done</button><button type="button" data-text-cancel className={button} onPointerDown={event => event.preventDefault()} onClick={editor.cancel}>Cancel</button></> : <button type="button" aria-label="Edit text" className={button} onClick={() => editor.edit(active.id)}>Edit text</button>}
      <button type="button" aria-label="Delete text" className={button} onClick={editor.remove}>Delete text</button>
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
      <div className="flex gap-1">{(['left', 'center', 'right'] as const).map(align => <button type="button" aria-label={`Align ${align}`} aria-pressed={active.align === align} key={align} onClick={() => editor.style({ align })} className={button + (active.align === align ? ' bg-white/15 border-indigo-400' : '')}>{align === 'left' ? 'Left' : align === 'center' ? 'Center' : 'Right'}</button>)}</div>
      </div></fieldset>
      <fieldset className="space-y-3"><legend className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/50">Color</legend>
      <div className="flex items-end gap-2"><div className="min-w-0 flex-1">{numericOrColor('color', 'Hex color')}</div>
      <input aria-label="Text color picker" type="color" className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-1" value={active.color} onFocus={() => editor.styleStart('color')} onChange={event => editor.changeStyle('color', event.target.value)} onBlur={event => { if (!(event.relatedTarget as HTMLElement | null)?.closest('[data-text-cancel]')) editor.finishStyle('color'); }} /></div>
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
