import React from 'react';
import { Upload, Wifi, ChevronLeft, ChevronRight, Lock, RotateCw } from 'lucide-react';
import { CornerStyle, getCornerStyleClass } from './stylePresets';

export type WindowTheme =
  | 'none'
  | 'mac-dark'
  | 'mac-light'
  | 'glass'
  | 'browser'
  | 'macbook'
  | 'studio-display'
  | 'iphone-17'
  | 'phone-clay';

export interface MockupUnitProps {
  theme: WindowTheme;
  imageSrc: string;
  imageName?: string;
  onReplace?: () => void;
  interactive?: boolean;
  shadowLevel?: string;
  shadowOpacity?: number;
  cornerStyle?: CornerStyle;
  roundedCorners?: number;
  windowTitle?: string;
  windowTitleStyle?: React.CSSProperties;
  hideFrame?: boolean;
  zoomStyle?: React.CSSProperties;
}

export const getDeviceBoxShadow = (level: string, opacityPercent: number) => {
  const a = opacityPercent / 100;
  if (level === 'none' || a <= 0) return 'none';
  if (level === 'soft') {
    return `0 10px 25px -5px rgba(0,0,0,${(0.5 * a).toFixed(3)}), 0 0 0 1px rgba(255,255,255,${(0.1 * a).toFixed(3)})`;
  }
  if (level === 'dramatic') {
    return `0 25px 50px -10px rgba(0,0,0,${(0.7 * a).toFixed(3)}), 0 0 0 1px rgba(255,255,255,${(0.15 * a).toFixed(3)})`;
  }
  return `0 35px 80px -15px rgba(0,0,0,${(0.9 * a).toFixed(3)}), 0 0 0 1px rgba(255,255,255,${(0.22 * a).toFixed(3)})`;
};

export const getShadowClass = (level: string = 'dramatic') => {
  switch (level) {
    case 'soft': return 'shadow-lg shadow-black/30';
    case 'dramatic': return 'shadow-2xl shadow-black/70 ring-1 ring-white/10';
    case '3d': return 'shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] ring-1 ring-white/15 scale-[0.99]';
    default: return 'shadow-none';
  }
};

const MediaHoverOverlay: React.FC = () => (
  <div 
    data-export-ignore="true"
    className="media-hover-overlay absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4 text-center z-10 backdrop-blur-[2px] pointer-events-none select-none"
  >
    <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white shadow-lg">
      <Upload className="w-5 h-5" />
    </div>
    <span className="text-xs font-bold text-white drop-shadow">Select Media</span>
    <span className="text-[11px] text-white/80">Open Media Picker</span>
  </div>
);

// Back-to-front order. Relative offsets keep the same silhouette in duo layouts.
const CARD_BACKPLATES: Partial<Record<CornerStyle, React.CSSProperties[]>> = {
  card: [
    { transform: 'translate(-2%, 5%) rotate(-1.4deg) scale(0.98)' },
  ],
  stack: [
    { transform: 'translateY(8%) scaleX(0.92) scaleY(0.98)' },
    { transform: 'translateY(4%) scaleX(0.96) scaleY(0.99)' },
  ],
  'stack-2': [
    { transform: 'translate(-5%, -8%) rotate(-2.4deg) scale(0.92)' },
    { transform: 'translate(-2.8%, -4%) rotate(-0.8deg) scale(0.96)' },
  ],
};

// Include padding and border so inner and outer corner arcs remain concentric.
const CORNER_FRAME_INSETS: Partial<Record<CornerStyle, number>> = {
  'glass-light': 5,
  'glass-dark': 5,
  'liquid-glass': 5,
  'inset-light': 1,
  'inset-dark': 1,
  outline: 3,
  border: 4,
  retro: 4,
};

// Compose material details with the adjustable ambient shadow instead of overriding them.
const CORNER_FRAME_SHADOWS: Partial<Record<CornerStyle, string>> = {
  'glass-light': 'inset 0 1px 0 rgba(255,255,255,0.3)',
  'glass-dark': 'inset 0 1px 0 rgba(255,255,255,0.08)',
  'liquid-glass': 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(255,255,255,0.15)',
  'inset-light': 'inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(0,0,0,0.12)',
  'inset-dark': 'inset 0 1px 1px rgba(0,0,0,0.65), inset 0 -1px 0 rgba(255,255,255,0.12)',
  retro: '6px 6px 0 #000',
};

export const MockupUnit: React.FC<MockupUnitProps> = ({
  theme,
  imageSrc,
  imageName = 'Screenshot',
  onReplace,
  interactive = true,
  shadowLevel = 'dramatic',
  shadowOpacity = 80,
  cornerStyle = 'default',
  roundedCorners = 12,
  windowTitle = '',
  windowTitleStyle,
  hideFrame = false,
  zoomStyle,
}) => {
  const isPhone = theme === 'iphone-17' || theme === 'phone-clay';
  const backplates = CARD_BACKPLATES[cornerStyle];
  // The inner media needs its own clip once a frame separates it from the outer clip.
  const frameInset = CORNER_FRAME_INSETS[cornerStyle] ?? 0;
  const mediaCornerStyle: React.CSSProperties | undefined = frameInset
    ? { borderRadius: Math.max(0, roundedCorners - frameInset) }
    : undefined;
  const surfaceBoxShadow = [
    CORNER_FRAME_SHADOWS[cornerStyle],
    getDeviceBoxShadow(shadowLevel, shadowOpacity),
  ].filter(shadow => shadow && shadow !== 'none').join(', ') || 'none';
  const surface = hideFrame ? (
      <div 
        className={`w-full ${isPhone ? 'h-full aspect-[393/852]' : 'h-auto'} overflow-hidden relative z-30 cursor-pointer group ${getCornerStyleClass(cornerStyle, backplates ? 'none' : theme)}`}
        style={{ 
          borderRadius: `${roundedCorners}px`,
          boxShadow: surfaceBoxShadow,
        }}
        onClick={onReplace}
        title="Click to replace screenshot (or paste via Ctrl+V)"
      >
        <div className={`relative overflow-hidden ${isPhone ? 'h-full' : ''}`} style={mediaCornerStyle}>
        <img 
          src={imageSrc} 
          alt={imageName}
          style={zoomStyle}
          className={`w-full ${isPhone ? 'h-full' : 'h-auto'} object-cover block select-none pointer-events-none`}
        />
        {interactive && onReplace && <MediaHoverOverlay />}
        </div>
      </div>
    ) : (
    <>
      {/* DEVICE FRAME 1: MacBook Pro (Apple Silicon 16" / 14") */}
      {theme === 'macbook' ? (
        <div className="relative z-30 w-full flex flex-col items-center justify-center select-none group">
          {/* Upper Display Assembly (Screen Lid) */}
          <div 
            className="relative w-full pb-[4px] bg-[#121318] transition-all duration-200 border-t border-x border-white/20 shadow-2xl rounded-t-[26px] p-[10px]"
            style={{
              boxShadow: getDeviceBoxShadow(shadowLevel, shadowOpacity),
            }}
          >
            {/* Top Camera Notch */}
            <div className="absolute left-1/2 -translate-x-1/2 z-30 bg-black rounded-b-md flex items-center justify-center pointer-events-none top-[10px] w-20 h-4">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0d1322] ring-1 ring-[#1e2a4a]/80 flex items-center justify-center">
                <div className="w-0.5 h-0.5 rounded-full bg-[#38bdf8]/60" />
              </div>
            </div>

            {/* Screen Area (Liquid Retina XDR 16:10 Display) */}
            <div 
              className="relative w-full overflow-hidden bg-black aspect-[16/10] cursor-pointer group rounded-t-[18px]"
              onClick={onReplace}
              title="Click to replace screenshot (or paste via Ctrl+V)"
            >
              <img 
                src={imageSrc} 
                alt={imageName}
                style={zoomStyle}
                className="w-full h-full object-cover object-top block select-none pointer-events-none"
              />

              {/* Hover Drop/Click Overlay */}
              {interactive && onReplace && <MediaHoverOverlay />}

              {/* Diagonal Screen Sheen */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none z-20" />
            </div>

            {/* Display Bottom Chin with subtle MacBook Pro branding */}
            <div className="w-full bg-[#0e0f14] flex items-center justify-center h-5">
              <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-500 opacity-60">MacBook Pro</span>
            </div>
          </div>

          {/* Connecting Hinge Strip */}
          <div className="w-[96%] bg-[#08090c] border-x border-black/80 h-1.5" />

          {/* Lower Keyboard Deck Base & Front Lip (With Thumb Indent Groove) */}
          <div className="relative w-[103%] -mt-[1px] bg-gradient-to-b from-[#2a2c35] via-[#1a1b22] to-[#0d0e12] border-t border-white/30 shadow-2xl flex items-start justify-center h-[18px] rounded-b-[14px]">
            <div className="bg-[#08090c] rounded-b-[4px] border-b border-white/10 w-20 h-1.5" />
          </div>

          {/* Soft Desk Shadow Under Laptop Base */}
          <div 
            className="w-[92%] h-2.5 bg-black/60 blur-md rounded-full -mt-1 pointer-events-none transition-opacity" 
            style={{ opacity: shadowLevel === 'none' ? 0 : shadowOpacity / 100 }}
          />
        </div>
      ) : theme === 'studio-display' ? (
        /* DEVICE FRAME 2: Apple Studio Display / Pro Display XDR */
        <div className="relative z-30 w-full flex flex-col items-center justify-center select-none group">
          {/* Upper Display Enclosure */}
          <div 
            className="relative w-full bg-[#121318] transition-all duration-200 border border-white/20 shadow-2xl rounded-[22px] p-[10px]"
            style={{
              boxShadow: getDeviceBoxShadow(shadowLevel, shadowOpacity),
            }}
          >
            {/* Top FaceTime HD Camera Dot */}
            <div className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none top-[5px]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0a1128] ring-1 ring-[#1e2a4a]/80 flex items-center justify-center">
                <div className="w-0.5 h-0.5 rounded-full bg-[#38bdf8]/60" />
              </div>
            </div>

            {/* Screen Area (16:9 Studio Retina Glass) */}
            <div 
              className="relative w-full overflow-hidden bg-black aspect-video cursor-pointer group rounded-[14px]"
              onClick={onReplace}
              title="Click to replace screenshot (or paste via Ctrl+V)"
            >
              <img 
                src={imageSrc} 
                alt={imageName}
                style={zoomStyle}
                className="w-full h-full object-cover object-top block select-none pointer-events-none"
              />

              {/* Hover Drop/Click Overlay */}
              {interactive && onReplace && <MediaHoverOverlay />}

              {/* Diagonal Screen Sheen */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none z-20" />
            </div>
          </div>

          {/* Pro Stand Aluminum Neck / Stem */}
          <div className="relative z-10 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 border-x border-white/40 shadow-inner -mt-[2px] flex items-center justify-center w-16 h-14">
            <div className="rounded-full bg-gradient-to-br from-slate-300 to-slate-400 border border-white/50 shadow-sm w-5 h-5" />
          </div>

          {/* Pro Stand Aluminum Foot / Base Plate */}
          <div className="relative z-20 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 rounded-sm border border-white/60 shadow-lg -mt-[1px] w-52 h-2.5" />

          {/* Desk Ambient Drop Shadow */}
          <div 
            className="h-3 bg-black/60 blur-md rounded-full -mt-1 pointer-events-none transition-opacity w-72" 
            style={{ opacity: shadowLevel === 'none' ? 0 : shadowOpacity / 100 }}
          />
        </div>
      ) : theme === 'iphone-17' ? (
        <div className="relative z-30 w-full h-full flex items-center justify-center">
          {/* Titanium Obsidian Hardware Chassis */}
          <div 
            className="relative w-full h-full bg-[#121318] transition-all duration-200 select-none shadow-2xl rounded-[54px] p-[11px]"
            style={{
              boxShadow: getDeviceBoxShadow(shadowLevel, shadowOpacity),
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            {/* Physical Side Buttons */}
            {/* Left: Action Button */}
            <div className="absolute -left-[3.5px] top-[14%] w-[3.5px] h-[5%] bg-gradient-to-r from-slate-600 via-slate-400 to-slate-500 rounded-l-[2px] shadow-sm pointer-events-none" />
            {/* Left: Volume Up */}
            <div className="absolute -left-[3.5px] top-[22%] w-[3.5px] h-[8.5%] bg-gradient-to-r from-slate-600 via-slate-400 to-slate-500 rounded-l-[2px] shadow-sm pointer-events-none" />
            {/* Left: Volume Down */}
            <div className="absolute -left-[3.5px] top-[32%] w-[3.5px] h-[8.5%] bg-gradient-to-r from-slate-600 via-slate-400 to-slate-500 rounded-l-[2px] shadow-sm pointer-events-none" />
            {/* Right: Power / Side Button */}
            <div className="absolute -right-[3.5px] top-[25%] w-[3.5px] h-[12%] bg-gradient-to-l from-slate-600 via-slate-400 to-slate-500 rounded-r-[2px] shadow-sm pointer-events-none" />

            {/* Top Bezel Ear-Piece Micro-Slit */}
            <div className="absolute top-[5px] left-1/2 -translate-x-1/2 w-12 h-[2px] bg-[#24252c] rounded-full pointer-events-none opacity-90 z-20" />

            {/* Inner Super Retina Screen */}
            <div className="relative w-full h-full overflow-hidden bg-black border border-white/5 flex flex-col group rounded-[44px]">
              
              {/* Dynamic Island */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-40 bg-black rounded-full shadow-lg border border-white/10 flex items-center justify-between px-2.5 pointer-events-none select-none w-[108px] h-[28px]">
                <div className="w-2.5 h-2.5 rounded-full bg-[#0a1128] ring-1 ring-[#1e293b]/60 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-[#38bdf8]/50" />
                </div>
                <div className="w-2 h-2 rounded-full bg-[#111116] ring-1 ring-white/5" />
              </div>

              {/* iOS Status Bar */}
              <div className="absolute top-0 left-0 right-0 h-9 flex items-center justify-between px-6 z-30 pointer-events-none text-white text-[11px] font-semibold tracking-tight select-none">
                <span>9:41</span>
                <div className="flex items-center gap-1.5 opacity-90">
                  <div className="flex items-end gap-[1.5px] h-2.5">
                    <span className="w-[2px] h-[3px] bg-white rounded-full" />
                    <span className="w-[2px] h-[5px] bg-white rounded-full" />
                    <span className="w-[2px] h-[7px] bg-white rounded-full" />
                    <span className="w-[2px] h-[9px] bg-white rounded-full" />
                  </div>
                  <Wifi className="w-3 h-3 text-white" />
                  <div className="w-5 h-2.5 rounded-[4px] border border-white/80 p-[1px] flex items-center">
                    <div className="h-full w-3/4 bg-white rounded-[2px]" />
                  </div>
                </div>
              </div>

              {/* Screen Content Image */}
              <div 
                className="relative w-full h-full overflow-hidden bg-slate-950 cursor-pointer group"
                onClick={onReplace}
                title="Click to replace screenshot (or paste via Ctrl+V)"
              >
                <img 
                  src={imageSrc} 
                  alt={imageName}
                  style={zoomStyle}
                  className="w-full h-full object-cover object-top block select-none pointer-events-none"
                />

                {/* Hover Drop/Click To Replace Overlay */}
                {interactive && onReplace && <MediaHoverOverlay />}
              </div>

              {/* Subtle Glass Sheen / Reflection */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none z-20" />

              {/* Bottom Home Indicator */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 h-1 bg-white/40 rounded-full z-30 pointer-events-none shadow-sm w-32" />
            </div>
          </div>
        </div>
      ) : theme === 'phone-clay' ? (
        /* DEVICE FRAME 2: Minimalist Clay Phone */
        <div className="relative z-30 w-full h-full flex items-center justify-center">
          <div 
            className="relative w-full h-full rounded-[44px] p-2 bg-slate-900 border border-white/10 flex flex-col overflow-hidden select-none transition-all duration-200"
            style={{
              boxShadow: getDeviceBoxShadow(shadowLevel, shadowOpacity),
            }}
          >
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-40 w-16 h-3 bg-black rounded-full border border-white/10 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            </div>
            <div 
              className="relative w-full h-full rounded-[38px] overflow-hidden bg-black cursor-pointer group"
              onClick={onReplace}
              title="Click to replace screenshot (or paste via Ctrl+V)"
            >
              <img 
                src={imageSrc} 
                alt={imageName}
                style={zoomStyle}
                className="w-full h-full object-cover object-top block select-none pointer-events-none"
              />
              {interactive && onReplace && <MediaHoverOverlay />}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-white/30 rounded-full z-30 pointer-events-none" />
            </div>
          </div>
        </div>
      ) : theme === 'browser' ? (
        /* DEVICE FRAME 3: Modern Safari / Chrome Browser */
        <div 
          className={`w-full transition-all duration-200 overflow-hidden flex flex-col relative z-30 ${getCornerStyleClass(cornerStyle, theme)}`}
          style={{ 
            borderRadius: `${roundedCorners}px`,
            boxShadow: surfaceBoxShadow,
          }}
        >
          <div className="px-4 py-2.5 flex items-center justify-between gap-3 border-b border-white/10 bg-black/40 backdrop-blur-md">
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-3 h-3 rounded-full bg-rose-500/90 border border-rose-600/40 inline-block shadow-inner" />
              <span className="w-3 h-3 rounded-full bg-amber-500/90 border border-amber-600/40 inline-block shadow-inner" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/90 border border-emerald-600/40 inline-block shadow-inner" />
              <div className="items-center gap-0.5 ml-1 text-slate-500 flex">
                <ChevronLeft className="w-3.5 h-3.5 hover:text-slate-300 transition-colors" />
                <ChevronRight className="w-3.5 h-3.5 hover:text-slate-300 transition-colors" />
              </div>
            </div>

            <div className="flex-1 max-w-sm mx-auto bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-[11px] text-slate-300 font-mono shadow-inner">
              <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate select-none" style={windowTitleStyle} data-poster-text={windowTitleStyle ? 'browserTitle' : undefined}>{windowTitleStyle ? windowTitle : windowTitle || 'https://devsnapkit.com'}</span>
              <RotateCw className="w-2.5 h-2.5 text-slate-500 shrink-0 ml-auto" />
            </div>

            <div className="w-12 shrink-0 flex justify-end">
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            </div>
          </div>

          <div 
            className="relative group overflow-hidden bg-slate-950/40 cursor-pointer"
            style={mediaCornerStyle}
            onClick={onReplace}
            title="Click to replace screenshot (or paste via Ctrl+V)"
          >
            <img 
              src={imageSrc} 
              alt={imageName}
              style={zoomStyle}
              className="w-full h-auto object-cover block select-none pointer-events-none"
            />
            {interactive && onReplace && <MediaHoverOverlay />}
          </div>
        </div>
      ) : (
        /* DEVICE FRAME 4: macOS Dark / Light / Glass / Borderless Window */
        <div 
          className={`w-full transition-all duration-200 overflow-hidden flex flex-col relative z-30 ${getCornerStyleClass(cornerStyle, theme)}`}
          style={{ 
            borderRadius: `${roundedCorners}px`,
            boxShadow: surfaceBoxShadow,
          }}
        >
          {theme !== 'none' && (
            <div className={`px-4 py-2.5 flex items-center justify-between border-b ${
              theme === 'mac-light' ? 'border-slate-200/80 bg-slate-100/90' : 'border-white/10 bg-black/40 backdrop-blur-md'
            }`}>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/90 border border-rose-600/40 inline-block shadow-inner" />
                <span className="w-3 h-3 rounded-full bg-amber-500/90 border border-amber-600/40 inline-block shadow-inner" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/90 border border-emerald-600/40 inline-block shadow-inner" />
              </div>
              
              <div className="text-[11px] font-medium opacity-60 truncate max-w-[200px]">
                {windowTitle}
              </div>

              <div className="w-12" />
            </div>
          )}

          <div 
            className="relative group overflow-hidden bg-slate-950/40 cursor-pointer"
            style={mediaCornerStyle}
            onClick={onReplace}
            title="Click to replace screenshot (or paste via Ctrl+V)"
          >
            <img 
              src={imageSrc} 
              alt={imageName}
              style={zoomStyle}
              className="w-full h-auto object-cover block select-none pointer-events-none"
            />
            {interactive && onReplace && <MediaHoverOverlay />}
          </div>
        </div>
      )}
    </>
  );

  if (!backplates) return surface;

  return (
    <div
      data-corner-card={cornerStyle}
      className={`relative isolate w-full ${isPhone ? 'h-full' : ''}`}
    >
      {backplates.map((plate, index) => (
        <div
          key={index}
          data-card-layer={index}
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            ...plate,
            zIndex: index,
            borderRadius: hideFrame ? roundedCorners : isPhone ? 48 : (theme === 'macbook' || theme === 'studio-display') ? 20 : roundedCorners,
            background: 'linear-gradient(135deg, #dedbd1 0%, #c4c1b9 55%, #aaa8a3 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22), 0 3px 8px rgba(0,0,0,0.16)',
          }}
        />
      ))}
      {surface}
    </div>
  );
};
