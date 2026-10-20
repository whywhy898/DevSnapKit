import React, { forwardRef } from 'react';
import { MockupUnit } from '../MockupUnit';
import { PosterDocument, TextFields, TextStyle } from './types';
import { DEFAULT_TEXT_STYLES } from './textStyles';
import './poster.css';

export const DEFAULT_PLACEMENTS = {
  main: { centerX: 1040, centerY: 610, scale: 1 },
  detail: { centerX: 305, centerY: 930, scale: 1 },
};

export function createEditorialHoneyDocument(): PosterDocument {
  return {
    version: 1, templateId: 'editorial-honey',
    fields: { brand: 'Bloomboard', badge: 'BUILD SOMETHING GOOD', eyebrow: 'A LITTLE CLARITY. A BIG NEXT STEP.',
      headlineLead: 'Make room\nfor your', headlineHighlight: 'next idea.',
      description: 'A calmer home for projects,\nnotes, and everyday progress.', cta: 'Find your focus',
      website: 'bloomboard.example', browserTitle: 'bloomboard.example',
      detailHeading: 'Small steps. Thoughtful progress.', detailLabel: 'YOUR EVERYDAY WORKFLOW',
      disclosure: 'Original demo interface · All names and numbers are illustrative' },
    textStyles: {}, assets: { main: '/poster/examples/bloomboard.svg', detail: '/poster/examples/workflow.svg', logo: null },
    assetSizes: { main: { width: 1440, height: 1000 }, detail: { width: 900, height: 400 } },
    placements: structuredClone(DEFAULT_PLACEMENTS), detailFit: 'contain', detailAlign: 'center', detailVisible: true,
  };
}

export function getMainBaseSize(doc: PosterDocument) {
  const dimensions = doc.assetSizes.main || { width: 1440, height: 1000 };
  // Browser chrome has a fixed logical height. Fit the complete frame, including
  // its preset rotation, so a newly supplied square or tall image stays whole.
  const aspect = dimensions.height / dimensions.width;
  const radians = Math.PI * 3 / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  const width = Math.min(1000, (950 - 49 * sin) / (cos + aspect * sin), (800 - 49 * cos) / (sin + aspect * cos));
  return { width, height: width * aspect + 49 };
}

function styleFor(doc: PosterDocument, field: keyof TextFields): React.CSSProperties {
  const style: TextStyle = { ...DEFAULT_TEXT_STYLES[field], ...doc.textStyles[field] };
  return { fontFamily: style.font === 'gelasio' ? 'Poster Gelasio, serif' : 'Poster Manrope, sans-serif',
    fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', color: style.color };
}

export type EditorialHoneyRendererProps = {
  document: PosterDocument; isProUnlocked?: boolean;
  onPointerDown?: (role: 'main' | 'detail', event: React.PointerEvent<HTMLDivElement>) => void;
};

export const EditorialHoneyRenderer = forwardRef<HTMLDivElement, EditorialHoneyRendererProps>(function EditorialHoneyRenderer({ document: doc, onPointerDown }, ref) {
  const f = doc.fields, main = getMainBaseSize(doc);
  const placement = (role: 'main' | 'detail', width: number, height: number, rotation = 0): React.CSSProperties => ({
    position: 'absolute', left: doc.placements[role].centerX, top: doc.placements[role].centerY, width, height,
    transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${doc.placements[role].scale})`, transformOrigin: 'center',
  });
  const text = (field: keyof TextFields, className: string) => <div className={className} data-poster-text={field} style={styleFor(doc, field)}>{f[field]}</div>;
  return <div ref={ref} data-poster-artwork data-template="editorial-honey" className="poster-artwork">
    <div className="poster-brand">{doc.assets.logo ? <img src={doc.assets.logo} alt="Brand logo" /> : <span className="poster-brand-icon" aria-hidden="true">✳</span>}{text('brand', 'poster-brand-name')}</div>
    {f.badge && text('badge', 'poster-badge')}
    <div className="poster-rule" />
    <div className="poster-copy">
      {text('eyebrow', 'poster-eyebrow')}
      <h1 className="poster-headline" data-poster-text="headline"><span data-poster-text="headlineLead" style={styleFor(doc, 'headlineLead')}>{f.headlineLead}</span>{f.headlineHighlight && <><br /><mark data-poster-text="headlineHighlight" style={styleFor(doc, 'headlineHighlight')}><em>{f.headlineHighlight}</em></mark></>}</h1>
      {text('description', 'poster-description')}
      {f.cta && <div className="poster-cta">{text('cta', 'poster-cta-label')}<span aria-hidden="true">↗</span></div>}
    </div>
    <div className="poster-halo" aria-hidden="true" />
    {doc.assets.main && <div data-poster-role="main" className="poster-main" style={placement('main', main.width, main.height, -3)} onPointerDown={e => onPointerDown?.('main', e)}>
      <MockupUnit theme="browser" imageSrc={doc.assets.main} imageName="Main screenshot" interactive={false} windowTitle={f.browserTitle} windowTitleStyle={{ ...styleFor(doc, 'browserTitle'), display: 'block', minWidth: 0, maxHeight: 27, lineHeight: 1.3, overflow: 'hidden' }} shadowLevel="soft" shadowOpacity={35} roundedCorners={14} />
    </div>}
    {doc.detailVisible && doc.assets.detail && <div data-poster-role="detail" className="poster-detail" style={placement('detail', 450, 264)} onPointerDown={e => onPointerDown?.('detail', e)}>
      {text('detailLabel', 'poster-detail-label')}{text('detailHeading', 'poster-detail-heading')}
      <img src={doc.assets.detail} alt="Detail image" style={{ objectFit: doc.detailFit, objectPosition: doc.detailAlign }} />
    </div>}
    {text('disclosure', 'poster-disclosure')}
    <div className="poster-footer">{text('website', 'poster-website')}</div>
  </div>;
});
