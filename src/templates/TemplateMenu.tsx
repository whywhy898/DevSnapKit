import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Layers3, Lock, Sparkles } from 'lucide-react';
import { CURATED_TEMPLATE_CATALOG } from './collection/catalog';
import type { CuratedTemplateId } from './collection/types';
import { groupTemplates, matchCanvasGroup } from './templateGroups';
import { TemplatePreview } from './TemplatePreview';

type Template = typeof CURATED_TEMPLATE_CATALOG[number];
const groups = groupTemplates(CURATED_TEMPLATE_CATALOG);

export function TemplateMenu({ canvasSize, onDesignedApply, onClose, suspended = false, isProUnlocked = false, disabled, busy, error }: {
  canvasSize?: { width: number; height: number };
  onDesignedApply?: (id: CuratedTemplateId) => void;
  onClose?: () => void; suspended?: boolean; isProUnlocked?: boolean; disabled: boolean; busy: boolean; error?: string;
}) {
  const [preview, setPreview] = useState<Template | null>(null);
  const [filter, setFilter] = useState('all');
  const [matchingGroup] = useState(() => matchCanvasGroup(groups, canvasSize));
  const visibleGroups = filter === 'all'
    ? matchingGroup ? [matchingGroup, ...groups.filter(group => group.key !== matchingGroup.key)] : groups
    : groups.filter(group => group.key === filter);
  const dialog = useRef<HTMLDialogElement>(null);
  const galleryScroll = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const lastCard = useRef<HTMLElement | null>(null);
  const chooseFilter = (value: string) => {
    setFilter(value);
    if (galleryScroll.current) galleryScroll.current.scrollTop = 0;
  };

  useEffect(() => {
    trigger.current = document.querySelector<HTMLElement>('[data-template-trigger]') ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    return () => { if (trigger.current?.isConnected) trigger.current.focus(); };
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (suspended) {
      if (element.open) element.close();
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-pro-modal] button[title="Close"]')?.focus());
      return;
    }
    if (!element.open) element.showModal();
    if (lastCard.current?.isConnected) lastCard.current.focus();
  }, [suspended]);

  const content = <dialog ref={dialog} data-template-gallery data-text-editor-ui aria-labelledby="template-gallery-title"
    onCancel={event => { event.preventDefault(); onClose?.(); }}
    onKeyDown={event => event.stopPropagation()}
    onClick={event => { if (event.target === event.currentTarget) onClose?.(); }}
    className="template-gallery">
    <div className="template-gallery-shell">
      <header className="template-gallery-header">
        <div className="template-gallery-heading"><span className="template-gallery-icon"><Layers3 size={21} /></span><div><h2 id="template-gallery-title">Templates</h2><p>Find a starting point for your next visual.</p></div></div>
        <button type="button" className="template-gallery-close" aria-label="Close template gallery" onClick={onClose}><X size={19} /></button>
      </header>
      <div className="template-filters" aria-label="Filter templates by aspect ratio">
        <button type="button" data-template-filter="all" aria-pressed={filter === 'all'} onClick={() => chooseFilter('all')}>All</button>
        {groups.map(group => <button key={group.key} type="button" data-template-filter={group.key} aria-pressed={filter === group.key} onClick={() => chooseFilter(group.key)}>{group.key}</button>)}
      </div>
      {matchingGroup && <div className="template-recommendation" data-template-recommendation>
        <span className="template-recommendation-icon" aria-hidden="true"><Sparkles size={18} /></span>
        <div className="template-recommendation-copy">
          <strong>Matches your canvas ratio · {matchingGroup.key}</strong>
          <span>{matchingGroup.items.length} matching {matchingGroup.items.length === 1 ? 'template' : 'templates'}</span>
        </div>
        <button type="button" data-show-matching disabled={filter === matchingGroup.key} onClick={() => chooseFilter(matchingGroup.key)}>{filter === matchingGroup.key ? 'Showing matches' : 'Show matching'}</button>
      </div>}
      {busy && <p role="status" className="template-gallery-status">Preparing artwork…</p>}
      {error && <p role="alert" className="template-gallery-error">{error}</p>}
      <div ref={galleryScroll} className="template-gallery-scroll">
        {!groups.some(group => filter === 'all' || group.key === filter) && <p className="template-gallery-note">No templates in this size yet. <button type="button" onClick={() => chooseFilter('all')}>View all templates</button></p>}
        {visibleGroups.map(group => <section className="template-group" key={group.key}>
          <div className="template-group-heading"><h3>{group.key}</h3><span>{group.items.length} {group.items.length === 1 ? 'template' : 'templates'}</span></div>
          <div className="template-gallery-grid">{group.items.map(template => <article className="template-card" key={template.id}>
            <button type="button" aria-label={`Preview ${template.name} template`} onClick={() => setPreview(template)} className={`template-card-image ${template.height > template.width ? 'is-portrait' : template.height === template.width ? 'is-square' : 'is-landscape'}`}>
              <img className="object-contain" src={template.thumbnail} width={template.width} height={template.height} alt={`${template.name} exported in DevSnapKit`} loading="lazy" />
            </button>
            <div className="template-card-body">
              <div className="flex justify-between gap-2 text-sm font-semibold"><span>{template.name}</span><span className={template.tier === 'free' ? 'template-tier-free' : 'template-tier-pro'}>{template.tier === 'free' ? 'Free' : 'Pro'}</span></div>
              <p className="template-card-meta">{template.width} × {template.height}</p>
              <p className="template-card-description">{template.description}</p>
              <div className="template-card-actions">
                <button type="button" onClick={() => setPreview(template)}>Preview</button>
                <button type="button" disabled={disabled || !onDesignedApply} aria-label={`Apply ${template.name} template`} onClick={event => { lastCard.current = event.currentTarget; onDesignedApply?.(template.id); }}>
                  {template.tier === 'pro' && !isProUnlocked ? <><Lock size={13} /> Unlock with Pro</> : 'Use template'}
                </button>
              </div>
            </div>
          </article>)}</div>
        </section>)}
      </div>
      <p className="template-gallery-note">Keeps your screenshots, replaces styling and text. Undo to return to your previous canvas.</p>
    </div>
    {preview && <TemplatePreview template={preview} onClose={() => setPreview(null)} />}
  </dialog>;
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}
