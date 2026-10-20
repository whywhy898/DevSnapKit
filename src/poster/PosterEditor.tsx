import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CanvasStage } from '../CanvasLayout';
import { createEditorialHoneyDocument, DEFAULT_PLACEMENTS, EditorialHoneyRenderer, getMainBaseSize } from './editorialHoney';
import { downloadPoster, exportPoster, posterTextIssues, preparePoster } from './exportPoster';
import { PosterControls } from './PosterControls';
import { AssetRegistry } from './assets';
import { clampCenter, getScaleBounds, isPlacementClipped, toLogicalDelta } from './geometry';
import { usePosterDocument } from './usePosterDocument';
import { trackEvent } from '../telemetry';
import type { ImageRole, MediaRole, Placement } from './types';
import './poster.css';
import './editor-shell.css';

export type PosterEditorProps = { isProUnlocked: boolean; onRequestPro: () => void; active?: boolean; onExportingChange?: (busy: boolean) => void };
type Gesture = { role: ImageRole; kind: 'move' | 'scale'; x: number; y: number; placement: Placement; distance: number; pointerId: number; captureElement: HTMLDivElement };

export function PosterEditor({ isProUnlocked, active = true, onExportingChange }: PosterEditorProps) {
  const [initial] = useState(createEditorialHoneyDocument);
  const history = usePosterDocument(initial), doc = history.document;
  const root = useRef<HTMLDivElement>(null);
  const registry = useRef<AssetRegistry>();
  if (!registry.current) registry.current = new AssetRegistry();
  const gesture = useRef<Gesture | null>(null);
  const [selected, setSelected] = useState<ImageRole>('main');
  const [pixelRatio, setPixelRatio] = useState<1 | 2>(1);
  const [exporting, setExporting] = useState(false);
  const [assetLoading, setAssetLoading] = useState(0);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [cropConfirmation, setCropConfirmation] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const edited = doc !== initial;
  useEffect(() => {
    const sessionAssets = new AssetRegistry();
    registry.current = sessionAssets;
    return () => sessionAssets.dispose();
  }, []);
  useEffect(() => { setCropConfirmation(false); }, [doc]);
  useEffect(() => { if (!active && gesture.current) { gesture.current = null; history.cancel(); } }, [active, history.cancel]);
  useEffect(() => {
    if (!active || !root.current) return;
    let alive = true;
    const timeout = window.setTimeout(async () => {
      try { await preparePoster(root.current!); if (alive) setIssues(posterTextIssues(root.current!)); }
      catch (reason) { if (alive) setIssues([reason instanceof Error ? reason.message : 'Image preparation failed.']); }
    }, 200);
    return () => { alive = false; clearTimeout(timeout); };
  }, [doc, active]);
  useEffect(() => {
    if (!edited) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [edited]);
  const upload = useCallback(async (role: MediaRole, file: File) => {
    setAssetLoading(count => count + 1);
    try {
    const asset = await registry.current!.add(file);
    history.replace(current => ({ ...current, assets: { ...current.assets, [role]: asset.url },
      assetSizes: { ...current.assetSizes, [role]: { width: asset.width, height: asset.height } },
      placements: role === 'main' ? { ...current.placements, main: { ...DEFAULT_PLACEMENTS.main } } : current.placements,
      detailVisible: role === 'detail' ? true : current.detailVisible,
    }));
    if (role !== 'logo') setSelected(role);
    setError(''); trackEvent('poster_asset_replaced', { role });
    } finally { setAssetLoading(count => count - 1); }
  }, [history.replace]);
  useEffect(() => { if (active) trackEvent('poster_open'); }, [active]);
  useEffect(() => {
    if (!active || exporting) return;
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.isComposing || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName) || target?.isContentEditable) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); if (event.shiftKey) history.redo(); else history.undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); history.redo(); }
    };
    const paste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement;
      if (/^(INPUT|TEXTAREA)$/.test(target?.tagName) || target?.isContentEditable) return;
      const file = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith('image/'))?.getAsFile();
      if (file) { event.preventDefault(); upload(selected, file).catch(reason => setError(reason.message)); }
    };
    window.addEventListener('keydown', key); window.addEventListener('paste', paste);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('paste', paste); };
  }, [active, exporting, selected, upload, history.undo, history.redo]);
  const startGesture = (role: ImageRole, event: ReactPointerEvent<HTMLDivElement>, kind: 'move' | 'scale' = 'move') => {
    if (event.button !== 0 || exporting || !root.current) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    const rect = root.current.getBoundingClientRect(), scale = rect.width / 1600;
    const placement = doc.placements[role];
    const center = { x: rect.left + placement.centerX * scale, y: rect.top + placement.centerY * scale };
    gesture.current = { role, kind, x: event.clientX, y: event.clientY, placement, pointerId: event.pointerId, captureElement: event.currentTarget, distance: Math.max(1, Math.hypot(event.clientX - center.x, event.clientY - center.y)) };
    history.begin(); setSelected(role); setFeedback('');
  };
  const moveGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    if (!start || event.pointerId !== start.pointerId || !root.current || exporting) return;
    const rect = root.current.getBoundingClientRect(), previewScale = rect.width / 1600;
    const delta = toLogicalDelta({ x: event.clientX - start.x, y: event.clientY - start.y }, previewScale);
    let placement = { ...start.placement };
    if (start.kind === 'move') {
      const requested = { ...placement, centerX: placement.centerX + delta.x, centerY: placement.centerY + delta.y };
      placement = clampCenter(requested);
      setFeedback(requested.centerX !== placement.centerX || requested.centerY !== placement.centerY ? 'Boundary reached: the image center must stay inside the canvas.' : '');
    } else {
      const centerX = rect.left + placement.centerX * previewScale, centerY = rect.top + placement.centerY * previewScale;
      const requested = start.placement.scale * Math.hypot(event.clientX - centerX, event.clientY - centerY) / start.distance;
      const bounds = getScaleBounds(start.role === 'main' ? getMainBaseSize(doc) : { width: 450, height: 264 }, start.role);
      placement.scale = Math.max(bounds.minScale, Math.min(bounds.maxScale, requested));
      setFeedback(requested !== placement.scale ? 'Scale limit reached. See the limits in Image position.' : '');
    }
    history.update(current => ({ ...current, placements: { ...current.placements, [start.role]: placement } }));
  };
  const endGesture = (cancel = false) => {
    const current = gesture.current;
    if (!current) return;
    const lostCapture = !current.captureElement.hasPointerCapture(current.pointerId);
    gesture.current = null;
    if (cancel || lostCapture) history.cancel(); else history.commit();
  };
  const clipped = (['main', 'detail'] as const).filter(role => doc.assets[role] && (role !== 'detail' || doc.detailVisible) && isPlacementClipped(doc.placements[role], role === 'main' ? getMainBaseSize(doc) : { width: 450, height: 264 }, undefined, role === 'main' ? -3 : 0));
  const download = async (confirmed = false) => {
    if (!root.current) return;
    if (assetLoading) { setError('Wait for the image to finish loading before exporting.'); return; }
    const captured = gesture.current;
    gesture.current = null;
    if (captured?.captureElement.hasPointerCapture(captured.pointerId)) captured.captureElement.releasePointerCapture(captured.pointerId);
    history.commit(); setError('');
    if (!doc.assets.main) { setError('Main screenshot is required. Replace main before exporting.'); return; }
    if (doc.detailVisible && !doc.assets.detail) { setError('Detail image is missing. Replace it or hide the detail card.'); return; }
    if (clipped.length && !confirmed) { setCropConfirmation(true); return; }
    setCropConfirmation(false); setExporting(true); onExportingChange?.(true);
    try { downloadPoster(await exportPoster(root.current, pixelRatio, url => registry.current?.getBlob(url)), pixelRatio); trackEvent('poster_export_success', { scale: pixelRatio }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Poster export failed. Please try again.'); trackEvent('poster_export_failed', { code: 'render_failed' }); }
    finally { setExporting(false); onExportingChange?.(false); }
  };
  const base = selected === 'main' ? getMainBaseSize(doc) : { width: 450, height: 264 }, placement = doc.placements[selected];
  return <section data-poster-editor className="poster-editor" aria-label="Poster editor" style={{ display: active ? undefined : 'none' }}>
    <div className="poster-toolbar"><h2>Editorial Honey</h2><p>Current session only · Changes are not saved to disk</p>
      <button type="button" onClick={history.undo} disabled={!history.canUndo || exporting}>Undo</button><button type="button" onClick={history.redo} disabled={!history.canRedo || exporting}>Redo</button>
      <button type="button" className="poster-controls-toggle" aria-expanded={controlsOpen} onClick={() => setControlsOpen(value => !value)}>Edit poster</button>
      <select aria-label="Poster export size" disabled={exporting} value={pixelRatio} onChange={e => setPixelRatio(Number(e.target.value) as 1 | 2)}><option value={1}>1600 × 1200 PNG</option><option value={2}>3200 × 2400 PNG</option></select>
      <button type="button" onClick={() => download()} disabled={exporting || assetLoading > 0}>{exporting ? 'Preparing PNG…' : assetLoading ? 'Loading image…' : 'Download PNG'}</button>
    </div>
    {error && <div className="poster-error" role="alert">{error}</div>}
    {!!issues.length && <div className="poster-error" role="status">{issues.join('\n')}</div>}
    {feedback && <div className="poster-feedback" role="status">{feedback}</div>}
    {cropConfirmation && <div className="poster-crop-confirm" role="alertdialog" aria-label="Confirm image cropping"><p>{clipped.join(' and ')} extends beyond the canvas. Export will crop those image edges.</p><button onClick={() => setCropConfirmation(false)}>Return to adjust</button><button onClick={() => download(true)}>Export current crop</button></div>}
    <div className={`poster-layout ${controlsOpen ? 'poster-controls-open' : ''}`}>
      <aside className="poster-controls-panel" aria-label="Poster controls"><button type="button" className="poster-controls-close" onClick={() => setControlsOpen(false)}>Close controls</button>
        <fieldset disabled={exporting || assetLoading > 0} className="poster-controls-lock"><PosterControls document={doc} onBegin={history.begin} onUpdate={history.update} onCommit={history.commit} onReplace={history.replace} selectedRole={selected} onSelect={setSelected} onUpload={upload}
          onClear={role => history.replace(current => ({ ...current, assets: { ...current.assets, [role]: null } }))}
          onReset={role => history.replace(current => ({ ...current, placements: { ...current.placements, [role]: { ...DEFAULT_PLACEMENTS[role] } } }))} /></fieldset>
      </aside>
      <div className="poster-preview"><CanvasStage width={1600} height={1200}><div className="poster-preview-root" onPointerMove={moveGesture} onPointerUp={() => endGesture()} onPointerCancel={() => endGesture(true)} onLostPointerCapture={() => endGesture(true)}>
        <EditorialHoneyRenderer ref={root} document={doc} isProUnlocked={isProUnlocked} onPointerDown={startGesture} />
        {doc.assets[selected] && (selected !== 'detail' || doc.detailVisible) && <div data-export-ignore="true" data-poster-selection={selected} className="poster-selection" style={{ left: placement.centerX, top: placement.centerY, width: base.width, height: base.height, transform: `translate(-50%, -50%) rotate(${selected === 'main' ? -3 : 0}deg) scale(${placement.scale})` }}>
          <div className="poster-scale-handle" role="button" aria-label={`Scale ${selected}`} tabIndex={0} title="Drag to scale; use Image position for keyboard adjustments" onPointerDown={event => startGesture(selected, event, 'scale')} />
        </div>}
      </div></CanvasStage></div>
    </div>
  </section>;
}

export default PosterEditor;
