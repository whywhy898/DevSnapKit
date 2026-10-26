import type { SlotPresentation } from './types';

/** Native frame chrome and an unmodified source image, sized in canvas logical pixels. */
export function MediaShell({ src, name, presentation, title }: {
  src: string; name?: string; presentation: SlotPresentation; title?: string;
}) {
  const browser = presentation.frame === 'browser-light' || presentation.frame === 'browser-dark';
  const dark = presentation.frame === 'browser-dark';
  return <div data-media-frame={presentation.frame} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', borderRadius: browser ? 12 : 0, background: dark ? '#171b23' : '#fff',
    border: browser ? `1px solid ${dark ? '#404754' : '#d9dce2'}` : undefined, boxSizing: 'border-box', boxShadow: browser ? '0 10px 28px #15203320' : undefined }}>
    {browser && <div data-media-chrome={dark ? 'dark' : 'light'} style={{ height: 26, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px',
      background: dark ? '#252a34' : '#f1f2f4', color: dark ? '#c7ced9' : '#68717d', borderBottom: `1px solid ${dark ? '#404754' : '#d9dce2'}`, boxSizing: 'border-box' }}>
      {['#ed6a5e', '#f4bf50', '#61c454'].map(color => <span key={color} aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />)}
      <span style={{ fontFamily: 'Arial, sans-serif', fontSize: 10, textAlign: 'center', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingRight: 28 }}>{title ?? presentation.title ?? ''}</span>
    </div>}
    <div data-media-screen style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
      <img src={src} alt={name || 'Screenshot'} draggable={false} style={{ display: 'block', width: '100%', height: '100%', objectFit: presentation.fit ?? 'contain', objectPosition: presentation.align ?? 'center', pointerEvents: 'none' }} />
    </div>
  </div>;
}
