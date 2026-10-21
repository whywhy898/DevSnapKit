import type { CanvasTextDocument } from './types';
import type { useCanvasTextEditor } from './useCanvasTextEditor';
type Editor = ReturnType<typeof useCanvasTextEditor>;
const field = 'min-w-0 rounded-lg border border-slate-600 bg-slate-800 text-white px-2 py-1.5 text-xs';
const button = field + ' disabled:opacity-40';
export function TextControls({ document, editor, disabled, exportError }: { document: CanvasTextDocument; editor: Editor; disabled: boolean; exportError?: string }) {
  const { active, session } = editor;
  const numericOrColor = (kind: 'fontSize' | 'color', label: string) => <label className="flex items-center gap-1 text-xs text-slate-400">{label}
    <input aria-label={kind === 'fontSize' ? 'Text size' : 'Text color'} type="text" inputMode={kind === 'fontSize' ? 'decimal' : 'text'}
      className={field + (kind === 'fontSize' ? ' w-16' : ' w-24')} value={session?.kind === kind ? session.value : active?.[kind] ?? ''}
      aria-invalid={session?.kind === kind && !!session.error} onFocus={() => editor.styleStart(kind)}
      onChange={event => editor.changeStyle(kind, event.target.value)} onBlur={event => { if (!(event.relatedTarget as HTMLElement | null)?.closest('[data-text-cancel]')) editor.finishStyle(kind); }}
      onKeyDown={event => { if (event.key === 'Enter') { if (editor.finish()) event.currentTarget.blur(); } if (event.key === 'Escape') { editor.cancel(); event.currentTarget.blur(); } }} />
  </label>;
  return <div data-canvas-text-controls data-text-editor-ui data-export-ignore="true" className="w-full min-w-0 px-3 py-2 flex flex-wrap items-center gap-2" aria-label="Canvas text controls">
    <button type="button" aria-label="Add text" disabled={disabled || document.layers.length >= 20} onClick={editor.add} className={button}>Add text</button>
    <select aria-label="Current text" className={field + ' max-w-44'} value={editor.activeId ?? ''} onChange={event => editor.select(event.target.value || null)}>
      <option value="">No text selected</option>{document.layers.map((layer, i) => <option value={layer.id} key={layer.id}>{i + 1}. {layer.content.trim().slice(0, 24) || '(empty)'} · {layer.id.slice(0, 6)}</option>)}
    </select>
    {active && <>
      {session ? <><button type="button" className={button} onClick={editor.finish}>Done</button><button type="button" data-text-cancel className={button} onPointerDown={event => event.preventDefault()} onClick={editor.cancel}>Cancel</button></> : <button type="button" aria-label="Edit text" className={button} onClick={() => editor.edit(active.id)}>Edit text</button>}
      <button type="button" aria-label="Delete text" className={button} onClick={editor.remove}>Delete text</button>
      <select aria-label="Text font" className={field} value={active.font} onChange={event => editor.style(event.target.value as 'manrope' | 'gelasio')}>
        <option value="manrope">Manrope</option><option value="gelasio">Gelasio</option>
      </select>
      <select aria-label="Text weight" className={field} value={active.weight} onChange={event => editor.style({ weight: Number(event.target.value) as 400 | 600 | 700 | 800 })}>
        {(active.font === 'manrope' ? [400, 600, 700, 800] : [400, 600, 700]).map(weight => <option key={weight} value={weight}>{weight}</option>)}
      </select>
      <button type="button" aria-label="Text italic" aria-pressed={active.italic} disabled={active.font === 'manrope'} className={button + ' italic'} onClick={() => editor.style({ italic: !active.italic })}>Italic</button>
      {numericOrColor('fontSize', 'Size')}{numericOrColor('color', 'Color')}
      <input aria-label="Text color picker" type="color" className="w-8 h-8 bg-transparent" value={active.color} onFocus={() => editor.styleStart('color')} onChange={event => editor.changeStyle('color', event.target.value)} onBlur={event => { if (!(event.relatedTarget as HTMLElement | null)?.closest('[data-text-cancel]')) editor.finishStyle('color'); }} />
      <button type="button" className={button} onClick={() => editor.style({ color: '#111827' })}>Dark text</button>
      <button type="button" className={button} onClick={() => editor.style({ color: '#FFFFFF' })}>Light text</button>
      <div className="flex gap-1">{(['left', 'center', 'right'] as const).map(align => <button type="button" aria-label={`Align ${align}`} aria-pressed={active.align === align} key={align} onClick={() => editor.style({ align })} className={button + (active.align === align ? ' border-indigo-400' : '')}>{align[0].toUpperCase()}</button>)}</div>
    </>}
    {document.layers.length >= 20 && <p className="w-full text-xs text-amber-300">Maximum 20 text boxes. Delete a box before adding another.</p>}
    {editor.message && <p role={session?.error || session?.composing ? 'alert' : 'status'} className="w-full text-xs text-amber-300 whitespace-pre-wrap">{editor.message}</p>}
    {exportError && <p role="alert" className="w-full text-xs text-red-400 whitespace-pre-wrap">{exportError}</p>}
  </div>;
}
