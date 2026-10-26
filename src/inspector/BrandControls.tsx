import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { ObjectFrame } from '../composition/types';
import './brand.css';
import { productCopy } from '../productCopy';

export type BrandPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type Props = {
  logoDataUrl: string | null; logoOpacity: number; logoScale: number; logoPos: BrandPosition;
  logoError: string; isProcessingLogo: boolean; templateFrame?: ObjectFrame;
  qrUrl: string; qrDataUrl: string | null; qrScale: number; qrPos: BrandPosition;
  disabled?: boolean;
  onUploadLogo: (event: ChangeEvent<HTMLInputElement>) => void; onRemoveLogo: () => void;
  onLogoOpacity: (opacity: number) => void; onLogoScale: (scale: number) => void; onLogoPosition: (position: BrandPosition) => void;
  onTemplateLogoMove: (patch: Partial<ObjectFrame>) => void; onTemplateLogoReset: () => void;
  onQrUrl: (url: string) => void; onQrSize: (size: number) => void; onQrPosition: (position: BrandPosition) => void; onRemoveQr: () => void;
  onStart: () => void; onFinish: () => void;
};

/** Brand owns only the two existing free asset slots. Saved text lives in Text. */
export function BrandControls(props: Props) {
  const input = useRef<HTMLInputElement>(null);
  const frame = props.templateFrame;
  return <fieldset data-brand-controls className="brand-controls" disabled={props.disabled || props.isProcessingLogo}>
    <p className="brand-intro">{productCopy.freeBrand}</p>
    <section className="brand-section" aria-label="Logo controls">
      <h3>Logo <span className="brand-free">Free</span></h3>
      <input ref={input} type="file" aria-label="Logo file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={props.onUploadLogo} hidden disabled={props.isProcessingLogo} />
      {props.logoDataUrl ? <div className="brand-asset-row">
        <img src={props.logoDataUrl} alt="Your logo" className="brand-thumbnail" />
        <span>Custom logo<span className="brand-note">PNG, SVG, JPG or WebP</span></span>
        <button type="button" aria-label="Replace Logo" onClick={() => input.current?.click()} disabled={props.isProcessingLogo}>Replace</button>
      </div> : <button type="button" className="brand-upload" onClick={() => input.current?.click()} disabled={props.isProcessingLogo}>Upload logo</button>}
      <p className="brand-note">Transparent PNG or SVG recommended. Maximum 5 MB.</p>
      {props.logoError && <p className="brand-error" role="alert">{props.logoError}</p>}
      {props.isProcessingLogo && <p className="brand-note" role="status">Preparing your logo…</p>}
      {(props.logoDataUrl || frame) && <>
        <RangeField label="Logo size" caption="Size" value={props.logoScale} min={frame ? .5 : 3} max={frame ? 20 : 14} step={.1} onChange={props.onLogoScale} onStart={props.onStart} onFinish={props.onFinish} />
        {props.logoDataUrl && <RangeField label="Logo opacity" caption="Opacity" value={Math.round(props.logoOpacity * 100)} min={0} max={100} onChange={n => props.onLogoOpacity(n / 100)} onStart={props.onStart} onFinish={props.onFinish} />}
        {frame ? <div className="brand-field"><span>Position</span><div className="brand-nudge">
          {([['left', -.005, 0, '←'], ['up', 0, -.005, '↑'], ['down', 0, .005, '↓'], ['right', .005, 0, '→']] as const).map(([name, x, y, glyph]) => <button key={name} type="button" aria-label={`Move logo ${name}`} onClick={() => props.onTemplateLogoMove({ centerX: frame.centerX + x, centerY: frame.centerY + y })}>{glyph}</button>)}
          <button type="button" className="brand-reset" onClick={props.onTemplateLogoReset}>Reset</button>
        </div></div> : <PositionField label="Logo position" value={props.logoPos} onChange={props.onLogoPosition} />}
      </>}
      {(props.logoDataUrl || props.logoError) && <button type="button" className="brand-remove" onClick={props.onRemoveLogo}>Remove custom logo</button>}
    </section>
    <section className="brand-section" aria-label="QR code controls">
      <h3>QR code <span className="brand-free">Free</span></h3>
      <label className="brand-url-label" htmlFor="brand-qr-url">Website URL</label>
      <input id="brand-qr-url" aria-label="QR website URL" type="url" value={props.qrUrl} placeholder="https://yourproduct.com" onFocus={props.onStart} onChange={e => props.onQrUrl(e.target.value)} onBlur={props.onFinish} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      <div className="brand-qr-preview">{props.qrDataUrl && <img src={props.qrDataUrl} alt="QR preview" />}<p className="brand-note">Enter a website URL to generate a QR code.</p></div>
      {props.qrUrl.trim() && <>
        <RangeField label="QR size" caption="Size" value={props.qrScale} min={5} max={16} onChange={props.onQrSize} onStart={props.onStart} onFinish={props.onFinish} />
        <PositionField label="QR position" value={props.qrPos} onChange={props.onQrPosition} />
        <button type="button" className="brand-remove" onClick={props.onRemoveQr}>Remove QR code</button>
      </>}
    </section>
  </fieldset>;
}

function RangeField({ label, caption, value, min, max, step = 1, onChange, onStart, onFinish }: { label: string; caption: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; onStart: () => void; onFinish: () => void }) {
  return <div className="brand-field"><label htmlFor={label.split(' ').join('-')}>{caption}</label><div className="brand-range">
    <input id={label.split(' ').join('-')} aria-label={`${label} slider`} type="range" min={min} max={max} step={step} value={value}
      onPointerDown={onStart} onPointerUp={onFinish} onPointerCancel={onFinish} onFocus={onStart} onBlur={onFinish}
      onKeyDown={onStart} onKeyUp={onFinish} onChange={e => onChange(Number(e.target.value))} />
    <BrandNumber label={`${label} percent`} value={Math.round(value * 100) / 100} min={min} max={max} step={step} onCommit={onChange} onStart={onStart} onFinish={onFinish} /><span className="brand-percent">%</span>
  </div></div>;
}

function PositionField({ label, value, onChange }: { label: string; value: BrandPosition; onChange: (n: BrandPosition) => void }) {
  return <div className="brand-field brand-position-field"><span>Position</span><div className="brand-positions" role="group" aria-label={label}>
    {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(position => <button key={position} type="button" aria-label={`${label} ${position}`} aria-pressed={value === position} onClick={() => onChange(position)}>{position.replace('-', ' ')}</button>)}
  </div></div>;
}

function BrandNumber({ label, value, min, max, step, onCommit, onStart, onFinish }: { label: string; value: number; min: number; max: number; step: number; onCommit: (n: number) => void; onStart: () => void; onFinish: () => void }) {
  const [draft, setDraft] = useState(String(value));
  const cancelled = useRef(false);
  useEffect(() => setDraft(String(value)), [value]);
  return <input className="brand-number" aria-label={label} type="number" min={min} max={max} step={step} value={draft} onFocus={onStart}
    onChange={e => setDraft(e.target.value)} onBlur={() => {
      const n = Number(draft);
      if (!cancelled.current && draft.trim() && Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, n)));
      cancelled.current = false; setDraft(String(value)); onFinish();
    }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { cancelled.current = true; e.currentTarget.blur(); } }} />;
}
