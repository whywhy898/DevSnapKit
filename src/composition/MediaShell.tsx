import type { SlotPresentation } from './types';

/** Native frame chrome and an unmodified source image, sized in canvas logical pixels. */
export function MediaShell({ src, name, presentation, title, logicalWidth }: {
  src: string; name?: string; presentation: SlotPresentation; title?: string; logicalWidth?: number;
}) {
  if (presentation.frame === 'phone-light' || presentation.frame === 'phone-dark') {
    // Logical canvas width keeps chrome proportional in previews and resized exports.
    const scale = (logicalWidth && Number.isFinite(logicalWidth) && logicalWidth > 0 ? logicalWidth : 430) / 430;
    const dark = presentation.frame === 'phone-dark';
    const background = dark ? '#141A1C' : '#FBF5EF';
    const foreground = dark ? '#FBF5EF' : '#25232A';
    return <div data-media-frame={presentation.frame} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', borderRadius: 56 * scale, background, border: `${10 * scale}px solid #24202A`, boxSizing: 'border-box',
      boxShadow: `0 ${10 * scale}px ${24 * scale}px #211b2526` }}>
      <div data-media-chrome={presentation.frame} aria-hidden="true" style={{ position: 'relative', height: 54 * scale, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${25 * scale}px`, boxSizing: 'border-box', color: foreground }}>
        <span data-phone-status style={{ fontFamily: 'Arial, sans-serif', fontSize: 14 * scale, fontWeight: 700, lineHeight: 1 }}>9:41</span>
        <span data-phone-capsule style={{ position: 'absolute', top: 10 * scale, left: '50%', transform: 'translateX(-50%)', width: 114 * scale,
          height: 30 * scale, borderRadius: 18 * scale, background: '#18151D' }} />
        <svg aria-hidden="true" width={62 * scale} height={16 * scale} viewBox="0 0 62 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
          <path d="M1 12V9M6 12V6M11 12V3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M19 5Q25 0 31 5M22 8Q25 5 28 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="25" cy="11" r="1.3" fill="currentColor" />
          <rect x="37" y="3" width="20" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="39" y="5" width="15" height="6" rx="1" fill="currentColor" />
          <path d="M60 6V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div data-media-screen style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', borderRadius: `${8 * scale}px ${8 * scale}px ${25 * scale}px ${25 * scale}px`, background }}>
        <img src={src} alt={name || 'Screenshot'} draggable={false} style={{ display: 'block', width: '100%', height: '100%', objectFit: presentation.fit ?? 'contain', objectPosition: presentation.align ?? 'center', pointerEvents: 'none' }} />
      </div>
      <div data-phone-home aria-hidden="true" style={{ height: 24 * scale, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 112 * scale, height: 4 * scale, borderRadius: 3 * scale, background: foreground }} />
      </div>
    </div>;
  }
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
