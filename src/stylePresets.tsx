import React from 'react';

export type CornerStyle =
  | 'default'
  | 'glass-light'
  | 'glass-dark'
  | 'liquid-glass'
  | 'inset-light'
  | 'inset-dark'
  | 'outline'
  | 'border'
  | 'retro'
  | 'card'
  | 'stack'
  | 'stack-2';

export interface CornerStyleMeta {
  id: CornerStyle;
  name: string;
}

export const CORNER_STYLES: CornerStyleMeta[] = [
  { id: 'default', name: 'Default' },
  { id: 'glass-light', name: 'Glass Light' },
  { id: 'glass-dark', name: 'Glass Dark' },
  { id: 'liquid-glass', name: 'Liquid Glass' },
  { id: 'inset-light', name: 'Inset Light' },
  { id: 'inset-dark', name: 'Inset Dark' },
  { id: 'outline', name: 'Outline' },
  { id: 'border', name: 'Border' },
  { id: 'retro', name: 'Retro' },
  { id: 'card', name: 'Card' },
  { id: 'stack', name: 'Stack' },
  { id: 'stack-2', name: 'Stack 2' },
];

export type LayoutPreset =
  | 'flat'
  | 'tilt-left'
  | 'tilt-right'
  | 'dramatic'
  | 'float'
  | 'horizon';

export interface LayoutPresetMeta {
  id: LayoutPreset;
  name: string;
  subtitle: string;
  iconTransform: string;
}

export const LAYOUT_PRESETS: LayoutPresetMeta[] = [
  {
    id: 'flat',
    name: 'Front Flat',
    subtitle: 'Classic 0° front view',
    iconTransform: 'none',
  },
  {
    id: 'tilt-left',
    name: 'Isometric Left',
    subtitle: '-11° left 3D perspective',
    iconTransform: 'perspective(120px) rotateY(-14deg) rotateX(8deg) rotateZ(-3deg)',
  },
  {
    id: 'tilt-right',
    name: 'Isometric Right',
    subtitle: '+11° right 3D perspective',
    iconTransform: 'perspective(120px) rotateY(14deg) rotateX(8deg) rotateZ(3deg)',
  },
  {
    id: 'dramatic',
    name: 'Dynamic Skew',
    subtitle: 'Deep cinematic perspective',
    iconTransform: 'perspective(100px) rotateY(-18deg) rotateX(12deg) rotateZ(-6deg)',
  },
  {
    id: 'float',
    name: 'Floating Tilt',
    subtitle: 'Elevated top-down pitch',
    iconTransform: 'perspective(100px) rotateX(-16deg) translateY(-2px)',
  },
  {
    id: 'horizon',
    name: '3D Horizon',
    subtitle: 'Ground-plane tilted back',
    iconTransform: 'perspective(90px) rotateX(28deg)',
  },
];

export function getLayoutTransform(layout: LayoutPreset): string {
  switch (layout) {
    case 'tilt-left':
      return 'perspective(1200px) rotateY(-11deg) rotateX(7deg) rotateZ(-3deg) scale(0.96)';
    case 'tilt-right':
      return 'perspective(1200px) rotateY(11deg) rotateX(7deg) rotateZ(3deg) scale(0.96)';
    case 'dramatic':
      return 'perspective(900px) rotateY(-16deg) rotateX(12deg) rotateZ(-6deg) scale(0.93)';
    case 'float':
      return 'perspective(1100px) rotateX(-14deg) translateY(-6px) scale(0.95)';
    case 'horizon':
      return 'perspective(750px) rotateX(24deg) scale(0.92)';
    case 'flat':
    default:
      return 'none';
  }
}

export function getCornerStyleClass(style: CornerStyle, windowTheme: string): string {
  switch (style) {
    case 'glass-light':
      return 'bg-white/30 backdrop-blur-xl border border-white/60 p-1';
    case 'glass-dark':
      return 'bg-black/50 backdrop-blur-xl border border-white/15 p-1';
    case 'liquid-glass':
      return 'bg-gradient-to-tr from-amber-500/20 via-rose-500/15 to-cyan-500/20 backdrop-blur-2xl border border-white/40 p-1';
    case 'inset-light':
      return 'bg-white/50 p-px text-slate-800';
    case 'inset-dark':
      return 'bg-black/60 p-px text-white';
    case 'outline':
      return 'bg-white/10 border border-white/30 p-[2px]';
    case 'border':
      return 'bg-black p-1 text-white';
    case 'retro':
      return 'bg-black p-1 text-white';
    case 'card':
    case 'stack':
    case 'stack-2':
      // These styles add cards behind the media, not a mat around it.
      return getCornerStyleClass('default', windowTheme);
    case 'default':
    default:
      if (windowTheme === 'mac-dark') return 'bg-slate-950/95 border border-slate-800/80 text-slate-200';
      if (windowTheme === 'mac-light') return 'bg-white/95 border border-slate-200 text-slate-800';
      if (windowTheme === 'glass') return 'bg-slate-900/60 backdrop-blur-xl border border-white/20 text-white';
      return 'bg-transparent';
  }
}

/**
 * Visual thumbnail renderer representing the top-left corner curve of each style (matching Shots.so Style Picker)
 */
export const CornerThumbnail: React.FC<{ style: CornerStyle }> = ({ style }) => {
  switch (style) {
    case 'default':
      return (
        <svg viewBox="0 0 52 40" className="w-full h-full" fill="none">
          <rect x="2" y="2" width="48" height="36" rx="8" fill="#1e2025" stroke="#333742" strokeWidth="1" />
          <path d="M8 38V18C8 12.4772 12.4772 8 18 8H50" stroke="#71717a" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M12 38V22C12 16.4772 16.4772 12 22 12H50" fill="#2d3139" />
        </svg>
      );
    case 'glass-light':
      return (
        <svg viewBox="0 0 52 40" className="w-full h-full" fill="none">
          <rect x="2" y="2" width="48" height="36" rx="8" fill="#1e2025" stroke="#333742" strokeWidth="1" />
          <path d="M8 38V18C8 12.4772 12.4772 8 18 8H50" stroke="rgba(255,255,255,0.75)" strokeWidth="3" strokeLinecap="round" />
          <path d="M12 38V22C12 16.4772 16.4772 12 22 12H50" fill="rgba(255,255,255,0.25)" />
        </svg>
      );
    case 'glass-dark':
      return (
        <svg viewBox="0 0 52 40" className="w-full h-full" fill="none">
          <rect x="2" y="2" width="48" height="36" rx="8" fill="#101114" stroke="#252730" strokeWidth="1" />
          <path d="M8 38V18C8 12.4772 12.4772 8 18 8H50" stroke="#000000" strokeWidth="4" strokeLinecap="round" />
          <path d="M8 38V18C8 12.4772 12.4772 8 18 8H50" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeLinecap="round" />
          <path d="M12 38V22C12 16.4772 16.4772 12 22 12H50" fill="#1a1c23" />
        </svg>
      );
    case 'liquid-glass':
      return (
        <svg viewBox="0 0 52 40" className="w-full h-full" fill="none">
          <defs>
            <linearGradient id="liquidThumbGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="48" height="36" rx="8" fill="#181a20" stroke="#333742" strokeWidth="1" />
          <path d="M8 38V18C8 12.4772 12.4772 8 18 8H50" stroke="url(#liquidThumbGrad)" strokeWidth="4" strokeLinecap="round" />
          <path d="M13 38V23C13 17.4772 17.4772 13 23 13H50" fill="#2d3139" />
        </svg>
      );
    case 'inset-light':
      return (
        <svg viewBox="0 0 52 40" className="w-full h-full" fill="none">
          <rect x="2" y="2" width="48" height="36" rx="8" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
          <path d="M10 38V20C10 14.4772 14.4772 10 20 10H50" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
          <path d="M13 38V23C13 17.4772 17.4772 13 23 13H50" fill="#94a3b8" />
        </svg>
      );
    case 'inset-dark':
      return (
        <svg viewBox="0 0 52 40" className="w-full h-full" fill="none">
          <rect x="2" y="2" width="48" height="36" rx="8" fill="#090a0d" stroke="#1f2128" strokeWidth="1" />
          <path d="M10 38V20C10 14.4772 14.4772 10 20 10H50" stroke="#000000" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M13 38V23C13 17.4772 17.4772 13 23 13H50" fill="#1e222a" />
        </svg>
      );
    case 'outline':
      return (
        <svg viewBox="0 0 52 40" className="w-full h-full" fill="none">
          <rect x="2" y="2" width="48" height="36" rx="8" fill="#1e2025" stroke="#333742" strokeWidth="1" />
          <path d="M8 38V18C8 12.4772 12.4772 8 18 8H50" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeLinecap="round" />
          <path d="M11 38V21C11 15.4772 15.4772 11 21 11H50" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeLinecap="round" />
        </svg>
      );
    case 'border':
      return (
        <svg viewBox="0 0 52 40" className="w-full h-full" fill="none">
          <rect x="2" y="2" width="48" height="36" rx="8" fill="#1e2025" stroke="#333742" strokeWidth="1" />
          <path d="M8 38V18C8 12.4772 12.4772 8 18 8H50" stroke="#000000" strokeWidth="3" strokeLinecap="round" />
          <path d="M11 38V21C11 15.4772 15.4772 11 21 11H50" fill="#2d3139" />
        </svg>
      );
    case 'retro':
      return (
        <svg viewBox="0 0 52 40" className="w-full h-full" fill="none">
          <rect x="2" y="2" width="48" height="36" rx="8" fill="#1e2025" stroke="#333742" strokeWidth="1" />
          <rect x="12" y="12" width="37" height="25" rx="6" fill="#000000" />
          <rect x="8" y="8" width="37" height="25" rx="6" fill="#000000" />
          <rect x="10" y="10" width="33" height="21" rx="4" fill="#2d3139" />
        </svg>
      );
    case 'card':
      return (
        <svg viewBox="0 0 52 40" className="w-full h-full" fill="none">
          <rect x="2" y="2" width="48" height="36" rx="8" fill="#1e2025" stroke="#333742" strokeWidth="1" />
          <rect x="6" y="12" width="39" height="24" rx="5" fill="#c4c1b9" transform="rotate(-3 26 24)" />
          <rect x="9" y="7" width="39" height="25" rx="5" fill="#f8fafc" />
        </svg>
      );
    case 'stack':
      return (
        <svg viewBox="0 0 52 40" className="w-full h-full" fill="none">
          <rect x="2" y="2" width="48" height="36" rx="8" fill="#1e2025" stroke="#333742" strokeWidth="1" />
          <rect x="10" y="13" width="32" height="24" rx="5" fill="#aaa8a3" />
          <rect x="8" y="9" width="36" height="25" rx="5" fill="#d2cfc6" stroke="#aaa8a3" strokeWidth="0.5" />
          <rect x="6" y="5" width="40" height="26" rx="5" fill="#f8fafc" />
        </svg>
      );
    case 'stack-2':
      return (
        <svg viewBox="0 0 52 40" className="w-full h-full" fill="none">
          <rect x="2" y="2" width="48" height="36" rx="8" fill="#1e2025" stroke="#333742" strokeWidth="1" />
          <rect x="4" y="5" width="38" height="25" rx="5" fill="#aaa8a3" transform="rotate(-4 23 18)" />
          <rect x="7" y="8" width="38" height="25" rx="5" fill="#d2cfc6" stroke="#aaa8a3" strokeWidth="0.5" transform="rotate(-1.5 26 21)" />
          <rect x="10" y="11" width="38" height="25" rx="5" fill="#f8fafc" />
        </svg>
      );
  }
};

export interface CuratedLayoutPreset {
  id: string;
  name: string;
  desc: string;
  layout: LayoutPreset;
  padding: number;
  shadow: 'none' | 'soft' | 'dramatic' | '3d';
  corner: CornerStyle;
}

export const CURATED_LAYOUT_PRESETS: CuratedLayoutPreset[] = [
  {
    id: 'center-hero',
    name: 'Center Hero',
    desc: 'Classic 0° front view',
    layout: 'flat',
    padding: 88,
    shadow: 'dramatic',
    corner: 'default',
  },
  {
    id: 'isometric-left',
    name: '3D Left Launch',
    desc: '-11° Isometric depth',
    layout: 'tilt-left',
    padding: 96,
    shadow: '3d',
    corner: 'card',
  },
  {
    id: 'isometric-right',
    name: '3D Right Tilt',
    desc: '+11° Isometric flight',
    layout: 'tilt-right',
    padding: 96,
    shadow: '3d',
    corner: 'default',
  },
  {
    id: 'dynamic-skew',
    name: 'Action Skew',
    desc: 'Deep cinematic action',
    layout: 'dramatic',
    padding: 72,
    shadow: '3d',
    corner: 'stack',
  },
  {
    id: 'floating-studio',
    name: 'Floating Studio',
    desc: 'Airy top-down pitch',
    layout: 'float',
    padding: 84,
    shadow: 'dramatic',
    corner: 'glass-light',
  },
  {
    id: 'editorial-clean',
    name: 'Minimal Gallery',
    desc: '112px wide breathing space',
    layout: 'flat',
    padding: 112,
    shadow: 'soft',
    corner: 'default',
  },
];

export const SOLID_COLOR_PRESETS = [
  { name: 'Pure White', color: '#ffffff', isLight: true },
  { name: 'Warm Cream', color: '#f8f6f0', isLight: true },
  { name: 'Soft Gray', color: '#f1f5f9', isLight: true },
  { name: 'Graphite', color: '#334155', isLight: false },
  { name: 'Midnight', color: '#0f172a', isLight: false },
  { name: 'Pitch Black', color: '#000000', isLight: false },
  { name: 'Studio Obsidian', color: '#0b0f19', isLight: false },
  { name: 'Electric Indigo', color: '#312e81', isLight: false },
  { name: 'Deep Emerald', color: '#064e3b', isLight: false },
  { name: 'Crimson Wine', color: '#4c0519', isLight: false },
];

export const PATTERN_PRESETS = [
  { id: 'dots', name: 'Dot Matrix', desc: 'Minimal technical dots' },
  { id: 'grid', name: 'Blueprint Grid', desc: 'Precision engineered grid' },
  { id: 'spotlight', name: 'Studio Spotlight', desc: 'Overhead soft focus beam' },
  { id: 'aurora', name: 'Cosmic Aurora', desc: 'Atmospheric ambient nebulae' },
];
