import { useEffect, useRef, useState } from 'react';
import { getMainBaseSize } from './editorialHoney';
import { getScaleBounds, validatePlacement } from './geometry';
import type { ImageRole, MediaRole, PosterDocument, TextFields, TextStyle } from './types';
import { DEFAULT_TEXT_STYLES } from './textStyles';

type Change = PosterDocument | ((current: PosterDocument) => PosterDocument);
export type PosterControlsProps = {
  document: PosterDocument;
  onBegin: () => void; onUpdate: (change: Change) => void; onCommit: () => void; onReplace: (change: Change) => void;
  selectedRole: ImageRole; onSelect: (role: ImageRole) => void;
  onUpload: (role: MediaRole, file: File) => void | Promise<void>;
  onClear: (role: MediaRole) => void; onReset: (role: ImageRole) => void;
  errors?: string[];
};

const fields: [keyof TextFields, string][] = [
  ['brand', 'Brand'], ['badge', 'Badge'], ['eyebrow', 'Eyebrow'], ['headlineLead', 'Headline'],
  ['headlineHighlight', 'Highlight'], ['description', 'Description'], ['cta', 'CTA label'], ['website', 'Website'],
  ['browserTitle', 'Browser title'], ['detailHeading', 'Detail heading'], ['detailLabel', 'Detail label'], ['disclosure', 'Example data disclosure'],
];
function styleFor(doc: PosterDocument, field: keyof TextFields): TextStyle {
  return { ...DEFAULT_TEXT_STYLES[field], ...doc.textStyles[field] };
}

function PlacementFields({ document, role, onReplace }: { document: PosterDocument; role: ImageRole; onReplace: PosterControlsProps['onReplace'] }) {
  const placement = document.placements[role];
  const [draft, setDraft] = useState({ centerX: String(placement.centerX), centerY: String(placement.centerY), scale: String(placement.scale) });
  const [error, setError] = useState('');
  useEffect(() => { setDraft({ centerX: String(placement.centerX), centerY: String(placement.centerY), scale: String(placement.scale) }); setError(''); }, [placement.centerX, placement.centerY, placement.scale, role]);
  const base = role === 'main' ? getMainBaseSize(document) : { width: 450, height: 264 };
  const bounds = getScaleBounds(base, role);
  const submit = (key: keyof typeof draft) => {
    const raw = draft[key].trim();
    if (!raw) { setError(`${key === 'scale' ? 'Scale' : key === 'centerX' ? 'X' : 'Y'} is required.`); return; }
    const next = { ...placement, [key]: Number(raw) };
    const result = validatePlacement(next, base, role);
    if (!result.ok) { setError(result.reason); return; }
    setError('');
    onReplace(current => ({ ...current, placements: { ...current.placements, [role]: next } }));
  };
  return <div className="poster-placement-fields">
    {(['centerX', 'centerY', 'scale'] as const).map(key => <label key={key}>{key === 'centerX' ? 'X' : key === 'centerY' ? 'Y' : 'Scale'}
      <input aria-label={`${role} ${key === 'centerX' ? 'X' : key === 'centerY' ? 'Y' : 'Scale'}`} inputMode="decimal" value={draft[key]} onChange={e => setDraft(current => ({ ...current, [key]: e.target.value }))} onBlur={() => submit(key)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
    </label>)}
    <small>Scale {bounds.minScale.toFixed(3)}–{bounds.maxScale.toFixed(3)}×. Center stays inside 1600 × 1200.</small>
    {error && <p role="alert">{error}</p>}
  </div>;
}

export function PosterControls(props: PosterControlsProps) {
  const { document: doc, onBegin, onUpdate, onCommit, onReplace, selectedRole, onSelect, onUpload, onClear, onReset } = props;
  const composing = useRef(false);
  const deferredCommit = useRef(false);
  const [styleField, setStyleField] = useState<keyof TextFields>('headlineHighlight');
  const [uploadError, setUploadError] = useState('');
  const [busyRole, setBusyRole] = useState<MediaRole | null>(null);
  const [styleError, setStyleError] = useState('');
  const style = styleFor(doc, styleField);
  const updateStyle = (patch: Partial<TextStyle>) => onReplace(current => ({ ...current, textStyles: { ...current.textStyles, [styleField]: { ...styleFor(current, styleField), ...patch } } }));
  return <div className="poster-controls">
    <fieldset><legend>Images</legend>
      {(['main', 'detail', 'logo'] as const).map(role => <div className="poster-upload-slot" key={role}>
        <label>Replace {role}<input aria-label={`Replace ${role}`} type="file" accept="image/png,image/jpeg,image/webp" disabled={busyRole !== null} onChange={async event => {
          const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (!file) return;
          setBusyRole(role); setUploadError('');
          try { await onUpload(role, file); } catch (error) { setUploadError(`${role}: ${error instanceof Error ? error.message : 'Image could not be loaded.'}`); } finally { setBusyRole(null); }
        }} /></label>
        {role === 'logo' && doc.assets.logo && <button type="button" onClick={() => onClear('logo')}>Clear logo</button>}
        {role === 'main' && doc.assets.main && <button type="button" onClick={() => onClear('main')}>Clear main image</button>}
        {role === 'detail' && <label><input type="checkbox" checked={doc.detailVisible} onChange={e => onReplace(current => ({ ...current, detailVisible: e.target.checked }))} />Show detail card</label>}
      </div>)}
      <small>PNG, JPEG or WebP. Up to 20 MB and 24 megapixels. Main screenshot is required.</small>
      {busyRole && <p role="status">Loading {busyRole}…</p>}{uploadError && <p role="alert">{uploadError}</p>}
    </fieldset>
    <fieldset><legend>Image position</legend>
      <div className="poster-role-tabs">{(['main', 'detail'] as const).map(role => <button type="button" aria-pressed={selectedRole === role} key={role} onClick={() => onSelect(role)}>{role === 'main' ? 'Main browser' : 'Detail card'}</button>)}</div>
      <PlacementFields key={selectedRole} document={doc} role={selectedRole} onReplace={onReplace} />
      <button type="button" onClick={() => onReset(selectedRole)}>Reset position</button>
      {selectedRole === 'main' && doc.assetSizes.main && doc.assetSizes.main.height > doc.assetSizes.main.width && <p>Landscape screenshots suit this template best. Your full screenshot is preserved.</p>}
      {selectedRole === 'detail' && <><label>Detail fit<select aria-label="Detail fit" value={doc.detailFit} onChange={e => onReplace(current => ({ ...current, detailFit: e.target.value as PosterDocument['detailFit'] }))}><option value="contain">Contain — show full image</option><option value="cover">Cover — crop to fill</option></select></label>
        {doc.detailFit === 'cover' && <><p>Cover crops content outside the image area.</p><label>Crop alignment<select aria-label="Crop alignment" value={doc.detailAlign} onChange={e => onReplace(current => ({ ...current, detailAlign: e.target.value as PosterDocument['detailAlign'] }))}>{['center', 'top', 'bottom', 'left', 'right'].map(value => <option key={value}>{value}</option>)}</select></label></>}
      </>}
    </fieldset>
    <fieldset><legend>Copy</legend>
      {fields.map(([field, label]) => <label key={field}>{label}<textarea aria-label={label} rows={field === 'description' ? 3 : 2} value={doc.fields[field]} onFocus={onBegin} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; if (deferredCommit.current) { deferredCommit.current = false; onCommit(); } }} onChange={e => { const value = e.target.value; onUpdate(current => ({ ...current, fields: { ...current.fields, [field]: value } })); }} onBlur={() => { if (composing.current) deferredCommit.current = true; else onCommit(); }} /></label>)}
    </fieldset>
    <fieldset><legend>Text style</legend>
      <label>Text area<select aria-label="Style text area" value={styleField} onChange={e => setStyleField(e.target.value as keyof TextFields)}>{fields.map(([field, label]) => <option value={field} key={field}>{label}</option>)}</select></label>
      <label>Font<select aria-label="Font" value={style.font} onChange={e => updateStyle(e.target.value === 'gelasio' ? { font: 'gelasio', weight: 400 } : { font: 'manrope', italic: false })}><option value="manrope">Manrope</option><option value="gelasio">Gelasio</option></select></label>
      <label>Font size<input key={`${styleField}-${style.size}`} aria-label="Font size" type="number" min="8" max="160" defaultValue={style.size} onBlur={e => { const size = Number(e.target.value); if (e.target.value.trim() && Number.isFinite(size) && size >= 8 && size <= 160) { setStyleError(''); updateStyle({ size }); } else setStyleError('Font size must be a finite number between 8 and 160.'); }} /></label>
      <label>Weight<select aria-label="Font weight" value={style.weight} onChange={e => updateStyle({ weight: Number(e.target.value) as TextStyle['weight'] })}>{(style.font === 'gelasio' ? [400, 600, 700] : [400, 600, 700, 800]).map(weight => <option key={weight} value={weight}>{weight}</option>)}</select></label>
      <label>Color<input aria-label="Text color" type="color" value={style.color} onFocus={onBegin} onChange={e => { const color = e.target.value; onUpdate(current => ({ ...current, textStyles: { ...current.textStyles, [styleField]: { ...styleFor(current, styleField), color } } })); }} onBlur={onCommit} /></label>
      {style.font === 'gelasio' && <label><input aria-label="Italic" type="checkbox" checked={style.italic} onChange={e => updateStyle({ italic: e.target.checked })} />Italic</label>}
      {styleError && <p role="alert">{styleError}</p>}
    </fieldset>
    {!!props.errors?.length && <div role="alert">{props.errors.map((error, index) => <p key={index}>{error}</p>)}</div>}
  </div>;
}
