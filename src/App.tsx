import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Download, Copy, Upload, Check, Sliders, SlidersHorizontal,
  Lock, Zap, ShieldCheck, 
  CheckCircle2, RefreshCw, KeyRound, QrCode,
  Layers, Trash2, Image as ImageIcon, Sparkles, Palette,
  ChevronDown, AlertCircle, Shuffle, Box, Compass,
  Smartphone, Laptop, Monitor, RotateCw, Plus, X,
  Wand2, Sun, Moon, Pipette, Flame, Grid,
  Globe, AppWindow, Square, FileText, Mail, Receipt,
  Undo2, Redo2, Keyboard, EyeOff
} from 'lucide-react';
import { toCanvas } from 'html-to-image';

import { MOCKUP_PRESETS } from './templates';
import { GRADIENTS, PresetGradient } from './themes';
import { verifyLicenseWithServer, claimLicenseViaApi } from './license';
import { LegalModals, LegalModalType } from './LegalModals';
import { WelcomeOverlay } from './WelcomeOverlay';
import { trackEvent } from './telemetry';
import { 
  CornerStyle, CORNER_STYLES, CornerThumbnail,
  LayoutPreset, LAYOUT_PRESETS,
  CURATED_LAYOUT_PRESETS,
  SOLID_COLOR_PRESETS, PATTERN_PRESETS
} from './stylePresets';
import { WindowTheme } from './MockupUnit';
import { DuoThumbnail, DuoLayoutType } from './DuoThumbnail';
import { useEditorHistory, EditorSnapshot } from './useHistory';
import { CanvasStage, DeviceComposition, FittedScene, SceneSize } from './CanvasLayout';
import { PosterEditor } from './poster/PosterEditor';
import { emptyTextDocument } from './text/document';

// Helper to get true outer rendered DOM dimensions of canvas node (including padding/border)
function getCanvasRenderedDimensions(el: HTMLElement | null): { width: number; height: number } {
  if (!el) return { width: 960, height: 600 };
  const rect = el.getBoundingClientRect();
  const w = Math.round(el.offsetWidth || el.clientWidth || rect.width || 960);
  const h = Math.round(el.offsetHeight || el.clientHeight || rect.height || 600);
  return { width: Math.max(1, w), height: Math.max(1, h) };
}

// Helper to compute exact nominal target resolution (independent of browser window CSS width)
function getCanonicalDimensions(
  aspectId: string,
  scale: number,
  _domWidth: number,
  _domHeight: number,
  autoW?: number,
  autoH?: number,
  customW = 1500,
  customH = 900
): { width: number; height: number } {
  if (aspectId === 'auto' || aspectId === 'custom') {
    const baseW = aspectId === 'custom' ? customW : autoW && autoW > 0 ? autoW : 1200;
    const baseH = aspectId === 'custom' ? customH : autoH && autoH > 0 ? autoH : 776;
    if (scale === 1) {
      return { width: baseW, height: baseH };
    } else if (scale === 2) {
      return { width: baseW * 2, height: baseH * 2 };
    } else {
      // 4K Ultra HD: target standard 3840px longest edge (preserving exact aspect ratio)
      if (baseW >= baseH) {
        const targetW = 3840;
        const targetH = Math.round(targetW * (baseH / baseW));
        return { width: targetW, height: targetH };
      } else {
        const targetH = 3840;
        const targetW = Math.round(targetH * (baseW / baseH));
        return { width: targetW, height: targetH };
      }
    }
  }

  let baseWidth = 1200;
  let baseHeight = 630;

  switch (aspectId) {
    case 'og':
      baseWidth = 1200;
      baseHeight = 630;
      break;
    case '16-9':
      baseWidth = 1920;
      baseHeight = 1080;
      break;
    case '4-3':
      baseWidth = 1200;
      baseHeight = 900;
      break;
    case '1-1':
      baseWidth = 1080;
      baseHeight = 1080;
      break;
    case 'ig-post':
      baseWidth = 1080;
      baseHeight = 1350;
      break;
    case 'ig-story':
      baseWidth = 1080;
      baseHeight = 1920;
      break;
    case 'linkedin':
      baseWidth = 1200;
      baseHeight = 627;
      break;
    case 'youtube':
      baseWidth = 1280;
      baseHeight = 720;
      break;
    default:
      baseWidth = 1200;
      baseHeight = 630;
      break;
  }

  if (scale === 1) {
    return { width: baseWidth, height: baseHeight };
  } else if (scale === 2) {
    if (aspectId === '16-9' || aspectId === 'youtube') return { width: 2560, height: 1440 }; // 2K QHD
    return { width: baseWidth * 2, height: baseHeight * 2 };
  } else {
    // 4K Ultra HD resolution
    if (aspectId === 'og') return { width: 3840, height: 2016 };
    if (aspectId === '16-9' || aspectId === 'youtube') return { width: 3840, height: 2160 };
    if (aspectId === '4-3') return { width: 3200, height: 2400 };
    if (aspectId === '1-1') return { width: 3840, height: 3840 };
    if (aspectId === 'ig-post') return { width: 3072, height: 3840 };
    if (aspectId === 'ig-story') return { width: 2160, height: 3840 };
    if (aspectId === 'linkedin') return { width: 3840, height: 2006 };
    return { width: baseWidth * 3, height: baseHeight * 3 };
  }
}

// Aspect Ratios
interface AspectOption {
  id: string;
  label: string;
  shortLabel?: string;
  desc: string;
  styleClass: string;
}

const ASPECT_RATIOS: AspectOption[] = [
  { id: 'auto', label: 'Auto', shortLabel: 'Auto', desc: 'Adapts to screenshot', styleClass: '' },
  { id: 'og', label: 'Twitter / OG', shortLabel: 'Twitter', desc: '1200 × 630', styleClass: '' },
  { id: '16-9', label: '16:9 Landscape', shortLabel: '16:9', desc: '1920 × 1080', styleClass: '' },
  { id: '1-1', label: '1:1 Square', shortLabel: '1:1', desc: '1080 × 1080', styleClass: '' },
  { id: '4-3', label: '4:3 Showcase', shortLabel: '4:3', desc: '1200 × 900', styleClass: '' },
  // Social Media Presets (F6)
  { id: 'ig-post', label: 'Instagram Post', shortLabel: 'IG Post', desc: '1080 × 1350', styleClass: '' },
  { id: 'ig-story', label: 'Instagram Story / TikTok', shortLabel: 'Story', desc: '1080 × 1920', styleClass: '' },
  { id: 'linkedin', label: 'LinkedIn Post', shortLabel: 'LinkedIn', desc: '1200 × 627', styleClass: '' },
  { id: 'youtube', label: 'YouTube Thumbnail', shortLabel: 'YouTube', desc: '1280 × 720', styleClass: '' },
];

function customAspect(size: SceneSize): AspectOption {
  return { id: 'custom', label: 'Custom', shortLabel: 'Custom', desc: `${size.width} × ${size.height}`, styleClass: '' };
}

// Helper: compute mini background class and inline styles matching canvas
function getMiniBgClassAndStyle(
  bgType: string,
  gradient: PresetGradient,
  solidColor: string,
  isCustomGradient: boolean,
  customGradColor1: string,
  customGradColor2: string,
  customGradAngle: number,
  selectedPattern: string
): { className: string; style: React.CSSProperties } {
  if (bgType === 'solid') {
    return { className: '', style: { backgroundColor: solidColor } };
  }
  if (bgType === 'image') {
    return { className: 'bg-slate-900', style: {} };
  }
  if (bgType === 'gradient') {
    if (isCustomGradient) {
      return {
        className: '',
        style: {
          backgroundImage: `linear-gradient(${customGradAngle}deg, ${customGradColor1}, ${customGradColor2})`,
        },
      };
    }
    return { className: gradient.className || '', style: {} };
  }
  if (bgType === 'pattern') {
    if (selectedPattern === 'dots') {
      return {
        className: 'bg-slate-950 bg-[radial-gradient(rgba(255,255,255,0.4)_1.5px,transparent_1.5px)] [background-size:8px_8px]',
        style: {},
      };
    }
    if (selectedPattern === 'grid') {
      return {
        className: 'bg-slate-950 bg-[linear-gradient(to_right,rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:10px_10px]',
        style: {},
      };
    }
    if (selectedPattern === 'spotlight') {
      return {
        className: 'bg-[#0a0c14] bg-[radial-gradient(ellipse_80%_80%_at_50%_0%,rgba(120,119,198,0.7),transparent)]',
        style: {},
      };
    }
    return {
      className: 'bg-[#060814] bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.6)_0%,transparent_50%),radial-gradient(circle_at_80%_80%,rgba(236,72,153,0.5)_0%,transparent_50%)]',
      style: {},
    };
  }
  // transparent
  return {
    className: 'bg-slate-950 bg-[radial-gradient(#475569_1px,transparent_1px)] [background-size:6px_6px]',
    style: {},
  };
}

// Helper: accurate CSS 3D transform for mini thumbnail cards
function get3DTransformForPreset(preset: LayoutPreset): string {
  switch (preset) {
    case 'tilt-left':
      return 'perspective(180px) rotateY(-14deg) rotateX(8deg) rotateZ(-3deg) scale(0.92)';
    case 'tilt-right':
      return 'perspective(180px) rotateY(14deg) rotateX(8deg) rotateZ(3deg) scale(0.92)';
    case 'dramatic':
      return 'perspective(150px) rotateY(-18deg) rotateX(13deg) rotateZ(-6deg) scale(0.88)';
    case 'float':
      return 'perspective(170px) rotateX(-16deg) translateY(-4px) scale(0.90)';
    case 'horizon':
      return 'perspective(140px) rotateX(26deg) scale(0.88)';
    case 'flat':
    default:
      return 'none';
  }
}

// Live 3D Perspective Card (used in right rail and inspector)
const Live3DPerspectiveCard: React.FC<{
  presetId: LayoutPreset;
  name: string;
  subtitle?: string;
  imageSrc: string;
  secondarySrc?: string;
  layoutMode?: 'single' | 'duo';
  duoLayout?: DuoLayoutType;
  bgType: 'gradient' | 'solid' | 'pattern' | 'transparent' | 'image';
  gradient: PresetGradient;
  solidColor: string;
  isCustomGradient: boolean;
  customGradColor1: string;
  customGradColor2: string;
  customGradAngle: number;
  selectedPattern: string;
  isActive: boolean;
  onClick: () => void;
  layout?: 'rail' | 'inspector';
}> = ({
  presetId,
  name,
  subtitle,
  imageSrc,
  secondarySrc,
  layoutMode = 'single',
  duoLayout = 'side',
  bgType,
  gradient,
  solidColor,
  isCustomGradient,
  customGradColor1,
  customGradColor2,
  customGradAngle,
  selectedPattern,
  isActive,
  onClick,
  layout = 'inspector',
}) => {
  const bgData = getMiniBgClassAndStyle(
    bgType,
    gradient,
    solidColor,
    isCustomGradient,
    customGradColor1,
    customGradColor2,
    customGradAngle,
    selectedPattern
  );

  const transform3D = get3DTransformForPreset(presetId);

  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center w-full rounded-xl border transition-all cursor-pointer active:scale-[0.98] ${
        layout === 'rail' ? 'p-1.5' : 'p-2'
      } ${
        isActive
          ? 'bg-[#eef2ff] border-indigo-300 ring-1 ring-indigo-300 dark:bg-[#242746] dark:border-indigo-500/50 dark:ring-indigo-500/30 shadow-md'
          : 'bg-[#f8fafc] border-slate-200/80 hover:border-slate-300 hover:bg-slate-200/60 dark:bg-[#151726] dark:border-white/[0.08] dark:hover:border-white/20 dark:hover:bg-[#1e2136]'
      }`}
      title={subtitle ? `${name} — ${subtitle}` : name}
    >
      {/* 3D Mini Viewport */}
      <div
        className={`w-full aspect-[16/10] rounded-lg overflow-hidden flex items-center justify-center p-2 relative preserve-3d border border-white/10 ${bgData.className} group-hover:scale-[1.02] transition-transform duration-200`}
        style={bgData.style}
      >
        {layoutMode === 'duo' && secondarySrc ? (
          /* Dual-Image Mockup in 3D Angle */
          <div
            className="w-[86%] aspect-[16/10] transition-all duration-200 pointer-events-none select-none relative flex items-center justify-center"
            style={{
              transform: transform3D,
              filter: isActive
                ? 'drop-shadow(0 10px 20px rgba(0,0,0,0.65)) drop-shadow(0 0 6px rgba(255,255,255,0.25))'
                : 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))',
            }}
          >
            {duoLayout === 'side' && (
              <div className="w-full h-full flex items-center justify-center gap-1.5 p-0.5">
                <div className="w-[48%] h-[82%] rounded-[2px] overflow-hidden shadow-md border border-white/20 bg-black/90 relative">
                  <img src={imageSrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
                </div>
                <div className="w-[48%] h-[82%] rounded-[2px] overflow-hidden shadow-md border border-white/20 bg-black/90 relative">
                  <img src={secondarySrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
                </div>
              </div>
            )}
            {duoLayout === 'stack' && (
              <div className="relative w-full h-full flex items-center justify-center">
                <div className="absolute w-[58%] h-[74%] -translate-x-2 -translate-y-1 rounded-[2px] overflow-hidden shadow-md border border-white/20 bg-black/90 z-10">
                  <img src={imageSrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
                </div>
                <div className="absolute w-[52%] h-[68%] translate-x-2 translate-y-1.5 rotate-2 rounded-[2px] overflow-hidden shadow-lg border border-white/30 bg-black/90 z-20">
                  <img src={secondarySrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
                </div>
              </div>
            )}
            {duoLayout === 'hero' && (
              <div className="w-full h-full flex items-center justify-center gap-1.5 p-0.5">
                <div className="w-[60%] h-[84%] rounded-[2px] overflow-hidden shadow-md border border-white/20 bg-black/90 relative">
                  <img src={imageSrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
                </div>
                <div className="w-[36%] h-[58%] rounded-[2px] overflow-hidden shadow-md border border-white/20 bg-black/90 relative">
                  <img src={secondarySrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
                </div>
              </div>
            )}
            {duoLayout === 'vertical' && (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-0.5">
                <div className="w-[84%] h-[44%] rounded-[2px] overflow-hidden shadow-md border border-white/20 bg-black/90 relative">
                  <img src={imageSrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
                </div>
                <div className="w-[84%] h-[44%] rounded-[2px] overflow-hidden shadow-md border border-white/20 bg-black/90 relative">
                  <img src={secondarySrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Single Screenshot in 3D Angle */
          <div
            className="w-[76%] aspect-[16/10] rounded-[3px] overflow-hidden shadow-lg border border-white/20 bg-black/90 transition-all duration-200 pointer-events-none select-none relative"
            style={{
              transform: transform3D,
              boxShadow: isActive
                ? '0 10px 24px -2px rgba(0,0,0,0.65), 0 0 10px rgba(255,255,255,0.2)'
                : '0 6px 16px -2px rgba(0,0,0,0.5)',
            }}
          >
            <img
              src={imageSrc}
              alt=""
              className="w-full h-full object-cover object-top block"
              loading="lazy"
            />
            {/* Glass reflection sheen */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
          </div>
        )}
      </div>

      {/* Preset Title */}
      <div className={`w-full mt-1.5 text-center px-1 text-[11px] font-medium truncate ${
        isActive 
          ? 'text-indigo-950 dark:text-white font-semibold' 
          : 'text-slate-800 dark:text-white/80 group-hover:text-slate-950 dark:group-hover:text-white'
      }`}>
        {name}
      </div>

      {/* Preset Subtitle (Inspector only) */}
      {layout === 'inspector' && subtitle && (
        <div className="w-full text-center px-1 text-[10px] text-slate-600 dark:text-white/50 truncate -mt-0.5 mb-0.5">
          {subtitle}
        </div>
      )}
    </button>
  );
};

// Mini Visual Preview Thumbnail for Curated Compositions (Live Synchronized)
const CuratedThumbnail: React.FC<{
  id: string;
  imageSrc: string;
  secondarySrc?: string;
  layoutMode?: 'single' | 'duo';
  duoLayout?: DuoLayoutType;
  bgType: 'gradient' | 'solid' | 'pattern' | 'transparent' | 'image';
  gradient: PresetGradient;
  solidColor: string;
  isCustomGradient: boolean;
  customGradColor1: string;
  customGradColor2: string;
  customGradAngle: number;
  selectedPattern: string;
}> = ({
  id,
  imageSrc,
  secondarySrc,
  layoutMode = 'single',
  duoLayout = 'side',
  bgType,
  gradient,
  solidColor,
  isCustomGradient,
  customGradColor1,
  customGradColor2,
  customGradAngle,
  selectedPattern,
}) => {
  const bgData = getMiniBgClassAndStyle(
    bgType,
    gradient,
    solidColor,
    isCustomGradient,
    customGradColor1,
    customGradColor2,
    customGradAngle,
    selectedPattern
  );

  let transform = 'none';
  if (id === 'isometric-left') {
    transform = 'perspective(180px) rotateY(-14deg) rotateX(8deg) rotateZ(-3deg) scale(0.92)';
  } else if (id === 'isometric-right') {
    transform = 'perspective(180px) rotateY(14deg) rotateX(8deg) rotateZ(3deg) scale(0.92)';
  } else if (id === 'action-skew' || id === 'dynamic-skew') {
    transform = 'perspective(150px) rotateY(-18deg) rotateX(13deg) rotateZ(-6deg) scale(0.88)';
  } else if (id === 'floating-studio') {
    transform = 'perspective(170px) rotateX(-16deg) translateY(-4px) scale(0.90)';
  } else if (id === 'minimal-gallery' || id === 'editorial-clean') {
    transform = 'perspective(140px) rotateX(26deg) scale(0.88)';
  }

  return (
    <div
      className={`w-full aspect-[16/10] rounded-lg overflow-hidden flex items-center justify-center p-2 relative preserve-3d border border-white/10 ${bgData.className}`}
      style={bgData.style}
    >
      {layoutMode === 'duo' && secondarySrc ? (
        /* Dual-Image Mockup in Curated 3D Angle */
        <div
          className="w-[86%] aspect-[16/10] transition-all duration-200 pointer-events-none select-none relative flex items-center justify-center"
          style={{
            transform,
            filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))',
          }}
        >
          {duoLayout === 'side' && (
            <div className="w-full h-full flex items-center justify-center gap-1.5 p-0.5">
              <div className="w-[48%] h-[82%] rounded-[2px] overflow-hidden shadow-md border border-white/20 bg-black/90 relative">
                <img src={imageSrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
              </div>
              <div className="w-[48%] h-[82%] rounded-[2px] overflow-hidden shadow-md border border-white/20 bg-black/90 relative">
                <img src={secondarySrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
              </div>
            </div>
          )}
          {duoLayout === 'stack' && (
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute w-[58%] h-[74%] -translate-x-2 -translate-y-1 rounded-[2px] overflow-hidden shadow-md border border-white/20 bg-black/90 z-10">
                <img src={imageSrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
              </div>
              <div className="absolute w-[52%] h-[68%] translate-x-2 translate-y-1.5 rotate-2 rounded-[2px] overflow-hidden shadow-lg border border-white/30 bg-black/90 z-20">
                <img src={secondarySrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
              </div>
            </div>
          )}
          {duoLayout === 'hero' && (
            <div className="w-full h-full flex items-center justify-center gap-1.5 p-0.5">
              <div className="w-[60%] h-[84%] rounded-[2px] overflow-hidden shadow-md border border-white/20 bg-black/90 relative">
                <img src={imageSrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
              </div>
              <div className="w-[36%] h-[58%] rounded-[2px] overflow-hidden shadow-md border border-white/20 bg-black/90 relative">
                <img src={secondarySrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
              </div>
            </div>
          )}
          {duoLayout === 'vertical' && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-0.5">
              <div className="w-[84%] h-[44%] rounded-[2px] overflow-hidden shadow-md border border-white/20 bg-black/90 relative">
                <img src={imageSrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
              </div>
              <div className="w-[84%] h-[44%] rounded-[2px] overflow-hidden shadow-md border border-white/20 bg-black/90 relative">
                <img src={secondarySrc} alt="" className="w-full h-full object-cover object-top block" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Single Screenshot in Curated 3D Angle */
        <div
          className="w-[76%] aspect-[16/10] rounded-[3px] overflow-hidden shadow-lg border border-white/20 bg-black/90 transition-transform duration-200 relative"
          style={{
            transform,
            boxShadow: '0 6px 14px -2px rgba(0,0,0,0.5)',
          }}
        >
          <img
            src={imageSrc}
            alt=""
            className="w-full h-full object-cover object-top block select-none pointer-events-none"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
        </div>
      )}
    </div>
  );
};

export default function App() {
  // Preset Template State (default to Social Launch 'social')
  const initialPreset = MOCKUP_PRESETS.find(p => p.id === 'social') || MOCKUP_PRESETS[0];
  const [selectedPreset, setSelectedPreset] = useState<string>(initialPreset.id);
  const [imageSrc, setImageSrc] = useState<string>(initialPreset.svgDataUri);
  const [imageName, setImageName] = useState<string>('social-launch.svg');
  const [, setImageNaturalSize] = useState<{ width: number; height: number }>({ width: 820, height: 480 });

  // Styling Customizations
  const [gradient, setGradient] = useState<PresetGradient>(GRADIENTS[0]);
  const [aspectRatio, setAspectRatio] = useState<AspectOption>(ASPECT_RATIOS[0]);
  const [customCanvasSize, setCustomCanvasSize] = useState<SceneSize>({ width: 1500, height: 900 });
  const [dimensionDraft, setDimensionDraft] = useState({ width: '1500', height: '900' });
  const [dimensionError, setDimensionError] = useState('');
  const aspectOptions = useMemo(() => [...ASPECT_RATIOS, customAspect(customCanvasSize)], [customCanvasSize]);
  const [naturalSceneSize, setNaturalSceneSize] = useState<SceneSize>({ width: 1024, height: 600 });
  const handleNaturalSceneSize = useCallback((size: SceneSize) => {
    setNaturalSceneSize(prev => prev.width === size.width && prev.height === size.height ? prev : size);
  }, []);
  const [windowTheme, setWindowTheme] = useState<WindowTheme>('none');
  const [windowTitle, setWindowTitle] = useState<string>(initialPreset.title);
  const [padding, setPadding] = useState<number>(88);
  const [roundedCorners, setRoundedCorners] = useState<number>(14);
  const [shadowLevel, setShadowLevel] = useState<'none' | 'soft' | 'dramatic' | '3d'>('dramatic');
  const [shadowOpacity, setShadowOpacity] = useState<number>(75); // 0 to 100%
  
  // 3D Layout & Corner Styles (from Shots.so inspiration)
  const [activeCuratedLayout, setActiveCuratedLayout] = useState<string>('center-hero');
  const [cornerStyle, setCornerStyle] = useState<CornerStyle>('default');
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>('flat');
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  // Dual-Image State (v2 Specification)
  const [secondarySrc, setSecondarySrc] = useState<string | null>(null);
  const [secondaryName, setSecondaryName] = useState<string>('');
  const [layoutMode, setLayoutMode] = useState<'single' | 'duo'>('single');
  const [studioMode, setStudioMode] = useState<'mockup' | 'poster'>('mockup');
  const [posterExporting, setPosterExporting] = useState(false);
  const [duoLayout, setDuoLayout] = useState<DuoLayoutType>('side');
  const [isSlot2Dragging, setIsSlot2Dragging] = useState<boolean>(false);
  const secondaryFileInputRef = useRef<HTMLInputElement>(null);

  // Background Types Expansion (Gradient, Solid, Transparent, Pattern, Image)
  const [bgType, setBgType] = useState<'gradient' | 'solid' | 'transparent' | 'pattern' | 'image'>('gradient');
  const [solidColor, setSolidColor] = useState<string>('#0b0f19');
  const [isCustomGradient, setIsCustomGradient] = useState<boolean>(false);
  const [customGradColor1, setCustomGradColor1] = useState<string>('#6366f1');
  const [customGradColor2, setCustomGradColor2] = useState<string>('#ec4899');
  const [customGradAngle, setCustomGradAngle] = useState<number>(135);
  const [selectedPattern, setSelectedPattern] = useState<'dots' | 'grid' | 'spotlight' | 'aurora'>('dots');

  // Custom Background Image State (F3)
  const [bgImageSrc, setBgImageSrc] = useState<string | null>(null);
  const [bgImageBlur, setBgImageBlur] = useState<number>(0);
  const [bgImageOpacity, setBgImageOpacity] = useState<number>(100);
  const [bgImageFit, setBgImageFit] = useState<'cover' | 'contain'>('cover');
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  // Hide Mockup State (F4)
  const [hideMockup, setHideMockup] = useState<boolean>(false);

  // Shots-aligned Mockup Zoom & Pan State (Camera Dolly: 75% to 400%)
  const [mockupZoom, setMockupZoom] = useState<number>(100);
  const [mockupOffsetX, setMockupOffsetX] = useState<number>(0);
  const [mockupOffsetY, setMockupOffsetY] = useState<number>(0);

  // Slot 1 In-Frame Image Fit & Pan State (Crop & Focus: 50% to 300%)
  const [imageZoom, setImageZoom] = useState<number>(100);
  const [imageOffsetX, setImageOffsetX] = useState<number>(0);
  const [imageOffsetY, setImageOffsetY] = useState<number>(0);

  // Theme Mode (Default 'light', user toggleable to 'dark')
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shotcraft_theme_mode');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light'; // Default to Light theme as requested
  });

  useEffect(() => {
    try {
      localStorage.setItem('shotcraft_theme_mode', themeMode);
      if (themeMode === 'light') {
        document.documentElement.classList.add('theme-light');
        document.documentElement.classList.remove('theme-dark', 'dark');
        document.body.classList.add('theme-light');
        document.body.classList.remove('theme-dark', 'dark');
      } else {
        document.documentElement.classList.add('theme-dark', 'dark');
        document.documentElement.classList.remove('theme-light');
        document.body.classList.add('theme-dark', 'dark');
        document.body.classList.remove('theme-light');
      }
    } catch (e) {
      console.error(e);
    }
  }, [themeMode]);

  // Modals & UI toggles (F2 / F6)
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [showDockMoreRatios, setShowDockMoreRatios] = useState<boolean>(false);

  // Slot 1 In-Frame Image Fit Style computation (In-Screen Crop & Pan)
  const imageFitStyle: React.CSSProperties = (imageZoom !== 100 || imageOffsetX !== 0 || imageOffsetY !== 0) ? {
    transform: `scale(${imageZoom / 100}) translate(${imageOffsetX}%, ${imageOffsetY}%)`,
    transformOrigin: 'center center',
  } : {};
  const zoomStyle = imageFitStyle; // Backward compatibility alias

  // VFX Optical Lighting & Film Noise (Shots.so Aesthetic)
  const [vfxNoise, setVfxNoise] = useState<boolean>(false);
  const [vfxNoiseOpacity, setVfxNoiseOpacity] = useState<number>(8); // 0 to 20%
  const [vfxGlow, setVfxGlow] = useState<boolean>(true);
  const [vfxGlowColor, setVfxGlowColor] = useState<string>('#6366f1');
  const [vfxGlowOpacity, setVfxGlowOpacity] = useState<number>(30); // 0 to 80%

  // Watermark Settings (Free: 100% clean, Pro: Custom Brand Badge)
  const [customBrandWatermark, setCustomBrandWatermark] = useState<string>('');

  // Pro Feature 1: Custom Logo State
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoPos, setLogoPos] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>('bottom-right');
  const [logoScale, setLogoScale] = useState<number>(7); // % of canvas height (3 to 14)
  const [logoOpacity, setLogoOpacity] = useState<number>(1);
  const [logoError, setLogoError] = useState<string>('');
  const [isProcessingLogo, setIsProcessingLogo] = useState<boolean>(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Pro Feature 2: Dynamic QR Code State
  const [qrUrl, setQrUrl] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrPos, setQrPos] = useState<'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'>('bottom-left');
  const [qrScale, setQrScale] = useState<number>(9); // % of canvas height (5 to 16)

  // Pro Feature 3: Batch Multi-Size Export State
  const [selectedBatchAspects, setSelectedBatchAspects] = useState<string[]>(['og', '16-9', '4-3', '1-1']);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Export Settings (Resolution & Format)
  const [exportScale, setExportScale] = useState<number>(2); // 1 = 1x, 2 = 2x HD, 4 = 4K Ultra HD
  const [exportFormat, setExportFormat] = useState<'png' | 'webp' | 'jpeg'>('png');
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showDemoTemplatesMenu, setShowDemoTemplatesMenu] = useState<boolean>(false);

  // Interactive UI States
  const [sidebarTab, setSidebarTab] = useState<'style' | 'background' | 'brand' | 'export'>('style');
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showProModal, setShowProModal] = useState<boolean>(false);
  const [showClaimModal, setShowClaimModal] = useState<boolean>(false);
  const [claimModalTab, setClaimModalTab] = useState<'key' | 'claim'>('key');
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [activeLegalModal, setActiveLegalModal] = useState<LegalModalType>(null);

  // Pro & License State
  const [isProUnlocked, setIsProUnlocked] = useState<boolean>(false);
  const [proLicenseInput, setProLicenseInput] = useState<string>('');
  const [licenseError, setLicenseError] = useState<string>('');
  const [isVerifyingKey, setIsVerifyingKey] = useState<boolean>(false);
  const [claimOrderId, setClaimOrderId] = useState<string>('');
  const [claimError, setClaimError] = useState<string>('');
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [purchasedLicenseKey, setPurchasedLicenseKey] = useState<string>('');
  const [keyCopied, setKeyCopied] = useState<boolean>(false);


  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const [isCapturingPayment, setIsCapturingPayment] = useState<boolean>(false);
  const [canvasDomSize, setCanvasDomSize] = useState<{ width: number; height: number }>({ width: 960, height: 600 });

  // Snapshot for History (Undo / Redo - F1)
  const [textDocument, setTextDocument] = useState(emptyTextDocument);
  const currentSnapshot: EditorSnapshot = useMemo(() => ({
    textDocument,
    gradientId: gradient.id,
    selectedPreset,
    imageSrc,
    imageName,
    windowTheme,
    windowTitle,
    padding,
    roundedCorners,
    shadowLevel,
    shadowOpacity,
    activeCuratedLayout,
    cornerStyle,
    layoutPreset,
    aspectRatioId: aspectRatio.id,
    customCanvasSize,
    secondarySrc,
    secondaryName,
    layoutMode,
    duoLayout,
    bgType,
    solidColor,
    isCustomGradient,
    customGradColor1,
    customGradColor2,
    customGradAngle,
    selectedPattern,
    vfxNoise,
    vfxNoiseOpacity,
    vfxGlow,
    vfxGlowColor,
    vfxGlowOpacity,
    customBrandWatermark,
    logoDataUrl,
    logoPos,
    logoScale,
    logoOpacity,
    qrUrl,
    qrPos,
    qrScale,
    bgImageSrc,
    bgImageBlur,
    bgImageOpacity,
    bgImageFit,
    hideMockup,
    mockupZoom,
    mockupOffsetX,
    mockupOffsetY,
    imageZoom,
    imageOffsetX,
    imageOffsetY,
  }), [
    textDocument, gradient.id, selectedPreset, imageSrc, imageName, windowTheme, windowTitle,
    padding, roundedCorners, shadowLevel, shadowOpacity, activeCuratedLayout,
    cornerStyle, layoutPreset, aspectRatio.id, customCanvasSize, secondarySrc, secondaryName,
    layoutMode, duoLayout, bgType, solidColor, isCustomGradient,
    customGradColor1, customGradColor2, customGradAngle, selectedPattern,
    vfxNoise, vfxNoiseOpacity, vfxGlow, vfxGlowColor, vfxGlowOpacity,
    customBrandWatermark, logoDataUrl, logoPos, logoScale, logoOpacity,
    qrUrl, qrPos, qrScale, bgImageSrc, bgImageBlur, bgImageOpacity, bgImageFit,
    hideMockup, mockupZoom, mockupOffsetX, mockupOffsetY, imageZoom, imageOffsetX, imageOffsetY,
  ]);

  const handleRestoreSnapshot = useCallback((snap: EditorSnapshot) => {
    setTextDocument(snap.textDocument ?? emptyTextDocument());
    if (snap.gradientId) setGradient(GRADIENTS.find(g => g.id === snap.gradientId) ?? GRADIENTS[0]);
    setSelectedPreset(snap.selectedPreset);
    setImageSrc(snap.imageSrc);
    setImageName(snap.imageName);
    setWindowTheme(snap.windowTheme);
    setWindowTitle(snap.windowTitle);
    setPadding(snap.padding);
    setRoundedCorners(snap.roundedCorners);
    setShadowLevel(snap.shadowLevel as any);
    setShadowOpacity(snap.shadowOpacity);
    setActiveCuratedLayout(snap.activeCuratedLayout);
    setCornerStyle(snap.cornerStyle);
    setLayoutPreset(snap.layoutPreset);
    const restoredSize = snap.customCanvasSize || { width: 1500, height: 900 };
    setCustomCanvasSize(restoredSize);
    const asp = snap.aspectRatioId === 'custom' ? customAspect(restoredSize) : ASPECT_RATIOS.find((a) => a.id === snap.aspectRatioId) || ASPECT_RATIOS[0];
    setAspectRatio(asp);
    setSecondarySrc(snap.secondarySrc);
    setSecondaryName(snap.secondaryName);
    setLayoutMode(snap.layoutMode);
    setDuoLayout(snap.duoLayout);
    setBgType(snap.bgType as any);
    setSolidColor(snap.solidColor);
    setIsCustomGradient(snap.isCustomGradient);
    setCustomGradColor1(snap.customGradColor1);
    setCustomGradColor2(snap.customGradColor2);
    setCustomGradAngle(snap.customGradAngle);
    setSelectedPattern(snap.selectedPattern as any);
    setVfxNoise(snap.vfxNoise);
    setVfxNoiseOpacity(snap.vfxNoiseOpacity);
    setVfxGlow(snap.vfxGlow);
    setVfxGlowColor(snap.vfxGlowColor);
    setVfxGlowOpacity(snap.vfxGlowOpacity);
    setCustomBrandWatermark(snap.customBrandWatermark);
    setLogoDataUrl(snap.logoDataUrl);
    setLogoPos(snap.logoPos as any);
    setLogoScale(snap.logoScale);
    setLogoOpacity(snap.logoOpacity);
    setQrUrl(snap.qrUrl);
    setQrPos(snap.qrPos as any);
    setQrScale(snap.qrScale);
    setBgImageSrc(snap.bgImageSrc);
    setBgImageBlur(snap.bgImageBlur);
    setBgImageOpacity(snap.bgImageOpacity);
    setBgImageFit(snap.bgImageFit);
    setHideMockup(snap.hideMockup);
    setMockupZoom(snap.mockupZoom ?? 100);
    setMockupOffsetX(snap.mockupOffsetX ?? 0);
    setMockupOffsetY(snap.mockupOffsetY ?? 0);
    // Image Fit & Position 区域已隐藏，历史快照中的裁剪值一律归零，避免不可逆的"神秘裁剪"
    setImageZoom(100);
    setImageOffsetX(0);
    setImageOffsetY(0);
  }, []);

  const { canUndo, canRedo, undo, redo } = useEditorHistory(currentSnapshot, handleRestoreSnapshot);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const syncSize = () => {
      if (!canvasRef.current) return;
      const { width, height } = getCanvasRenderedDimensions(canvasRef.current);
      setCanvasDomSize((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    };

    // Immediate initial measurement
    syncSize();

    // Catch post-paint/layout adjustment
    const rafId = requestAnimationFrame(syncSize);

    const observer = new ResizeObserver(() => {
      syncSize();
    });
    observer.observe(el);

    window.addEventListener('resize', syncSize);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', syncSize);
    };
  }, [aspectRatio.id, padding, windowTheme, imageSrc, layoutPreset, cornerStyle]);

  const canonicalAutoW = naturalSceneSize.width + 2 * padding;
  const canonicalAutoH = naturalSceneSize.height + 2 * padding;
  const canvasLogicalSize = getCanonicalDimensions(
    aspectRatio.id, 1, 0, 0, canonicalAutoW, canonicalAutoH,
    customCanvasSize.width, customCanvasSize.height
  );
  const effectivePaddingX = Math.min(padding, Math.max(0, (canvasLogicalSize.width - 120) / 2));
  const effectivePaddingY = Math.min(padding, Math.max(0, (canvasLogicalSize.height - 120) / 2));
  const dynamicExportDimensions = getCanonicalDimensions(
    aspectRatio.id, exportScale, canvasDomSize.width, canvasDomSize.height,
    canonicalAutoW, canonicalAutoH, customCanvasSize.width, customCanvasSize.height
  );
  useEffect(() => {
    setDimensionDraft({ width: String(canvasLogicalSize.width), height: String(canvasLogicalSize.height) });
    setDimensionError('');
  }, [canvasLogicalSize.width, canvasLogicalSize.height, aspectRatio.id]);

  const applyCustomCanvasSize = () => {
    const width = Number(dimensionDraft.width), height = Number(dimensionDraft.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      setDimensionError('Enter a valid width and height.');
      return;
    }
    const next = { width: Math.max(200, Math.min(8000, Math.round(width))), height: Math.max(200, Math.min(8000, Math.round(height))) };
    setCustomCanvasSize(next);
    setAspectRatio(customAspect(next));
    setDimensionError('');
  };

  // A curated preset only counts as the current one while all four of its dimensions still match
  // the live state. Any manual tweak (padding / shadow / corner / angle) flips the label to "Custom".
  const activeCuratedPreset = CURATED_LAYOUT_PRESETS.find(p => p.id === activeCuratedLayout);
  const isCuratedIntact = !!activeCuratedPreset
    && activeCuratedPreset.layout === layoutPreset
    && activeCuratedPreset.padding === padding
    && activeCuratedPreset.shadow === shadowLevel
    && activeCuratedPreset.corner === cornerStyle;

  // Check saved license status on mount and handle payment return
  useEffect(() => {
    const savedKey = localStorage.getItem('devsnapkit_license_key');
    if (savedKey) {
      verifyLicenseWithServer(savedKey).then(result => {
        if (result.valid) {
          setIsProUnlocked(true);
          setPurchasedLicenseKey(savedKey);
          localStorage.setItem('devsnapkit_pro_unlocked', 'true');
        } else {
          localStorage.removeItem('devsnapkit_pro_unlocked');
          localStorage.removeItem('devsnapkit_license_key');
          setIsProUnlocked(false);
        }
      }).catch(() => {
        const saved = localStorage.getItem('devsnapkit_pro_unlocked');
        if (saved === 'true') {
          setIsProUnlocked(true);
        }
      });
    }

    // Check URL parameters for direct deep-linking & PayPal return
    const params = new URLSearchParams(window.location.search);
    if (params.get('claim') === 'true' || params.get('status') === 'success' || params.get('tx')) {
      const initialTx = params.get('tx') || '';
      if (initialTx) {
        setClaimOrderId(initialTx);
      }
      setClaimModalTab('claim');
      setShowClaimModal(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // URL parameter API (?title=...&theme=...)
    const urlTitle = params.get('title');
    const urlTheme = params.get('theme');

    if (urlTitle) {
      setWindowTitle(urlTitle);
    }
    if (urlTheme) {
      const match = GRADIENTS.find(g => g.id === urlTheme || g.name.toLowerCase() === urlTheme.toLowerCase());
      if (match) setGradient(match);
    }

    // Track page view event anonymously
    trackEvent('page_view');
  }, []);

  // Track Pro Modal impressions
  useEffect(() => {
    if (showProModal) {
      trackEvent('pro_modal_open');
    }
  }, [showProModal]);

  // Debounced QR code generation using qrcode library
  useEffect(() => {
    if (!qrUrl.trim()) {
      setQrDataUrl(null);
      return;
    }

    const timer = setTimeout(async () => {
      let targetUrl = qrUrl.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
      }

      try {
        const QRCode = (await import('qrcode')).default;
        const dataUrl = await QRCode.toDataURL(targetUrl, {
          margin: 1,
          width: 512,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error('QR code generation error:', err);
        setQrDataUrl(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [qrUrl]);

  // Dynamically load PayPal JavaScript SDK using client ID from server config
  useEffect(() => {
    let isMounted = true;
    fetch('/api/paypal-config')
      .then(res => res.json())
      .then(config => {
        if (!isMounted || !config.clientId) return;
        const scriptId = 'paypal-sdk-script';
        if (!document.getElementById(scriptId)) {
          const script = document.createElement('script');
          script.id = scriptId;
          script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.clientId)}&currency=USD&components=buttons`;
          script.async = true;
          document.body.appendChild(script);
        }
      })
      .catch(err => console.error('Failed to load PayPal config:', err));

    return () => { isMounted = false; };
  }, []);

  // Render PayPal Smart Payment Buttons inside Pro Modal
  useEffect(() => {
    if (!showProModal || !paypalContainerRef.current) return;

    paypalContainerRef.current.innerHTML = '';

    const renderButtons = () => {
      if ((window as any).paypal && paypalContainerRef.current) {
        try {
          (window as any).paypal.Buttons({
            style: {
              layout: 'vertical',
              color: 'gold',
              shape: 'rect',
              label: 'pay',
              height: 44,
            },
            createOrder: async () => {
              trackEvent('checkout_click');
              const res = await fetch('/api/paypal-create-order', { method: 'POST' });
              const data = await res.json();
              if (!data.id) throw new Error(data.error || 'Failed to initialize PayPal order');
              return data.id;
            },
            onApprove: async (data: any) => {
              setIsCapturingPayment(true);
              try {
                const res = await fetch('/api/paypal-capture-order', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: data.orderID })
                });
                const result = await res.json();
                if (result.success && result.licenseKey) {
                  setPurchasedLicenseKey(result.licenseKey);
                  setIsProUnlocked(true);
                  localStorage.setItem('devsnapkit_pro_unlocked', 'true');
                  localStorage.setItem('devsnapkit_license_key', result.licenseKey);
                  setShowProModal(false);
                  setShowSuccessModal(true);
                } else {
                  alert(result.error || 'Payment capture failed. Please contact support@devsnapkit.com');
                }
              } catch (err: any) {
                alert('Payment capture error: ' + err.message);
              } finally {
                setIsCapturingPayment(false);
              }
            },
            onError: (err: any) => {
              console.error('PayPal SDK Checkout Error:', err);
            }
          }).render(paypalContainerRef.current);
        } catch (e) {
          console.error('Failed to render PayPal Buttons:', e);
        }
      }
    };

    if ((window as any).paypal) {
      renderButtons();
    } else {
      const timer = setInterval(() => {
        if ((window as any).paypal) {
          clearInterval(timer);
          renderButtons();
        }
      }, 300);
      return () => clearInterval(timer);
    }
  }, [showProModal]);

  // Theme list
  const filteredGradients = GRADIENTS;

  // Helper to load image data URL and auto-detect portrait mobile screenshot
  const applyLoadedImage = (dataUrl: string, fileName: string) => {
    setImageSrc(dataUrl);
    setImageName(fileName);
    const img = new Image();
    img.onload = () => {
      setImageNaturalSize({ width: img.naturalWidth || 820, height: img.naturalHeight || 480 });
      // Auto-detect mobile screenshot: if height exceeds width by 15%, auto-select iPhone 17 frame
      if (img.naturalHeight > img.naturalWidth * 1.15) {
        setWindowTheme('iphone-17');
      }
    };
    img.src = dataUrl;
  };

  // Handle Image Upload
  const handleSecondaryFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const isInitialAdd = !secondarySrc;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSecondarySrc(event.target.result as string);
          setSecondaryName(file.name);
          trackEvent(isInitialAdd ? 'media_slot_add' : 'media_slot_replace', {
            slot: 2,
            size: file.size,
            type: file.type,
          });
        }
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleSecondaryDrop = (e: React.DragEvent) => {
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const isInitialAdd = !secondarySrc;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSecondarySrc(event.target.result as string);
          setSecondaryName(file.name);
          trackEvent(isInitialAdd ? 'media_slot_add' : 'media_slot_replace', {
            slot: 2,
            size: file.size,
            type: file.type,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        if (e.target) e.target.value = '';
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        alert('File size exceeds 15MB limit.');
        return;
      }
      trackEvent('upload_image', { name: file.name, size: file.size, type: file.type, method: 'file_picker' });
      if (layoutMode === 'duo') {
        trackEvent('media_slot_replace', { slot: 1, size: file.size, type: file.type });
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          applyLoadedImage(event.target.result as string, file.name);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Drag and Drop Image Handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      trackEvent('upload_image', { name: file.name, size: file.size, type: file.type, method: 'drag_drop' });
      if (layoutMode === 'duo') {
        trackEvent('media_slot_replace', { slot: 1, size: file.size, type: file.type });
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          applyLoadedImage(event.target.result as string, file.name);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Global Clipboard Paste Support (Shots.so style: press Ctrl+V anywhere)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (studioMode !== 'mockup') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            trackEvent('upload_image', { name: 'clipboard', size: file.size, method: 'paste' });
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                if (layoutMode === 'duo' && !secondarySrc) {
                  setSecondarySrc(event.target.result as string);
                  setSecondaryName('pasted-screenshot-2.png');
                  trackEvent('media_slot_add', { slot: 2, size: file.size, type: file.type });
                } else {
                  applyLoadedImage(event.target.result as string, 'pasted-screenshot.png');
                  if (layoutMode === 'duo') {
                    trackEvent('media_slot_replace', { slot: 1, size: file.size, type: file.type });
                  }
                }
              }
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [layoutMode, secondarySrc, studioMode]);

  // Handle Custom Background Image Upload (F3)
  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDimension = 2560;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
          const offscreenCanvas = document.createElement('canvas');
          offscreenCanvas.width = width;
          offscreenCanvas.height = height;
          const ctx = offscreenCanvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            const compressed = offscreenCanvas.toDataURL(mime, 0.92);
            setBgImageSrc(compressed);
            setBgType('image');
            trackEvent('bg_image_upload', { size: compressed.length });
            return;
          }
        }
        setBgImageSrc(rawDataUrl);
        setBgType('image');
        trackEvent('bg_image_upload', { size: rawDataUrl.length });
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  // Handle Custom Brand Logo Upload with Client-Side Smart Compression (Canvas)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isProUnlocked) {
      setShowProModal(true);
      if (e.target) e.target.value = '';
      return;
    }

    setLogoError('');

    // Check MIME type or file extension
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|svg|webp)$/i.test(file.name);
    if (!isImage) {
      setLogoError('Please select a valid image file (PNG, SVG, JPG, WebP).');
      if (e.target) e.target.value = '';
      return;
    }

    // Limit maximum raw file size to 5 MB
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Logo file exceeds 5 MB. Please choose an image under 5 MB.');
      if (e.target) e.target.value = '';
      return;
    }

    setIsProcessingLogo(true);
    trackEvent('upload_logo', { name: file.name, size: file.size });

    // If SVG, read directly as data URL
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoDataUrl(event.target.result as string);
        }
        setIsProcessingLogo(false);
      };
      reader.onerror = () => {
        setLogoError('Failed to read SVG file.');
        setIsProcessingLogo(false);
      };
      reader.readAsDataURL(file);
      if (e.target) e.target.value = '';
      return;
    }

    // For raster images (PNG, JPEG, WebP): auto-compress onto offscreen canvas if large
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) {
        setIsProcessingLogo(false);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxDimension = 600;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = width;
        offscreenCanvas.height = height;
        const ctx = offscreenCanvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = offscreenCanvas.toDataURL('image/png', 0.95);
          setLogoDataUrl(compressedDataUrl);
        } else {
          setLogoDataUrl(rawDataUrl);
        }
        setIsProcessingLogo(false);
      };

      img.onerror = () => {
        setLogoError('Could not process this image format. Try a transparent PNG.');
        setIsProcessingLogo(false);
      };

      img.src = rawDataUrl;
    };

    reader.onerror = () => {
      setLogoError('Failed to read image file.');
      setIsProcessingLogo(false);
    };

    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  // Core single canvas export helper that returns an authentic image Blob
  const exportSingleCanvasBlob = async (
    targetAspect: AspectOption,
    scale: number,
    format: 'png' | 'webp' | 'jpeg'
  ): Promise<Blob | null> => {
    if (!canvasRef.current) return null;
    const canvasEl = canvasRef.current;
    canvasEl.setAttribute('data-exporting', 'true');

    try {
      const { width: domWidth, height: domHeight } = getCanvasRenderedDimensions(canvasEl);

      const { width: targetWidth, height: targetHeight } = getCanonicalDimensions(
        targetAspect.id,
        scale,
        domWidth,
        domHeight,
        canonicalAutoW,
        canonicalAutoH,
        customCanvasSize.width,
        customCanvasSize.height
      );

      const computedRatio = targetWidth / domWidth;
      const isTransparent = bgType === 'transparent';
      const rawCanvas = await toCanvas(canvasEl, {
        width: domWidth,
        height: domHeight,
        style: { transform: 'none', transformOrigin: 'top left' },
        pixelRatio: computedRatio,
        skipFonts: true,
        cacheBust: false,
        backgroundColor: isTransparent ? 'rgba(0,0,0,0)' : undefined,
        filter: (node: HTMLElement) => {
          if (node instanceof HTMLElement) {
            if (
              node.getAttribute('data-export-ignore') === 'true' ||
              node.classList?.contains('media-hover-overlay') ||
              node.closest?.('[data-export-ignore="true"]')
            ) {
              return false;
            }
          }
          return true;
        },
      });

      const outCanvas = document.createElement('canvas');
      outCanvas.width = targetWidth;
      outCanvas.height = targetHeight;
      const ctx = outCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not initialize 2D canvas context');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (format === 'jpeg' && isTransparent) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      ctx.drawImage(rawCanvas, 0, 0, targetWidth, targetHeight);

      let mimeType = 'image/png';
      let quality = 0.98;
      if (format === 'webp') {
        mimeType = 'image/webp';
        quality = 0.92;
      } else if (format === 'jpeg') {
        mimeType = 'image/jpeg';
        quality = 0.92;
      }

      return new Promise<Blob | null>((resolve) => {
        outCanvas.toBlob((blob) => resolve(blob), mimeType, quality);
      });
    } finally {
      canvasEl.removeAttribute('data-exporting');
    }
  };

  // Download High-Resolution Image (Supports Canonical 1x, 2x, 4K and Genuine PNG, WebP, JPEG)
  const handleDownload = async () => {
    if (!canvasRef.current) return;

    if (showClaimModal) setShowClaimModal(false);
    if (showSuccessModal) setShowSuccessModal(false);

    // Check Pro requirements for 4K
    if (exportScale === 4 && !isProUnlocked) {
      setShowProModal(true);
      return;
    }
    if (showProModal) setShowProModal(false);

    setIsExporting(true);

    try {
      const filename = `devsnap-${Date.now()}.${exportFormat}`;
      const blob = await exportSingleCanvasBlob(aspectRatio, exportScale, exportFormat);
      if (blob) {
        trackEvent('export_image', { format: exportFormat, scale: exportScale, aspect: aspectRatio.id });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = downloadUrl;
        link.click();
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
      } else {
        alert('Failed to generate image blob.');
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Batch Multi-Size Sequential Export (Pro Feature)
  const handleBatchExport = async () => {
    if (!isProUnlocked) {
      setShowProModal(true);
      return;
    }
    if (selectedBatchAspects.length === 0) {
      alert('Please select at least one aspect ratio to export.');
      return;
    }

    setIsExporting(true);
    const originalAspect = aspectRatio;
    const total = selectedBatchAspects.length;

    try {
      for (let i = 0; i < total; i++) {
        const aspectId = selectedBatchAspects[i];
        const targetOption = aspectOptions.find((a) => a.id === aspectId) || ASPECT_RATIOS[0];
        setAspectRatio(targetOption);
        setBatchProgress({ current: i + 1, total });

        // Wait 2 animation frames + 80ms buffer for layout to settle
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 80))));

        const filename = `devsnap-${aspectId}-${Date.now()}.${exportFormat}`;
        const blob = await exportSingleCanvasBlob(targetOption, exportScale, exportFormat);
        if (blob) {
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = filename;
          link.href = downloadUrl;
          link.click();
          setTimeout(() => URL.revokeObjectURL(downloadUrl), 8000);
        }

        // 450ms throttle buffer between downloads to prevent browser dropping consecutive downloads
        await new Promise((r) => setTimeout(r, 450));
      }
    } catch (err) {
      console.error('Batch export failed:', err);
      alert('Batch export encountered an issue.');
    } finally {
      setAspectRatio(originalAspect);
      setIsExporting(false);
      setBatchProgress(null);
    }
  };

  // Copy 2x HD Image to Clipboard
  const handleCopyClipboard = async () => {
    if (!canvasRef.current) return;
    if (showClaimModal) setShowClaimModal(false);
    if (showSuccessModal) setShowSuccessModal(false);
    if (showProModal) setShowProModal(false);
    setIsExporting(true);

    try {
      const blob = await exportSingleCanvasBlob(aspectRatio, 2, 'png');
      if (blob && navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({ 'image/png': blob })
        ]);
        trackEvent('copy_image');
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        alert('Direct clipboard copying is not supported in this browser. Please use Export.');
      }
    } catch (err) {
      console.error('Clipboard copy error:', err);
      alert('Could not copy image to clipboard.');
    } finally {
      setIsExporting(false);
    }
  };

  // Activate Pro License via Server Verification
  const handleActivatePro = async () => {
    if (!proLicenseInput) {
      setLicenseError('Please enter a license key.');
      return;
    }

    setIsVerifyingKey(true);
    setLicenseError('');

    try {
      const result = await verifyLicenseWithServer(proLicenseInput);
      if (result.valid) {
        setIsProUnlocked(true);
        const cleanKey = proLicenseInput.trim().toUpperCase();
        setPurchasedLicenseKey(cleanKey);
        localStorage.setItem('devsnapkit_pro_unlocked', 'true');
        localStorage.setItem('devsnapkit_license_key', cleanKey);
        setShowProModal(false);
        setShowClaimModal(false);
        alert('License Key Verified! DevSnapKit Pro Lifetime Pass has been activated.');
      } else {
        setLicenseError(result.reason || 'Invalid license key. Format: DSK-XXXX-XXXX-XXXX.');
      }
    } catch (err: any) {
      setLicenseError('Verification failed. Please check network connection.');
    } finally {
      setIsVerifyingKey(false);
    }
  };

  // Claim Pro License via PayPal order proof
  const handleClaimLicense = async () => {
    if (!claimOrderId.trim()) {
      setClaimError('Please provide your PayPal Order ID or Transaction ID. Email alone cannot retrieve a license.');
      return;
    }

    setIsClaiming(true);
    setClaimError('');

    try {
      const result = await claimLicenseViaApi(claimOrderId.trim());
      if (result.success && result.licenseKey) {
        setPurchasedLicenseKey(result.licenseKey);
        setIsProUnlocked(true);
        localStorage.setItem('devsnapkit_pro_unlocked', 'true');
        localStorage.setItem('devsnapkit_license_key', result.licenseKey);
        setShowClaimModal(false);
        setShowSuccessModal(true);
      } else {
        setClaimError(result.error || 'Could not verify purchase. Please check your transaction details.');
      }
    } catch (err: any) {
      setClaimError(err.message || 'Error communicating with verification server.');
    } finally {
      setIsClaiming(false);
    }
  };

  // Handle Reset to Default Studio Styling
  const handleReset = () => {
    setPadding(88);
    setAspectRatio(ASPECT_RATIOS[0]);
    setCustomCanvasSize({ width: 1500, height: 900 });
    setDimensionError('');
    setRoundedCorners(14);
    setShadowLevel('dramatic');
    setShadowOpacity(75);
    setWindowTheme('none');
    setCornerStyle('default');
    setLayoutPreset('flat');
    setActiveCuratedLayout('center-hero');
    setBgType('gradient');
    setIsCustomGradient(false);
    setSolidColor('#0b0f19');
    setGradient(GRADIENTS[0]);
    setVfxNoise(false);
    setVfxGlow(true);
    setVfxGlowColor('#6366f1');
    setVfxGlowOpacity(30);
    setExportScale(2);
    setExportFormat('png');
    setSecondarySrc(null);
    setSecondaryName('');
    setLayoutMode('single');
    setDuoLayout('side');
    // New states sync (Rule 7 §1)
    setHideMockup(false);
    setBgImageSrc(null);
    setBgImageBlur(0);
    setBgImageOpacity(100);
    setBgImageFit('cover');
    setMockupZoom(100);
    setMockupOffsetX(0);
    setMockupOffsetY(0);
    setImageZoom(100);
    setImageOffsetX(0);
    setImageOffsetY(0);
  };

  // Keyboard Shortcuts Listener (F2)
  useEffect(() => {
    const isEditable = (el: EventTarget | null) =>
      el instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || (el as HTMLElement)?.isContentEditable);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (studioMode !== 'mockup') return;
      if (isEditable(e.target)) return;

      if (e.key === 'Escape') {
        setShowShortcutsModal(false);
        setShowExportMenu(false);
        setShowDemoTemplatesMenu(false);
        return;
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl) {
        if (!e.shiftKey && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          undo();
          trackEvent('undo_action', { trigger: 'keyboard' });
          return;
        }
        if ((e.shiftKey && e.key.toLowerCase() === 'z') || (!e.shiftKey && e.key.toLowerCase() === 'y')) {
          e.preventDefault();
          redo();
          trackEvent('redo_action', { trigger: 'keyboard' });
          return;
        }
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleDownload();
          return;
        }
      } else {
        if (e.key === '1') {
          setLayoutMode('single');
          trackEvent('layout_mode_change', { mode: 'single', trigger: 'shortcut' });
          return;
        }
        if (e.key === '2') {
          setLayoutMode('duo');
          trackEvent('layout_mode_change', { mode: 'duo', trigger: 'shortcut' });
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (layoutMode === 'duo') {
            setSecondarySrc(null);
            setSecondaryName('');
            setLayoutMode('single');
            trackEvent('layout_mode_change', { mode: 'single', trigger: 'shortcut' });
            return;
          }
        }
        if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
          setShowShortcutsModal(prev => !prev);
          return;
        }
        if (e.key === 'Escape') {
          setShowShortcutsModal(false);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleDownload, layoutMode, secondarySrc, showExportMenu, showDemoTemplatesMenu, studioMode]);

  // Handle Starter Preset Template Application
  const handleApplyPreset = (preset: typeof MOCKUP_PRESETS[0]) => {
    setSelectedPreset(preset.id);
    setImageSrc(preset.svgDataUri);
    setImageName(preset.id + '.svg');
    setWindowTitle(preset.title);
    if (preset.id === 'mobile') {
      setWindowTheme('iphone-17');
      setImageNaturalSize({ width: 393, height: 852 });
    } else if (preset.id === 'code') {
      setWindowTheme('mac-dark');
      setImageNaturalSize({ width: 800, height: 480 });
    } else if (preset.id === 'saas') {
      setWindowTheme('none');
      setImageNaturalSize({ width: 860, height: 520 });
    } else {
      setWindowTheme('none');
      setImageNaturalSize({ width: 820, height: 480 });
    }
    trackEvent('preset_change', { preset: preset.id, name: preset.name });
  };

  // Handle Random Background Palette Shuffle (Pro-aware)
  const handleShuffleTheme = () => {
    // Non-pro users can ONLY pick from free gradients (!g.isPro)
    const pool = isProUnlocked 
      ? GRADIENTS 
      : GRADIENTS.filter((g) => !g.isPro);

    if (pool.length === 0) return;

    // Pick a different gradient from current if possible
    const candidates = pool.length > 1
      ? pool.filter((g) => g.id !== gradient.id)
      : pool;

    const randomIdx = Math.floor(Math.random() * candidates.length);
    const chosen = candidates[randomIdx];
    setBgType('gradient');
    setIsCustomGradient(false);
    setGradient(chosen);
    trackEvent('theme_change', { theme: chosen.id, isShuffle: true });
  };

const isPhoneTheme = windowTheme === 'iphone-17' || windowTheme === 'phone-clay';

  const renderEmptySlot2 = (customAspect?: string) => (
    <div 
      onClick={() => secondaryFileInputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsSlot2Dragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsSlot2Dragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsSlot2Dragging(false);
        handleSecondaryDrop(e);
      }}
      className={`w-full ${customAspect || (isPhoneTheme ? 'h-full aspect-[393/852]' : 'aspect-[16/10]')} rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center select-none group ${
        isSlot2Dragging
          ? 'border-indigo-400 bg-indigo-500/10 scale-[1.02]'
          : 'border-white/20 bg-white/[0.03] hover:border-white/40 hover:bg-white/[0.06]'
      }`}
      title="Click, drop or Ctrl+V to add second screenshot"
    >
      <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 group-hover:scale-110 group-hover:bg-indigo-500/20 group-hover:text-white transition-all shadow-lg mb-3">
        <Plus className="w-6 h-6" />
      </div>
      <div className="text-sm font-semibold text-white/90 mb-1">Drop or Paste</div>
      <div className="text-[11px] text-white/50">Images &amp; Screenshots</div>
    </div>
  );

  return (
    <div className={`min-h-screen ${themeMode === 'light' ? 'theme-light bg-slate-50 text-slate-900' : 'theme-dark bg-slate-950 text-slate-100'} flex flex-col font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-200`}>
      
      {/* Top Navbar (Edge-to-Edge Desktop Studio Header) */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between gap-4 relative">
          
          {/* Left: Brand */}
          <div className="flex items-center gap-3 shrink-0 z-10">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 p-1.5 shadow-md flex items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 opacity-80 group-hover:opacity-100 transition-opacity" />
              <svg className="w-full h-full relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="5" stroke="#6366F1" strokeWidth="2" />
                <rect x="8" y="8" width="8" height="8" rx="2" fill="#06B6D4" />
                <path d="M2 7V4H5" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M19 4H22V7" stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M22 17V20H19" stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M5 20H2V17" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white whitespace-nowrap">
                DevSnap<span className="text-cyan-400">Kit</span>
              </span>
              <span className="text-[11px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-400 border border-slate-700/60 whitespace-nowrap">
                Studio
              </span>
            </div>
          </div>

          {/* Right: Actions (Theme Toggle & Subscription/License Combo) */}
          <div className="flex items-center gap-2 shrink-0 z-10">
            {/* Subscription & License Combo Pill */}
            {!isProUnlocked ? (
              <div className="h-8 inline-flex items-center rounded-lg border border-amber-500/35 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 dark:from-amber-500/15 dark:to-orange-500/15 shadow-xs overflow-hidden transition-all hover:border-amber-500/50">
                {/* Pro CTA Segment */}
                <button
                  type="button"
                  onClick={() => setShowProModal(true)}
                  className="h-full px-2.5 flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 hover:bg-amber-500/10 transition-colors cursor-pointer active:scale-[0.98]"
                  title="Upgrade to Pro for $1"
                >
                  <Zap className="w-3.5 h-3.5 fill-amber-500 dark:fill-amber-300 text-amber-500 dark:text-amber-300" />
                  <span>Pro ($1)</span>
                </button>

                {/* Hairline Divider inside combo */}
                <div className="h-3.5 w-[1px] bg-amber-500/30 shrink-0" />

                {/* Key / License Segment */}
                <button
                  type="button"
                  onClick={() => { setClaimModalTab('key'); setShowClaimModal(true); }}
                  className="h-full px-2 sm:px-2.5 flex items-center gap-1 text-xs font-medium text-amber-800/80 dark:text-amber-300/80 hover:text-amber-950 dark:hover:text-amber-100 hover:bg-amber-500/10 transition-colors cursor-pointer active:scale-[0.98]"
                  title="Activate or Redeem License Key"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Key</span>
                </button>
              </div>
            ) : (
              <div className="h-8 inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 shadow-xs overflow-hidden">
                <div className="h-full px-2.5 flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>PRO</span>
                </div>
                <div className="h-3.5 w-[1px] bg-emerald-500/30 shrink-0" />
                <button
                  type="button"
                  onClick={() => { setClaimModalTab('key'); setShowClaimModal(true); }}
                  className="h-full px-2 flex items-center gap-1 text-xs font-medium text-emerald-700/80 dark:text-emerald-300/80 hover:text-emerald-900 dark:hover:text-emerald-100 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                  title="Manage License Key"
                >
                  <KeyRound className="w-3 h-3" />
                  <span className="hidden sm:inline">Key</span>
                </button>
              </div>
            )}

            {/* Subtle Divider */}
            <div className="h-4 w-[1px] bg-slate-200 dark:bg-white/10 mx-0.5 hidden sm:block" />

            {/* Theme Toggle Button (Light / Dark) - Minimalist Icon Button */}
            <button
              type="button"
              onClick={() => {
                const nextTheme = themeMode === 'light' ? 'dark' : 'light';
                setThemeMode(nextTheme);
                trackEvent('theme_mode_toggle', { mode: nextTheme });
              }}
              className="h-8 w-8 rounded-lg border border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-xs active:scale-[0.98]"
              title={themeMode === 'light' ? 'Switch to Dark theme' : 'Switch to Light theme'}
              aria-label={themeMode === 'light' ? 'Switch to Dark theme' : 'Switch to Light theme'}
            >
              {themeMode === 'light' ? (
                <Moon className="w-4 h-4 text-slate-700" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>
          </div>

        </div>
      </header>

      <nav aria-label="Studio mode" className="flex justify-center gap-2 p-2 border-b border-slate-700">
        <button type="button" disabled={posterExporting} aria-pressed={studioMode === 'mockup'} onClick={() => setStudioMode('mockup')} className="px-4 py-2 rounded-lg border border-slate-400 text-sm">Mockup</button>
        <button type="button" disabled={posterExporting} aria-pressed={studioMode === 'poster'} onClick={() => setStudioMode('poster')} className="px-4 py-2 rounded-lg border border-slate-400 text-sm">Poster</button>
      </nav>
      <div hidden={studioMode !== 'poster'}>
        <PosterEditor active={studioMode === 'poster'} isProUnlocked={isProUnlocked} onRequestPro={() => setShowProModal(true)} onExportingChange={setPosterExporting} />
      </div>
      <div hidden={studioMode !== 'mockup'}>
      {/* Main Studio Workspace - Edge-to-Edge Shots.so Layout */}
      <main className="flex-1 w-full flex flex-col lg:flex-row lg:h-[calc(100vh-64px)] lg:overflow-hidden bg-[#08090d]">
        
        {/* Left: Expansive Studio Canvas Viewport */}
        <section 
          onDrop={(e) => {
            setIsDraggingFile(false);
            handleDrop(e);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setIsDraggingFile(false);
          }}
          className="studio-canvas-viewport flex-1 min-w-0 flex flex-col items-center pt-2 pb-2 px-2 sm:px-6 lg:px-8 relative overflow-hidden studio-canvas-grid select-none"
        >
          {/* Drag Overlay Hint */}
          {isDraggingFile && (
            <div className="absolute inset-0 z-50 bg-indigo-950/85 backdrop-blur-md border-2 border-dashed border-indigo-400 flex flex-col items-center justify-center pointer-events-none transition-all">
              <Upload className="w-12 h-12 text-indigo-300 mb-3 animate-bounce" />
              <p className="text-base font-bold text-white tracking-wide">Drop screenshot here to load instantly</p>
              <p className="text-xs text-indigo-300/80 mt-1">PNG, JPG, WebP, SVG • 100% Client-side In-Browser Processing</p>
            </div>
          )}


          
          {/* Top Canvas Action Bar: History & Shortcuts (F1/F2) */}
          <div className="shrink-0 mb-1 flex items-center gap-1 px-1.5 py-1 rounded-xl bg-[#0c0d14]/85 backdrop-blur-xl border border-white/10 shadow-lg z-20">
            {/* Undo Button (F1) */}
            <button
              type="button"
              onClick={() => {
                undo();
                trackEvent('undo_action', { trigger: 'canvas_toolbar' });
              }}
              disabled={!canUndo}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs ${
                canUndo
                  ? 'text-slate-300 hover:text-white hover:bg-white/10'
                  : 'text-slate-600 opacity-40 cursor-not-allowed'
              }`}
              title="Undo (Ctrl+Z / ⌘Z)"
            >
              <Undo2 className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px] font-medium pr-0.5">Undo</span>
            </button>

            {/* Redo Button (F1) */}
            <button
              type="button"
              onClick={() => {
                redo();
                trackEvent('redo_action', { trigger: 'canvas_toolbar' });
              }}
              disabled={!canRedo}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs ${
                canRedo
                  ? 'text-slate-300 hover:text-white hover:bg-white/10'
                  : 'text-slate-600 opacity-40 cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Shift+Z / ⇧⌘Z)"
            >
              <Redo2 className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px] font-medium pr-0.5">Redo</span>
            </button>

            <div className="h-3.5 w-[1px] bg-white/10 mx-0.5" />

            {/* Keyboard Shortcuts Button (F2) */}
            <button
              type="button"
              onClick={() => setShowShortcutsModal(true)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1 text-xs"
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px] font-medium pr-0.5">Shortcuts</span>
              <kbd className="hidden sm:inline text-[11px] text-white/80 font-mono bg-white/10 border border-white/20 px-1 rounded">?</kbd>
            </button>

            <div className="h-3.5 w-[1px] bg-white/10 mx-0.5" />

            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopyClipboard}
              disabled={isExporting}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1 text-xs"
              title="Copy 2x Retina image directly to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline text-[11px] font-medium pr-0.5">{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <div className="h-3.5 w-[1px] bg-white/10 mx-0.5" />

            {/* Download / Export Button with Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className={`export-trigger-btn p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs ${
                  showExportMenu
                    ? 'text-white bg-white/15'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                title="Download image with export options"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px] font-medium pr-0.5">Download</span>
              </button>

              {/* Export Popover Layer */}
              {showExportMenu && (
                <>
                  {/* Backdrop click-outside dismisser */}
                  <div
                    className="fixed inset-0 z-40 bg-black/15 backdrop-blur-[0.5px]"
                    onClick={() => setShowExportMenu(false)}
                  />

                  <div className="export-popover absolute left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 top-full mt-2 w-72 bg-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-2xl z-50 space-y-3.5">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Export Settings</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowExportMenu(false)}
                        className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Close"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Resolution Scale */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-300">Resolution</label>
                        <span className="text-[11px] text-indigo-300 font-mono font-bold bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-700/50">
                          {dynamicExportDimensions.width} × {dynamicExportDimensions.height}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { scale: 1, label: '1x Web' },
                          { scale: 2, label: '2x HD' },
                          { scale: 4, label: '4K Ultra', isPro: true },
                        ].map((res) => (
                          <button
                            key={res.scale}
                            type="button"
                            onClick={() => {
                              if (res.isPro && !isProUnlocked) {
                                setShowProModal(true);
                                return;
                              }
                              setExportScale(res.scale);
                            }}
                            className={`py-1.5 px-1 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98] ${
                              exportScale === res.scale
                                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 font-bold'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span>{res.label}</span>
                            {res.isPro && !isProUnlocked && <Lock className="w-2.5 h-2.5 text-amber-400" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* File Format */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-300">Format</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['png', 'webp', 'jpeg'] as const).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => setExportFormat(fmt)}
                            className={`py-1.5 rounded-lg text-xs font-semibold uppercase border transition-all cursor-pointer active:scale-[0.98] ${
                              exportFormat === fmt
                                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Primary Action Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        handleDownload();
                      }}
                      disabled={isExporting}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                    >
                      <Download className="w-4 h-4" />
                      <span>{isExporting ? 'Exporting...' : `Download ${exportScale === 4 ? '4K' : exportScale + 'x'} (${dynamicExportDimensions.width}×${dynamicExportDimensions.height})`}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Canvas Node Captured by html-to-image */}
          <CanvasStage width={canvasLogicalSize.width} height={canvasLogicalSize.height}>
          <div 
            ref={canvasRef}
            id="studio-canvas"
            data-canvas-root="true"
            className={`absolute left-0 top-0 rounded-2xl flex flex-col items-center justify-center overflow-hidden shadow-2xl ${
              bgType === 'gradient' && !isCustomGradient
                ? gradient.className
                : bgType === 'transparent'
                ? 'bg-transparent ring-1 ring-white/10'
                : bgType === 'pattern' && selectedPattern === 'dots'
                ? 'bg-slate-950 bg-[radial-gradient(rgba(255,255,255,0.22)_1.5px,transparent_1.5px)] [background-size:24px_24px]'
                : bgType === 'pattern' && selectedPattern === 'grid'
                ? 'bg-slate-950 bg-[linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:32px_32px]'
                : bgType === 'pattern' && selectedPattern === 'spotlight'
                ? 'bg-[#0a0c14] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.35),rgba(255,255,255,0))]'
                : bgType === 'pattern' && selectedPattern === 'aurora'
                ? 'bg-[#060814] bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.4)_0%,transparent_50%),radial-gradient(circle_at_80%_80%,rgba(236,72,153,0.35)_0%,transparent_50%)]'
                : ''
            }`}
            style={{ 
              width: canvasLogicalSize.width,
              height: canvasLogicalSize.height,
              transform: 'scale(var(--canvas-preview-scale, 1))',
              transformOrigin: 'top left',
              padding: `${effectivePaddingY}px ${effectivePaddingX}px`,
              backgroundColor: bgType === 'solid' ? solidColor : undefined,
              backgroundImage: bgType === 'gradient' && isCustomGradient 
                ? `linear-gradient(${customGradAngle}deg, ${customGradColor1}, ${customGradColor2})` 
                : undefined
            }}
          >
            {/* Transparent checkerboard hint (only in transparent mode for preview) */}
            {bgType === 'transparent' && (
              <div 
                data-export-ignore="true"
                className="absolute inset-0 z-0 pointer-events-none opacity-30 bg-[radial-gradient(#475569_1.5px,transparent_1.5px)] [background-size:16px_16px]" 
              />
            )}

            {/* Custom Image Background Layer (F3) */}
            {bgType === 'image' && bgImageSrc && (
              <div 
                className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
                style={{ opacity: bgImageOpacity / 100 }}
              >
                <img 
                  src={bgImageSrc} 
                  alt="Canvas Background"
                  className="w-full h-full block" 
                  style={{ 
                    objectFit: bgImageFit, 
                    filter: bgImageBlur > 0 ? `blur(${bgImageBlur}px)` : undefined,
                    transform: bgImageBlur > 0 ? 'scale(1.06)' : undefined,
                    transformOrigin: 'center center',
                  }} 
                />
              </div>
            )}

            {/* VFX 1: Ambient Backlight Glow (Shots.so Aesthetic) */}
            {vfxGlow && bgType !== 'transparent' && (
              <div 
                className="absolute pointer-events-none rounded-full blur-[100px] transition-all duration-300 -z-0"
                style={{
                  width: '65%',
                  height: '65%',
                  backgroundColor: vfxGlowColor,
                  opacity: (vfxGlowOpacity / 100),
                  transform: 'translate(-50%, -50%)',
                  top: '50%',
                  left: '50%',
                }}
              />
            )}

            {/* VFX 2: Film Grain & Organic Noise (Shots.so Tactile Filter) */}
            {vfxNoise && (
              <div 
                className="absolute inset-0 pointer-events-none z-30 mix-blend-overlay"
                style={{
                  opacity: vfxNoiseOpacity / 100,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                }}
              />
            )}

            <FittedScene
              width={canvasLogicalSize.width} height={canvasLogicalSize.height}
              paddingX={effectivePaddingX} paddingY={effectivePaddingY}
              basisWidth={layoutMode === 'single' && isPhoneTheme ? 375 : 1024}
              zoom={mockupZoom} offsetX={mockupOffsetX} offsetY={mockupOffsetY}
              projection={layoutPreset} onNaturalSize={handleNaturalSceneSize}
            >
              <DeviceComposition
                mode={layoutMode} duoLayout={duoLayout}
                theme={windowTheme} imageSrc={imageSrc} imageName={imageName}
                onReplace={() => fileInputRef.current?.click()}
                shadowLevel={shadowLevel} shadowOpacity={shadowOpacity}
                cornerStyle={cornerStyle} roundedCorners={roundedCorners}
                windowTitle={windowTitle} hideFrame={hideMockup} zoomStyle={zoomStyle}
                secondarySrc={secondarySrc} secondaryName={secondaryName}
                onReplaceSecondary={() => secondaryFileInputRef.current?.click()}
                emptySlot={renderEmptySlot2()}
              />
            </FittedScene>

            {/* Pro Feature: Custom Brand Logo */}
            {isProUnlocked && logoDataUrl && (
              <img
                src={logoDataUrl}
                alt="Brand Logo"
                className="absolute object-contain select-none pointer-events-none transition-all z-20"
                style={{
                  [logoPos.includes('bottom') ? 'bottom' : 'top']: `${Math.max(12, Math.round(padding * 0.45))}px`,
                  [logoPos.includes('right') ? 'right' : 'left']: `${Math.max(12, Math.round(padding * 0.45))}px`,
                  height: `${logoScale}%`,
                  maxHeight: `${logoScale}%`,
                  opacity: logoOpacity,
                }}
              />
            )}

            {/* Pro Feature: Dynamic QR Code */}
            {isProUnlocked && qrDataUrl && (
              <div
                className="absolute select-none pointer-events-none transition-all z-20 flex items-center justify-center p-1 bg-white/95 backdrop-blur-md rounded-lg shadow-lg border border-white/40"
                style={{
                  [qrPos.includes('bottom') ? 'bottom' : 'top']: `${Math.max(12, Math.round(padding * 0.45))}px`,
                  [qrPos.includes('left') ? 'left' : 'right']: `${Math.max(12, Math.round(padding * 0.45))}px`,
                  height: `${qrScale}%`,
                  aspectRatio: '1/1',
                }}
              >
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Pro Feature: Custom Brand Text Badge */}
            {isProUnlocked && customBrandWatermark.trim() && (
              <div 
                className="absolute text-[11px] font-semibold text-white/90 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-md border border-white/20 select-none whitespace-nowrap shrink-0 pointer-events-none tracking-wide z-10 shadow-lg flex items-center gap-1.5"
                style={{
                  bottom: `${Math.max(10, Math.round(padding * 0.35))}px`,
                  right: `${Math.max(12, Math.round(padding * 0.45))}px`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shadow-sm" />
                <span>{customBrandWatermark.trim()}</span>
              </div>
            )}

          </div>

          {/* Floating Bottom Studio Dock */}
          </CanvasStage>
          <div className="mt-2 flex flex-nowrap items-center justify-center gap-2 z-20 shrink-0 max-w-full" style={{ flexWrap: 'wrap' }}>
            {/* 1-Image / 2-Image Mode Toggle (§5.1) */}
            <div className="flex items-center bg-black/40 border border-white/10 p-0.5 rounded-xl backdrop-blur-md shrink-0 h-9">
              <button
                type="button"
                onClick={() => {
                  setLayoutMode('single');
                  trackEvent('layout_mode_change', { mode: 'single' });
                }}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  layoutMode === 'single'
                    ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                    : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                }`}
                title="Single shot (1 image)"
              >
                <Square className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Single</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLayoutMode('duo');
                  trackEvent('layout_mode_change', { mode: 'duo' });
                }}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  layoutMode === 'duo'
                    ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                    : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                }`}
                title="Dual shots (2 images)"
              >
                <div className="flex items-center -space-x-1">
                  <Square className="w-3 h-3 opacity-80" />
                  <Square className="w-3 h-3" />
                </div>
                <span className="hidden sm:inline">Duo</span>
              </button>
            </div>

            {/* Replace Image & Starter Demo Picker */}
            <div className="relative flex items-center shrink-0 h-9">
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-semibold border-y border-l border-r-0 border-white/15 backdrop-blur-md transition-all shadow-lg hover:shadow-indigo-500/10 cursor-pointer active:scale-[0.98] h-full"
                title="Upload screenshot from computer"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>Replace Image</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDemoTemplatesMenu(!showDemoTemplatesMenu)}
                className="h-full px-2 rounded-r-xl border border-white/15 bg-white/[0.08] hover:bg-white/[0.14] text-white/70 hover:text-white transition-all cursor-pointer flex items-center justify-center"
                title="Select starter demo template"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${showDemoTemplatesMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Starter Demo Dropdown Popover */}
              {showDemoTemplatesMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDemoTemplatesMenu(false)} />
                  <div className="starter-demo-popover absolute bottom-full mb-2 left-0 w-52 bg-slate-900 border border-slate-700/80 rounded-xl p-1.5 shadow-2xl z-50 space-y-0.5 backdrop-blur-xl">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-white/40 px-2 py-1">
                      Starter Demos
                    </div>
                    {MOCKUP_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          handleApplyPreset(p);
                          setShowDemoTemplatesMenu(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                          selectedPreset === p.id && imageSrc === p.svgDataUri
                            ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/30 font-bold'
                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <span>{p.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{p.badge}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            <div className="h-4 w-[1px] bg-white/10 hidden sm:block shrink-0" />

            {/* Quick Aspect Switcher (Budgeted width for zero overflow) */}
            <div className="relative flex items-center bg-black/40 border border-white/10 p-0.5 rounded-xl backdrop-blur-md shrink-0 h-9">
              {ASPECT_RATIOS.slice(0, 4).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setAspectRatio(opt);
                    setShowDockMoreRatios(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    aspectRatio.id === opt.id
                      ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                      : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                  }`}
                  title={opt.label}
                >
                  {opt.shortLabel || opt.label}
                </button>
              ))}

              {/* More / Social Media Presets Popover (F6) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDockMoreRatios(!showDockMoreRatios)}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    aspectOptions.slice(4).some((a) => a.id === aspectRatio.id)
                      ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                      : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                  }`}
                  title="More aspect ratios & social media presets"
                >
                  <span>{aspectOptions.slice(4).find((a) => a.id === aspectRatio.id)?.shortLabel || 'More'}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showDockMoreRatios ? 'rotate-180' : ''}`} />
                </button>

                {showDockMoreRatios && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDockMoreRatios(false)} />
                    <div className="dock-more-ratios-popover absolute bottom-full mb-2 right-0 w-52 bg-slate-900 border border-slate-700/80 rounded-xl p-1.5 shadow-2xl backdrop-blur-xl z-50 space-y-0.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                        More Presets
                      </div>
                      {aspectOptions.slice(4).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setAspectRatio(opt);
                            setShowDockMoreRatios(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                            aspectRatio.id === opt.id
                              ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/30 font-bold'
                              : 'text-slate-300 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <span className="truncate">{opt.label}</span>
                          <span className="text-[11px] text-slate-400 ml-1.5 shrink-0">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <button 
              onClick={handleShuffleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white text-xs font-semibold border border-white/10 backdrop-blur-md transition-all cursor-pointer active:scale-[0.98] shrink-0 h-9"
              title="Randomize gradient & frame style"
            >
              <Shuffle className="w-3.5 h-3.5 text-amber-400" />
              <span>Shuffle</span>
            </button>
          </div>  
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <input 
              ref={secondaryFileInputRef}
              type="file" 
              accept="image/*" 
              onChange={handleSecondaryFileUpload} 
              className="hidden" 
            />
        </section>

        {/* Middle-Right: Dedicated Shots.so-Style Live 3D Perspective Rail (Desktop & Laptop) */}
        <aside className="hidden lg:flex flex-col w-[130px] xl:w-[140px] 2xl:w-[155px] shrink-0 lg:my-3 lg:mr-2 lg:rounded-2xl border border-white/[0.08] bg-[#0c0d14]/90 backdrop-blur-2xl p-2.5 space-y-2.5 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 max-h-[calc(100vh-64px-24px)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-20">
          <div className="flex items-center gap-1.5 px-1 pb-1.5 border-b border-white/[0.06]">
            <Compass className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/80 whitespace-nowrap">
              3D Angles
            </span>
          </div>
          <div className="space-y-2 flex-1">
            {LAYOUT_PRESETS.map((p) => (
              <Live3DPerspectiveCard
                key={p.id}
                presetId={p.id}
                name={p.name}
                subtitle={p.subtitle}
                imageSrc={imageSrc}
                secondarySrc={secondarySrc || undefined}
                layoutMode={layoutMode}
                duoLayout={duoLayout}
                bgType={bgType}
                gradient={gradient}
                solidColor={solidColor}
                isCustomGradient={isCustomGradient}
                customGradColor1={customGradColor1}
                customGradColor2={customGradColor2}
                customGradAngle={customGradAngle}
                selectedPattern={selectedPattern}
                isActive={layoutPreset === p.id}
                onClick={() => {
                  setLayoutPreset(p.id);
                  trackEvent('preset_change', { layout: p.id, type: 'layout' });
                }}
                layout="rail"
              />
            ))}
          </div>
        </aside>

        {/* Right: Customization Controls Panel with Segmented Inspector */}
        <aside className="studio-inspector w-full lg:w-[360px] xl:w-[380px] 2xl:w-[420px] shrink-0 lg:my-3 lg:mr-3 lg:rounded-2xl border-l lg:border border-white/[0.08] bg-[#0c0d14]/90 backdrop-blur-2xl flex flex-col lg:h-[calc(100vh-64px-24px)] p-4 sm:p-5 overflow-y-auto overflow-x-hidden space-y-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Studio Inspector</span>
            </h2>
            <button
              onClick={handleReset}
              className="text-[11px] text-white/50 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              title="Reset default styling"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* 4-Tab Segmented Control (Style, Background, Brand, Export) */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <button
              onClick={() => setSidebarTab('style')}
              className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] ${
                sidebarTab === 'style'
                  ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Frame</span>
            </button>

            <button
              onClick={() => setSidebarTab('background')}
              className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] ${
                sidebarTab === 'background'
                  ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Canvas</span>
            </button>

            <button
              onClick={() => setSidebarTab('brand')}
              className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] relative ${
                sidebarTab === 'brand'
                  ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30 shadow-sm'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Brand</span>
              {!isProUnlocked && (
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 leading-none">
                  PRO
                </span>
              )}
            </button>

            <button
              onClick={() => setSidebarTab('export')}
              className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] ${
                sidebarTab === 'export'
                  ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>

          {/* TAB 1: FRAME & 3D LAYOUT */}
          {sidebarTab === 'style' && (
            <div className="space-y-5">
              {/* §5.2 MEDIA 槽位管理区 */}
              <div className="space-y-2.5 p-3 rounded-2xl bg-white/[0.03] border border-white/10 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>MEDIA</span>
                  </label>
                  <span className="text-[11px] text-white/40 font-mono">
                    {layoutMode === 'duo' ? (secondarySrc ? '2/2 Loaded' : '1/2 Loaded') : '1/1 Loaded'}
                  </span>
                </div>

                <div className="space-y-2">
                  {/* Slot 1: Always filled */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/20 bg-black/60 shrink-0">
                        <img src={imageSrc} alt={imageName} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">Slot 1</div>
                        <div className="text-[11px] text-white/50 truncate max-w-[150px]">{imageName}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold border border-white/15 transition-all cursor-pointer shrink-0"
                      title="Open Media Picker to replace Slot 1"
                    >
                      Replace
                    </button>
                  </div>

                  {/* Quick Starter Demos */}
                  <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-between gap-1">
                    <span className="text-[11px] text-white/40 font-medium">Starter Demo:</span>
                    <div className="flex items-center gap-1">
                      {MOCKUP_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleApplyPreset(p)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                            selectedPreset === p.id && imageSrc === p.svgDataUri
                              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold'
                              : 'text-white/50 hover:text-white hover:bg-white/10 border border-transparent'
                          }`}
                          title={`Load "${p.name}" starter template`}
                        >
                          {p.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Slot 2: Shown when layoutMode === 'duo' (§5.2) */}
                  {layoutMode === 'duo' && (
                    secondarySrc ? (
                      <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/20 bg-black/60 shrink-0">
                            <img src={secondarySrc} alt={secondaryName || 'Slot 2'} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">Slot 2</div>
                            <div className="text-[11px] text-white/50 truncate max-w-[130px]">{secondaryName || 'Second Image'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => secondaryFileInputRef.current?.click()}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold border border-white/15 transition-all cursor-pointer"
                            title="Open Media Picker to replace Slot 2"
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSecondarySrc(null);
                              setSecondaryName('');
                              setLayoutMode('single');
                              trackEvent('layout_mode_change', { mode: 'single' });
                            }}
                            className="p-1 rounded-lg hover:bg-rose-500/20 text-white/40 hover:text-rose-400 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                            title="Delete Slot 2 (Return to Single)"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => secondaryFileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 border-dashed border-white/20 hover:border-indigo-400/60 bg-white/[0.02] hover:bg-indigo-500/10 text-white/60 hover:text-indigo-200 transition-all cursor-pointer group"
                        title="Add second screenshot to Slot 2"
                      >
                        <div className="w-5 h-5 rounded-full bg-white/10 group-hover:bg-indigo-500/20 flex items-center justify-center text-white/80 group-hover:text-white transition-all">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-semibold">Add Media (Slot 2)</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Dual-Image Layout Selector (Only visible in Duo mode) */}
              {layoutMode === 'duo' && (
                <div className="space-y-2 p-3 rounded-2xl bg-white/[0.03] border border-white/10 shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Duo Layouts (4)</span>
                    </label>
                    <span className="text-[11px] text-indigo-300 font-medium">
                      {duoLayout === 'side' ? 'Side by Side' : duoLayout === 'stack' ? 'Overlap Stack' : duoLayout === 'hero' ? 'Hero Split' : 'Stacked Vertical'}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 w-full min-w-0">
                    {([
                      { id: 'side', name: 'Side by Side', desc: '46% + 46% split' },
                      { id: 'stack', name: 'Overlap Stack', desc: '62% hero + 48% overlay' },
                      { id: 'hero', name: 'Hero Split', desc: '60% + 34% focus' },
                      { id: 'vertical', name: 'Stacked Vertical', desc: '80% vertical stack' },
                    ] as const).map((opt) => {
                      const isActive = duoLayout === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setDuoLayout(opt.id);
                            trackEvent('duo_layout_change', { layout: opt.id });
                          }}
                          className={`flex flex-col items-center p-1.5 rounded-xl border transition-all cursor-pointer group active:scale-[0.96] ${
                            isActive
                              ? 'bg-white/[0.12] border-white/30 text-white shadow-sm ring-1 ring-white/20'
                              : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white hover:border-white/15 hover:bg-white/[0.05]'
                          }`}
                          title={opt.desc}
                        >
                          <DuoThumbnail
                            type={opt.id}
                            gradient={gradient}
                            bgType={bgType}
                            solidColor={solidColor}
                          />
                          <span className="text-[11px] font-medium truncate w-full text-center leading-tight mt-1">
                            {opt.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mockup Zoom & Position (Shots.so Alignment: Entire Mockup Scaling & Pan) */}
              <div className="space-y-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-white/50">Mockup Zoom & Position</label>
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Camera
                    </span>
                  </div>
                  {(mockupZoom !== 100 || mockupOffsetX !== 0 || mockupOffsetY !== 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setMockupZoom(100);
                        setMockupOffsetX(0);
                        setMockupOffsetY(0);
                        trackEvent('mockup_zoom_change', { zoom: 100, offsetX: 0, offsetY: 0 });
                      }}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer font-medium"
                      title="Reset mockup zoom & position"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Mockup Zoom Slider & Number (75% to 400%) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span className="font-medium">Zoom</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="75"
                        max="400"
                        aria-label="Mockup zoom"
                        value={mockupZoom}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) setMockupZoom(Math.max(75, Math.min(400, val)));
                        }}
                        className="w-12 bg-white/[0.04] border border-white/10 rounded-md px-1.5 py-0.5 text-right font-mono text-[11px] text-white focus:outline-none focus:border-white/30"
                      />
                      <span className="text-white/40 text-[11px]">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="75"
                    max="400"
                    step="1"
                    value={mockupZoom}
                    onChange={(e) => setMockupZoom(parseInt(e.target.value))}
                    className="w-full accent-indigo-400 cursor-pointer"
                  />
                </div>

                {/* Mockup Pan X Offset */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span className="font-medium">Mockup Position X</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="-50"
                        max="50"
                        aria-label="Mockup position X"
                        value={mockupOffsetX}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) setMockupOffsetX(Math.max(-50, Math.min(50, val)));
                        }}
                        className="w-12 bg-white/[0.04] border border-white/10 rounded-md px-1.5 py-0.5 text-right font-mono text-[11px] text-white focus:outline-none focus:border-white/30"
                      />
                      <span className="text-white/40 text-[11px]">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    step="1"
                    value={mockupOffsetX}
                    onChange={(e) => setMockupOffsetX(parseInt(e.target.value))}
                    className="w-full accent-indigo-400 cursor-pointer"
                  />
                </div>

                {/* Mockup Pan Y Offset */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span className="font-medium">Mockup Position Y</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="-50"
                        max="50"
                        value={mockupOffsetY}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) setMockupOffsetY(Math.max(-50, Math.min(50, val)));
                        }}
                        className="w-12 bg-white/[0.04] border border-white/10 rounded-md px-1.5 py-0.5 text-right font-mono text-[11px] text-white focus:outline-none focus:border-white/30"
                      />
                      <span className="text-white/40 text-[11px]">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    step="1"
                    value={mockupOffsetY}
                    onChange={(e) => setMockupOffsetY(parseInt(e.target.value))}
                    className="w-full accent-indigo-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* In-Frame Image Fit & Position (Slot 1 Crop & Screen Focus) - Hidden from Studio Inspector per v1.0 spec */}
              {false && (
                <div className="space-y-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-white/50">Image Fit & Position</label>
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Slot 1 only
                      </span>
                    </div>
                    {(imageZoom !== 100 || imageOffsetX !== 0 || imageOffsetY !== 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          setImageZoom(100);
                          setImageOffsetX(0);
                          setImageOffsetY(0);
                          trackEvent('zoom_change', { zoom: 100, offsetX: 0, offsetY: 0 });
                        }}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer font-medium"
                        title="Reset image fit & position"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Image Fit Scale Slider & Number (50% to 300%) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-white/70">
                      <span className="font-medium">Fit Scale</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="50"
                          max="300"
                          value={imageZoom}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) setImageZoom(Math.max(50, Math.min(300, val)));
                          }}
                          className="w-12 bg-white/[0.04] border border-white/10 rounded-md px-1.5 py-0.5 text-right font-mono text-[11px] text-white focus:outline-none focus:border-white/30"
                        />
                        <span className="text-white/40 text-[11px]">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="300"
                      step="1"
                      value={imageZoom}
                      onChange={(e) => setImageZoom(parseInt(e.target.value))}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>

                  {/* Image Offset X */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-white/70">
                      <span className="font-medium">Crop Position X</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="-50"
                          max="50"
                          value={imageOffsetX}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) setImageOffsetX(Math.max(-50, Math.min(50, val)));
                          }}
                          className="w-12 bg-white/[0.04] border border-white/10 rounded-md px-1.5 py-0.5 text-right font-mono text-[11px] text-white focus:outline-none focus:border-white/30"
                        />
                        <span className="text-white/40 text-[11px]">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="1"
                      value={imageOffsetX}
                      onChange={(e) => setImageOffsetX(parseInt(e.target.value))}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>

                  {/* Image Offset Y */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-white/70">
                      <span className="font-medium">Crop Position Y</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="-50"
                          max="50"
                          value={imageOffsetY}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) setImageOffsetY(Math.max(-50, Math.min(50, val)));
                          }}
                          className="w-12 bg-white/[0.04] border border-white/10 rounded-md px-1.5 py-0.5 text-right font-mono text-[11px] text-white focus:outline-none focus:border-white/30"
                        />
                        <span className="text-white/40 text-[11px]">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="1"
                      value={imageOffsetY}
                      onChange={(e) => setImageOffsetY(parseInt(e.target.value))}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Curated Layout Presets (1-Click Aesthetic Compositions) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Curated Compositions ({CURATED_LAYOUT_PRESETS.length})</span>
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-white/50 capitalize font-mono">
                    Preset: {isCuratedIntact && activeCuratedPreset ? activeCuratedPreset.name : 'Custom'}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 w-full min-w-0">
                  {CURATED_LAYOUT_PRESETS.map((p) => {
                    const isActive = isCuratedIntact && activeCuratedLayout === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setActiveCuratedLayout(p.id);
                          setLayoutPreset(p.layout);
                          setCornerStyle(p.corner);
                          setPadding(p.padding);
                          setShadowLevel(p.shadow);
                          trackEvent('preset_change', { curated: p.id, type: 'curated_composition' });
                        }}
                        className={`flex flex-col items-center p-1.5 rounded-xl border transition-all cursor-pointer group active:scale-[0.97] ${
                          isActive 
                            ? 'bg-[#eef2ff] border-indigo-300 text-indigo-950 dark:bg-[#242746] dark:border-indigo-500/50 dark:text-white shadow-sm ring-1 ring-indigo-300 dark:ring-indigo-500/30' 
                            : 'bg-[#f8fafc] border-slate-200/80 text-slate-800 hover:text-slate-950 hover:bg-slate-200/60 dark:bg-[#151726] dark:border-white/[0.08] dark:text-white/80 dark:hover:text-white dark:hover:border-white/15 dark:hover:bg-[#1e2136]'
                        }`}
                        title={p.desc}
                      >
                        <CuratedThumbnail
                          id={p.id}
                          imageSrc={imageSrc}
                          secondarySrc={secondarySrc || undefined}
                          layoutMode={layoutMode}
                          duoLayout={duoLayout}
                          bgType={bgType}
                          gradient={gradient}
                          solidColor={solidColor}
                          isCustomGradient={isCustomGradient}
                          customGradColor1={customGradColor1}
                          customGradColor2={customGradColor2}
                          customGradAngle={customGradAngle}
                          selectedPattern={selectedPattern}
                        />
                        <span className={`text-[11px] font-medium truncate w-full text-center leading-tight mt-1 ${
                          isActive ? 'text-indigo-950 dark:text-white font-semibold' : 'text-slate-800 dark:text-white/80'
                        }`}>
                          {p.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3D Perspective & Angles Selector (Shown in Inspector only on smaller screens where dedicated side rail is hidden) */}
              <div className="lg:hidden space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-indigo-400" />
                    <span>3D Perspective & Angles</span>
                  </label>
                  <span className="text-[11px] text-white/40 font-mono capitalize">
                    {LAYOUT_PRESETS.find(p => p.id === layoutPreset)?.name}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2.5 w-full min-w-0">
                  {LAYOUT_PRESETS.map((p) => {
                    const isActive = layoutPreset === p.id;
                    return (
                      <Live3DPerspectiveCard
                        key={p.id}
                        presetId={p.id}
                        name={p.name}
                        subtitle={p.subtitle}
                        imageSrc={imageSrc}
                        secondarySrc={secondarySrc || undefined}
                        layoutMode={layoutMode}
                        duoLayout={duoLayout}
                        bgType={bgType}
                        gradient={gradient}
                        solidColor={solidColor}
                        isCustomGradient={isCustomGradient}
                        customGradColor1={customGradColor1}
                        customGradColor2={customGradColor2}
                        customGradAngle={customGradAngle}
                        selectedPattern={selectedPattern}
                        isActive={isActive}
                        onClick={() => {
                          setLayoutPreset(p.id);
                          trackEvent('preset_change', { layout: p.id, type: 'layout' });
                        }}
                        layout="inspector"
                      />
                    );
                  })}
                </div>
              </div>

              {/* 12 Corner & Frame Styles Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Corner & Frame Styles ({CORNER_STYLES.length})</span>
                  </label>
                  <span className="text-[11px] text-white/40 capitalize">
                    {CORNER_STYLES.find(c => c.id === cornerStyle)?.name}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {CORNER_STYLES.map((c) => {
                    const isActive = cornerStyle === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCornerStyle(c.id);
                          trackEvent('preset_change', { cornerStyle: c.id, type: 'corner' });
                        }}
                        className={`flex flex-col items-center p-1.5 rounded-xl border transition-all cursor-pointer active:scale-[0.96] group ${
                          isActive 
                            ? 'bg-white/[0.08] border-white/30 text-white shadow-sm ring-1 ring-white/20' 
                            : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:border-white/15 hover:bg-white/[0.05] hover:text-white'
                        }`}
                        title={c.name}
                      >
                        <div className="w-full aspect-[4/3] rounded-lg overflow-hidden flex items-center justify-center bg-black/60 border border-white/5 mb-1.5 group-hover:scale-105 transition-transform">
                          <CornerThumbnail style={c.id} />
                        </div>
                        <span className={`text-[11px] font-medium truncate w-full text-center leading-tight ${
                          isActive ? 'text-white' : 'text-white/60 group-hover:text-white'
                        }`}>
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mockup & Device Frame Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                    {(windowTheme === 'iphone-17' || windowTheme === 'phone-clay') ? (
                      <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                    ) : windowTheme === 'studio-display' ? (
                      <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                    ) : (
                      <Laptop className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>Mockup & Device Frame</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHideMockup(!hideMockup);
                        trackEvent('hide_mockup_toggle', { hide: !hideMockup });
                      }}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                        hideMockup 
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm' 
                          : 'bg-white/[0.04] text-white/50 border-white/10 hover:text-white hover:bg-white/[0.08]'
                      }`}
                      title="Hide mockup frame and render pure image card"
                    >
                      <EyeOff className="w-3 h-3" />
                      <span>Hide Mockup</span>
                    </button>
                    <span className="text-[11px] text-white/50 font-semibold uppercase tracking-wider">
                      {windowTheme === 'none'
                        ? 'Borderless'
                        : windowTheme === 'macbook' 
                        ? 'MacBook Pro' 
                        : windowTheme === 'studio-display' 
                        ? 'Studio Display' 
                        : windowTheme === 'iphone-17' 
                        ? 'iPhone 17 Pro' 
                        : windowTheme === 'browser' 
                        ? 'Safari Browser' 
                        : windowTheme === 'phone-clay' 
                        ? 'Clay Phone' 
                        : windowTheme}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 w-full min-w-0">
                  {[
                    { id: 'none', label: 'Borderless', icon: Square, badge: 'Default' },
                    { id: 'macbook', label: 'MacBook Pro', icon: Laptop, badge: 'Hot' },
                    { id: 'studio-display', label: 'Studio Display', icon: Monitor, badge: 'New' },
                    { id: 'iphone-17', label: 'iPhone 17 Pro', icon: Smartphone, badge: 'Popular' },
                    { id: 'browser', label: 'Safari Browser', icon: Globe, badge: '' },
                    { id: 'mac-dark', label: 'macOS Dark', icon: AppWindow, badge: '' },
                    { id: 'mac-light', label: 'macOS Light', icon: AppWindow, badge: '' },
                    { id: 'phone-clay', label: 'Clay Phone', icon: Smartphone, badge: '' },
                    { id: 'glass', label: 'Glass Window', icon: AppWindow, badge: '' },
                  ].map((style) => {
                    const IconComp = style.icon;
                    const isActive = windowTheme === style.id;
                    return (
                      <button
                        key={style.id}
                        onClick={() => {
                          setWindowTheme(style.id as any);
                          trackEvent('preset_change', { frame: style.id, type: 'device_frame' });
                        }}
                        className={`px-2.5 py-2 rounded-xl border text-xs font-medium text-left transition-all cursor-pointer active:scale-[0.98] flex items-center justify-between min-w-0 w-full ${
                          isActive 
                            ? 'bg-white/[0.08] border-white/30 text-white shadow-sm ring-1 ring-white/20' 
                            : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.05] hover:border-white/15'
                        }`}
                      >
                        <span className="truncate min-w-0 flex-1 pr-1 flex items-center gap-2">
                          <IconComp className="w-3.5 h-3.5 shrink-0 opacity-70" />
                          <span>{style.label}</span>
                        </span>
                        {style.badge && (
                          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-white/10 text-white/80 border border-white/15 shrink-0">
                            {style.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Window Title or Browser URL Input */}
              {windowTheme !== 'none' && windowTheme !== 'phone-clay' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                    {windowTheme === 'browser' ? 'Browser Address Bar URL' : windowTheme === 'iphone-17' ? 'App Label / Window Title' : 'Window Title'}
                  </label>
                  <input
                    type="text"
                    value={windowTitle}
                    onChange={(e) => setWindowTitle(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all"
                    placeholder={windowTheme === 'browser' ? 'e.g. devsnapkit.com or app.pulse.io' : 'e.g. index.tsx or DevSnapKit'}
                  />
                </div>
              )}

              {/* Sliders: Canvas Padding & Corner Rounding */}
              <div className="space-y-3 pt-3 border-t border-white/[0.06]">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span className="font-medium">Canvas Padding</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="200"
                        aria-label="Canvas padding"
                        value={padding}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) setPadding(Math.max(0, Math.min(200, val)));
                        }}
                        className="w-12 bg-white/[0.04] border border-white/10 rounded-md px-1.5 py-0.5 text-right font-mono text-[11px] text-white focus:outline-none focus:border-white/30"
                      />
                      <span className="text-white/40 text-[11px]">px</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="4"
                    value={padding}
                    onChange={(e) => setPadding(parseInt(e.target.value))}
                    className="w-full accent-indigo-400 cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span className="font-medium">Corner Rounding</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="48"
                        value={roundedCorners}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) setRoundedCorners(Math.max(0, Math.min(48, val)));
                        }}
                        className="w-12 bg-white/[0.04] border border-white/10 rounded-md px-1.5 py-0.5 text-right font-mono text-[11px] text-white focus:outline-none focus:border-white/30"
                      />
                      <span className="text-white/40 text-[11px]">px</span>
                    </div>
                  </div>

                  {/* Corner Rounding Presets (F5: Sharp / Curved / Round) */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'sharp', label: 'Sharp', val: 0 },
                      { id: 'curved', label: 'Curved', val: 14 },
                      { id: 'round', label: 'Round', val: 40 },
                    ].map((p) => {
                      const isActive = roundedCorners === p.val;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setRoundedCorners(p.val)}
                          className={`py-1 px-2 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                            isActive
                              ? 'bg-white/15 text-white border-white/25 shadow-sm'
                              : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.05]'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="48"
                    step="2"
                    value={roundedCorners}
                    onChange={(e) => setRoundedCorners(parseInt(e.target.value))}
                    className="w-full accent-indigo-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Shadow Depth & Opacity */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/50">Shadow Depth</label>
                  <span className="text-[11px] text-white/40 capitalize">{shadowLevel}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['none', 'soft', 'dramatic', '3d'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setShadowLevel(lvl)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium capitalize border transition-all cursor-pointer active:scale-[0.98] ${
                        shadowLevel === lvl 
                          ? 'bg-white/[0.08] border-white/30 text-white shadow-sm' 
                          : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>

                {shadowLevel !== 'none' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs text-white/70">
                      <span className="text-[11px] font-medium">Shadow Opacity</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={shadowOpacity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) setShadowOpacity(Math.max(0, Math.min(100, val)));
                          }}
                          className="w-12 bg-white/[0.04] border border-white/10 rounded-md px-1.5 py-0.5 text-right font-mono text-[11px] text-white focus:outline-none focus:border-white/30"
                        />
                        <span className="text-white/40 text-[11px]">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={shadowOpacity}
                      onChange={(e) => setShadowOpacity(parseInt(e.target.value))}
                      className="w-full accent-indigo-400 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CANVAS BACKGROUNDS & THEMES */}
          {sidebarTab === 'background' && (
            <div className="space-y-4">
              {/* Background Mode Selector (5 Types) */}
              <div className="grid grid-cols-5 gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                <button
                  onClick={() => {
                    setBgType('gradient');
                    trackEvent('bg_type_change', { type: 'gradient' });
                  }}
                  className={`py-1.5 px-0.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-[0.98] ${
                    bgType === 'gradient'
                      ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                      : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span className="truncate">Gradient</span>
                </button>
                <button
                  onClick={() => {
                    setBgType('solid');
                    trackEvent('bg_type_change', { type: 'solid' });
                  }}
                  className={`py-1.5 px-0.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-[0.98] ${
                    bgType === 'solid'
                      ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                      : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Pipette className="w-3.5 h-3.5" />
                  <span className="truncate">Solid</span>
                </button>
                <button
                  onClick={() => {
                    setBgType('pattern');
                    trackEvent('bg_type_change', { type: 'pattern' });
                  }}
                  className={`py-1.5 px-0.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-[0.98] ${
                    bgType === 'pattern'
                      ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                      : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span className="truncate">Pattern</span>
                </button>
                <button
                  onClick={() => {
                    setBgType('transparent');
                    trackEvent('bg_type_change', { type: 'transparent' });
                  }}
                  className={`py-1.5 px-0.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-[0.98] ${
                    bgType === 'transparent'
                      ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                      : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span className="truncate">Alpha</span>
                </button>
                <button
                  onClick={() => {
                    setBgType('image');
                    trackEvent('bg_type_change', { type: 'image' });
                  }}
                  className={`py-1.5 px-0.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-[0.98] ${
                    bgType === 'image'
                      ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                      : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span className="truncate">Image</span>
                </button>
              </div>

              {/* MODE 1: GRADIENT (Curated 32 Studio Themes OR Custom 2-Color Gradient) */}
              {bgType === 'gradient' && (
                <div className="space-y-3">
                  <div className="flex items-center pb-1.5 border-b border-white/[0.06]">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIsCustomGradient(false)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                          !isCustomGradient ? 'bg-white/10 text-white border border-white/15 shadow-sm' : 'text-white/50 hover:text-white'
                        }`}
                      >
                        Studio Themes ({GRADIENTS.length})
                      </button>
                      <button
                        onClick={() => setIsCustomGradient(true)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                          isCustomGradient ? 'bg-white/10 text-white border border-white/15 shadow-sm' : 'text-white/50 hover:text-white'
                        }`}
                      >
                        <span>Custom 2-Color</span>
                        <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">Free</span>
                      </button>
                    </div>
                  </div>

                  {!isCustomGradient ? (
                    <>
                      <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto pr-1">
                        {filteredGradients.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => {
                              if (g.isPro && !isProUnlocked) {
                                setShowProModal(true);
                                return;
                              }
                              setGradient(g);
                              trackEvent('theme_change', { theme: g.id, name: g.name });
                            }}
                            className={`w-full aspect-square rounded-xl transition-all relative cursor-pointer border active:scale-[0.95] ${g.className} ${
                              gradient.id === g.id ? 'ring-2 ring-white/70 scale-105 border-white shadow-md' : 'border-white/10 hover:scale-105'
                            }`}
                            title={`${g.name}${g.isPro ? ' (Pro)' : ''}`}
                          >
                            {g.isPro && !isProUnlocked && (
                              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] rounded-xl flex items-center justify-center">
                                <Lock className="w-3 h-3 text-white/90" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={handleShuffleTheme}
                        className="w-full py-2 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-white/70 hover:text-white text-xs font-medium border border-white/[0.08] flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                      >
                        <Shuffle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Shuffle Studio Palette</span>
                      </button>
                    </>
                  ) : (
                    /* Custom 2-Color Gradient with 360° Angle Slider */
                    <div className="space-y-3 p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] text-white/70 font-medium">Color 1 (Start)</label>
                          <div className="flex items-center gap-1.5 p-1 bg-white/[0.04] rounded-lg border border-white/10">
                            <input
                              type="color"
                              value={customGradColor1}
                              onChange={(e) => setCustomGradColor1(e.target.value)}
                              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                            />
                            <input
                              type="text"
                              value={customGradColor1}
                              onChange={(e) => setCustomGradColor1(e.target.value)}
                              className="w-full bg-transparent text-[11px] font-mono text-white uppercase focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] text-white/70 font-medium">Color 2 (End)</label>
                          <div className="flex items-center gap-1.5 p-1 bg-white/[0.04] rounded-lg border border-white/10">
                            <input
                              type="color"
                              value={customGradColor2}
                              onChange={(e) => setCustomGradColor2(e.target.value)}
                              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                            />
                            <input
                              type="text"
                              value={customGradColor2}
                              onChange={(e) => setCustomGradColor2(e.target.value)}
                              className="w-full bg-transparent text-[11px] font-mono text-white uppercase focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Angle Slider with Direct Number Input */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs text-white/70">
                          <span className="flex items-center gap-1 text-[11px] font-medium">
                            <RotateCw className="w-3 h-3 text-indigo-400" />
                            <span>Gradient Angle</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="360"
                              value={customGradAngle}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) setCustomGradAngle(Math.max(0, Math.min(360, val)));
                              }}
                              className="w-12 bg-white/[0.04] border border-white/10 rounded-md px-1.5 py-0.5 text-right font-mono text-[11px] text-white focus:outline-none focus:border-white/30"
                            />
                            <span className="text-white/40 text-[11px]">deg</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          step="5"
                          value={customGradAngle}
                          onChange={(e) => setCustomGradAngle(parseInt(e.target.value))}
                          className="w-full accent-indigo-400 cursor-pointer"
                        />
                        {/* Quick Angles */}
                        <div className="flex items-center justify-between gap-1 pt-1">
                          {[0, 45, 90, 135, 180, 270].map((deg) => (
                            <button
                              key={deg}
                              onClick={() => setCustomGradAngle(deg)}
                              className={`flex-1 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                                customGradAngle === deg 
                                  ? 'bg-white/15 border-white/30 text-white font-medium' 
                                  : 'bg-white/[0.03] border-white/5 text-white/50 hover:text-white'
                              }`}
                            >
                              {deg}°
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Live Gradient Swatch Preview */}
                      <div 
                        className="w-full h-7 rounded-lg border border-white/15 shadow-inner"
                        style={{
                          backgroundImage: `linear-gradient(${customGradAngle}deg, ${customGradColor1}, ${customGradColor2})`
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* MODE 2: SOLID STUDIO COLORS */}
              {bgType === 'solid' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                      Curated Studio Solids
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {SOLID_COLOR_PRESETS.map((item) => (
                        <button
                          key={item.color}
                          onClick={() => {
                            setSolidColor(item.color);
                            trackEvent('theme_change', { solid: item.color, name: item.name });
                          }}
                          className={`flex flex-col items-center p-1.5 rounded-xl border transition-all cursor-pointer group active:scale-[0.95] ${
                            solidColor === item.color
                              ? 'bg-white/[0.08] border-white/30 text-white shadow-sm ring-1 ring-white/20'
                              : 'bg-white/[0.02] border-white/[0.06] hover:border-white/15 text-white/60 hover:text-white'
                          }`}
                          title={item.name}
                        >
                          <div
                            className="w-6 h-6 rounded-lg border border-white/20 shadow-sm mb-1"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-[11px] font-medium truncate w-full text-center">
                            {item.name.split(' ')[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Free Unrestricted Color Picker */}
                  <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                        <Pipette className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Custom Color Picker</span>
                      </span>
                      <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                        Unrestricted Free
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="color"
                        value={solidColor}
                        onChange={(e) => setSolidColor(e.target.value)}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-white/20 bg-transparent p-0"
                      />
                      <div className="flex-1 space-y-0.5">
                        <input
                          type="text"
                          value={solidColor}
                          onChange={(e) => setSolidColor(e.target.value)}
                          className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 font-mono text-xs text-white uppercase focus:outline-none focus:border-white/30"
                          placeholder="#0B0F19"
                        />
                        <span className="text-[11px] text-white/40">Enter any HEX color value</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 3: PATTERN MESH (Offline Geometric CSS Grids) */}
              {bgType === 'pattern' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-indigo-400" />
                      <span>CSS Geometric Meshes</span>
                    </label>
                    <span className="text-[11px] text-emerald-400 font-semibold">100% Offline</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {PATTERN_PRESETS.map((p) => {
                      const isActive = selectedPattern === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedPattern(p.id as any);
                            trackEvent('theme_change', { pattern: p.id });
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.98] space-y-1.5 ${
                            isActive
                              ? 'bg-white/[0.08] border-white/30 text-white shadow-sm ring-1 ring-white/20'
                              : 'bg-white/[0.02] border-white/[0.06] hover:border-white/15 hover:bg-white/[0.05] text-white/60 hover:text-white'
                          }`}
                        >
                          {/* Mini Pattern Thumbnail Preview */}
                          <div 
                            className={`w-full h-12 rounded-lg border border-white/10 ${
                              p.id === 'dots'
                                ? 'bg-slate-950 bg-[radial-gradient(rgba(255,255,255,0.4)_1.5px,transparent_1.5px)] [background-size:12px_12px]'
                                : p.id === 'grid'
                                ? 'bg-slate-950 bg-[linear-gradient(to_right,rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:14px_14px]'
                                : p.id === 'spotlight'
                                ? 'bg-[#0a0c14] bg-[radial-gradient(ellipse_80%_80%_at_50%_0%,rgba(120,119,198,0.7),transparent)]'
                                : 'bg-[#060814] bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.6)_0%,transparent_50%),radial-gradient(circle_at_80%_80%,rgba(236,72,153,0.5)_0%,transparent_50%)]'
                            }`}
                          />
                          <div>
                            <div className="text-xs font-semibold leading-tight text-white">
                              {p.name}
                            </div>
                            <div className="text-[11px] text-white/40 truncate">
                              {p.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MODE 4: ALPHA TRANSPARENCY */}
              {bgType === 'transparent' && (
                <div className="p-3.5 bg-white/[0.02] rounded-xl border border-white/[0.06] space-y-2.5">
                  <div className="flex items-center gap-2 text-white">
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">Alpha Transparent Export</span>
                  </div>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Zero background pixels exported in <strong className="text-white">PNG</strong> and <strong className="text-white">WebP</strong> formats. Perfect for direct integration into keynote slides, Notion docs, Figma comps, and product landing pages.
                  </p>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded border border-white/20 shrink-0 bg-[radial-gradient(#64748b_1.5px,transparent_1.5px)] [background-size:8px_8px]" />
                    <div className="text-[11px] text-white/40">
                      Canvas preview shows a reference dot grid so you can align frame geometry effortlessly.
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 5: CUSTOM IMAGE BACKGROUND (F3) */}
              {bgType === 'image' && (
                <div className="space-y-3.5 p-3.5 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                  <input
                    ref={bgFileInputRef}
                    data-testid="bg-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleBgImageUpload}
                    className="hidden"
                  />

                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Custom Image Background</span>
                    </label>
                    <span className="text-[11px] text-emerald-400 font-semibold">Local Upload</span>
                  </div>

                  {!bgImageSrc ? (
                    <button
                      onClick={() => bgFileInputRef.current?.click()}
                      className="w-full py-7 border-2 border-dashed border-white/20 hover:border-white/40 rounded-xl flex flex-col items-center justify-center gap-2 text-white/60 hover:text-white bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5 text-indigo-400" />
                      </div>
                      <span className="text-xs font-semibold">Upload Background Image</span>
                      <span className="text-[11px] text-white/40">PNG, JPG, WebP up to 2560px</span>
                    </button>
                  ) : (
                    <div className="space-y-3">
                      {/* Image Thumbnail and Action Buttons */}
                      <div className="flex items-center gap-3 p-2 bg-white/[0.03] rounded-xl border border-white/[0.08]">
                        <div className="w-16 h-12 rounded-lg overflow-hidden border border-white/10 bg-black/40 flex-shrink-0">
                          <img
                            src={bgImageSrc}
                            alt="Background Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 flex gap-2">
                          <button
                            onClick={() => bgFileInputRef.current?.click()}
                            className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white border border-white/15 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Replace</span>
                          </button>
                          <button
                            onClick={() => setBgImageSrc(null)}
                            className="py-1.5 px-2.5 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all cursor-pointer flex items-center justify-center"
                            title="Remove background image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Blur Slider */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/60 font-medium">Blur</span>
                          <span className="font-mono text-white/40 text-[11px]">{bgImageBlur}px</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="40"
                          value={bgImageBlur}
                          onChange={(e) => setBgImageBlur(parseInt(e.target.value))}
                          className="w-full accent-indigo-400 cursor-pointer"
                        />
                      </div>

                      {/* Opacity Slider */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/60 font-medium">Opacity</span>
                          <span className="font-mono text-white/40 text-[11px]">{bgImageOpacity}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={bgImageOpacity}
                          onChange={(e) => setBgImageOpacity(parseInt(e.target.value))}
                          className="w-full accent-indigo-400 cursor-pointer"
                        />
                      </div>

                      {/* Fit Mode Toggle */}
                      <div className="space-y-1.5">
                        <span className="text-xs text-white/60 font-medium">Fit Mode</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => setBgImageFit('cover')}
                            className={`py-1.5 px-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                              bgImageFit === 'cover'
                                ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                                : 'text-white/40 hover:text-white bg-white/[0.02] border border-white/[0.06]'
                            }`}
                          >
                            Cover
                          </button>
                          <button
                            onClick={() => setBgImageFit('contain')}
                            className={`py-1.5 px-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                              bgImageFit === 'contain'
                                ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                                : 'text-white/40 hover:text-white bg-white/[0.02] border border-white/[0.06]'
                            }`}
                          >
                            Contain
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* VFX OPTICAL LIGHTING & FILM NOISE PANEL (For all background modes) */}
              <div className="pt-3 border-t border-white/[0.06] space-y-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Optical Effects & Lighting</span>
                  </span>
                  <span className="text-[11px] text-white/40 font-normal">Studio VFX</span>
                </label>

                {/* Backlight Ambient Glow */}
                <div className="p-2.5 bg-white/[0.02] rounded-xl border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={vfxGlow}
                        onChange={(e) => setVfxGlow(e.target.checked)}
                        className="accent-indigo-400 rounded cursor-pointer"
                      />
                      <span className="text-xs font-medium text-white/80">Ambient Backlight Glow</span>
                    </label>
                    {vfxGlow && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={vfxGlowColor}
                          onChange={(e) => setVfxGlowColor(e.target.value)}
                          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                          title="Glow Color"
                        />
                        <span className="font-mono text-[11px] text-white/40 uppercase">{vfxGlowColor}</span>
                      </div>
                    )}
                  </div>

                  {vfxGlow && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs text-white/70">
                        <span className="text-[11px] font-medium">Glow Opacity</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="80"
                            value={vfxGlowOpacity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val)) setVfxGlowOpacity(Math.max(0, Math.min(80, val)));
                            }}
                            className="w-10 bg-white/[0.04] border border-white/10 rounded px-1 py-0.5 text-right font-mono text-[11px] text-white focus:outline-none focus:border-white/30"
                          />
                          <span className="text-white/40 text-[11px]">%</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="80"
                        step="5"
                        value={vfxGlowOpacity}
                        onChange={(e) => setVfxGlowOpacity(parseInt(e.target.value))}
                        className="w-full accent-indigo-400 cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* Film Grain Noise Overlay */}
                <div className="p-2.5 bg-white/[0.02] rounded-xl border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={vfxNoise}
                        onChange={(e) => setVfxNoise(e.target.checked)}
                        className="accent-indigo-400 rounded cursor-pointer"
                      />
                      <span className="text-xs font-medium text-white/80">Film Grain / Noise</span>
                    </label>
                    <span className="text-[11px] text-white/40">Procedural SVG</span>
                  </div>

                  {vfxNoise && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs text-white/70">
                        <span className="text-[11px] font-medium">Grain Intensity</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={vfxNoiseOpacity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val)) setVfxNoiseOpacity(Math.max(1, Math.min(20, val)));
                            }}
                            className="w-10 bg-white/[0.04] border border-white/10 rounded px-1 py-0.5 text-right font-mono text-[11px] text-white focus:outline-none focus:border-white/30"
                          />
                          <span className="text-white/40 text-[11px]">%</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={vfxNoiseOpacity}
                        onChange={(e) => setVfxNoiseOpacity(parseInt(e.target.value))}
                        className="w-full accent-indigo-400 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: BRAND ASSETS & MARKETING ELEMENTS (PRO) */}
          {sidebarTab === 'brand' && (
            <div className="space-y-4">
              {/* Header Value Callout */}
              <div className="p-3 bg-gradient-to-r from-amber-500/10 via-white/[0.02] to-amber-500/5 rounded-xl border border-amber-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Brand Authority & Traffic</span>
                  </span>
                  <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 uppercase tracking-wider">
                    PRO SUITE
                  </span>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  Free exports are 100% clean with zero forced watermark. Stamp your official brand assets to turn views into clicks and authority.
                </p>
              </div>

              {/* A. Custom Brand Logo */}
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Custom Brand Logo</span>
                  </span>
                  {logoDataUrl && (
                    <button
                      onClick={() => setLogoDataUrl(null)}
                      className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                      title="Remove custom logo"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                {isProUnlocked ? (
                  <div className="space-y-2.5">
                    {logoDataUrl ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-white/[0.03] rounded-lg border border-white/10">
                          <img src={logoDataUrl} alt="Logo" className="w-8 h-8 object-contain rounded bg-black/60 p-1" />
                          <span className="text-xs text-white/80 truncate flex-1 font-medium">Logo active</span>
                          <button
                            onClick={() => logoInputRef.current?.click()}
                            className="text-[11px] text-indigo-300 hover:underline cursor-pointer font-semibold"
                          >
                            Change
                          </button>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-white/50">Position</label>
                          <div className="grid grid-cols-2 gap-1 text-[11px]">
                            {(['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const).map((pos) => (
                              <button
                                key={pos}
                                onClick={() => setLogoPos(pos)}
                                className={`py-1 rounded-md border capitalize transition-all cursor-pointer ${
                                  logoPos === pos
                                    ? 'bg-white/15 border-white/30 text-white font-medium'
                                    : 'bg-white/[0.02] border-white/5 text-white/50 hover:text-white'
                                }`}
                              >
                                {pos.replace('-', ' ')}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-white/50">
                            <span>Scale</span>
                            <span className="font-mono text-white/80">{logoScale}%</span>
                          </div>
                          <input
                            type="range"
                            min="3"
                            max="14"
                            value={logoScale}
                            onChange={(e) => setLogoScale(parseInt(e.target.value))}
                            className="w-full accent-indigo-400 cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-white/50">
                            <span>Opacity</span>
                            <span className="font-mono text-white/80">{Math.round(logoOpacity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="50"
                            max="100"
                            value={Math.round(logoOpacity * 100)}
                            onChange={(e) => setLogoOpacity(parseInt(e.target.value) / 100)}
                            className="w-full accent-indigo-400 cursor-pointer"
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        className="w-full py-2.5 px-3 rounded-lg border border-dashed border-white/20 hover:border-white/40 bg-white/[0.02] hover:bg-white/[0.05] text-white/80 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Logo (PNG/SVG)</span>
                      </button>
                    )}
                    {logoError && (
                      <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-[11px] text-rose-400 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{logoError}</span>
                      </div>
                    )}
                    {isProcessingLogo && (
                      <div className="p-2 bg-white/[0.05] border border-white/10 rounded-lg text-[11px] text-white/80 flex items-center gap-1.5 animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>Optimizing logo dimensions...</span>
                      </div>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <p className="text-[11px] text-white/40">
                      Recommended: transparent PNG or SVG (Auto-optimized, &le; 5 MB)
                    </p>
                  </div>
                ) : (
                  <div
                    onClick={() => setShowProModal(true)}
                    className="group p-3 bg-white/[0.02] rounded-xl border border-white/[0.06] hover:border-amber-500/30 transition-all cursor-pointer space-y-1.5 active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/80 font-semibold">Upload Brand Logo (PNG / SVG)</span>
                      <Lock className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-300" />
                    </div>
                    <p className="text-[11px] text-white/50 leading-normal">
                      Stamp your high-res logo onto any corner of your screenshots and social cards.
                    </p>
                    <span className="text-[11px] text-amber-400 font-bold group-hover:underline flex items-center gap-1">
                      <span>Unlock in Pro ($1 Lifetime) &rarr;</span>
                    </span>
                  </div>
                )}
              </div>

              {/* B. Dynamic QR Code */}
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Dynamic QR Code</span>
                  </span>
                  {qrUrl && (
                    <button
                      onClick={() => { setQrUrl(''); setQrDataUrl(null); }}
                      className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                      title="Clear QR code"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                {isProUnlocked ? (
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      value={qrUrl}
                      onChange={(e) => setQrUrl(e.target.value)}
                      placeholder="https://yourproduct.com"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30 font-mono"
                    />

                    {qrDataUrl && (
                      <div className="space-y-2 pt-1">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-white/50">Position</label>
                          <div className="grid grid-cols-2 gap-1 text-[11px]">
                            {(['bottom-left', 'bottom-right', 'top-left', 'top-right'] as const).map((pos) => (
                              <button
                                key={pos}
                                onClick={() => setQrPos(pos)}
                                className={`py-1 rounded-md border capitalize transition-all cursor-pointer ${
                                  qrPos === pos
                                    ? 'bg-white/15 border-white/30 text-white font-medium'
                                    : 'bg-white/[0.02] border-white/5 text-white/50 hover:text-white'
                                }`}
                              >
                                {pos.replace('-', ' ')}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-white/50">
                            <span>Scale</span>
                            <span className="font-mono text-white/80">{qrScale}%</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="16"
                            value={qrScale}
                            onChange={(e) => setQrScale(parseInt(e.target.value))}
                            className="w-full accent-indigo-400 cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-white/40">
                      Scans take people straight to your product or waitlist.
                    </p>
                  </div>
                ) : (
                  <div
                    onClick={() => setShowProModal(true)}
                    className="group p-3 bg-white/[0.02] rounded-xl border border-white/[0.06] hover:border-amber-500/30 transition-all cursor-pointer space-y-1.5 active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/80 font-semibold">Embed Dynamic QR Code</span>
                      <Lock className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-300" />
                    </div>
                    <p className="text-[11px] text-white/50 leading-normal">
                      Convert passive viewers into direct website traffic, waitlist signups, and app downloads.
                    </p>
                    <span className="text-[11px] text-amber-400 font-bold group-hover:underline flex items-center gap-1">
                      <span>Unlock in Pro ($1 Lifetime) &rarr;</span>
                    </span>
                  </div>
                )}
              </div>

              {/* C. Text Brand Badge */}
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06] space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">Text Brand Badge</span>
                {isProUnlocked ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={customBrandWatermark}
                      onChange={(e) => setCustomBrandWatermark(e.target.value)}
                      placeholder="e.g. @IndieFounder or mysite.com"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                    />
                    <p className="text-[11px] text-white/40">
                      Appears in the bottom-right corner.
                    </p>
                  </div>
                ) : (
                  <div
                    onClick={() => setShowProModal(true)}
                    className="group p-3 bg-white/[0.02] rounded-xl border border-white/[0.06] hover:border-amber-500/30 transition-all cursor-pointer space-y-1.5 active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/80 font-semibold">Custom Text Attribution (@YourHandle)</span>
                      <Lock className="w-3 h-3 text-amber-400" />
                    </div>
                    <p className="text-[11px] text-white/50 leading-normal">
                      Personalize every graphic with your Twitter handle or domain name.
                    </p>
                    <span className="text-[11px] text-amber-400 font-bold group-hover:underline flex items-center gap-1">
                      <span>Unlock in Pro ($1 Lifetime) &rarr;</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Lifetime Pro Deal Strip (if not pro) */}
              {!isProUnlocked && (
                <div className="p-3.5 bg-gradient-to-br from-amber-500/10 via-white/[0.02] to-amber-500/5 border border-amber-500/30 rounded-xl space-y-2 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-300">
                    <Zap className="w-3.5 h-3.5 fill-amber-300" />
                    <span>LAUNCH SPECIAL: $1 LIFETIME COMMERCIAL PASS</span>
                  </div>
                  <p className="text-[11px] text-white/60 leading-normal">
                    Unlock Brand Logo + Dynamic QR + 4K Ultra HD + Batch Multi-Platform Export with lifetime commercial rights for social media, client work & product launches.
                  </p>
                  <button
                    onClick={() => setShowProModal(true)}
                    className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer active:scale-[0.98]"
                  >
                    Unlock Commercial Pass ($1)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EXPORT RESOLUTION, SIZES & DOWNLOAD */}
          {sidebarTab === 'export' && (
            <div className="space-y-4">
              {/* 1. Export Resolution & Format */}
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">Export Resolution</span>
                  <span className="text-[11px] text-white/80 font-mono font-medium bg-white/[0.06] px-2 py-0.5 rounded border border-white/10">
                    {dynamicExportDimensions.width} × {dynamicExportDimensions.height} ({exportFormat.toUpperCase()})
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { scale: 1, label: '1x Web' },
                    { scale: 2, label: '2x HD' },
                    { scale: 4, label: '4K Ultra', isPro: true },
                  ].map((res) => (
                    <button
                      key={res.scale}
                      onClick={() => {
                        if (res.isPro && !isProUnlocked) {
                          setShowProModal(true);
                          return;
                        }
                        setExportScale(res.scale);
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98] ${
                        exportScale === res.scale
                          ? 'bg-white/[0.12] border-white/30 text-white font-bold shadow-sm'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      <span>{res.label}</span>
                      {res.isPro && !isProUnlocked && <Lock className="w-2.5 h-2.5 text-amber-400" />}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-1 pt-0.5">
                  {(['png', 'webp', 'jpeg'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`py-1 rounded-md text-[11px] font-semibold uppercase border transition-all cursor-pointer active:scale-[0.98] ${
                        exportFormat === fmt
                          ? 'bg-white/[0.12] border-white/30 text-white font-bold shadow-sm'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Canvas Aspect Ratio */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center justify-between">
                  <span>Canvas Aspect Ratio</span>
                  <span className="text-[11px] font-normal text-white/40 normal-case">{canvasLogicalSize.width} × {canvasLogicalSize.height} px</span>
                </label>
                <form noValidate className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); applyCustomCanvasSize(); }}>
                  <label className="flex-1 min-w-0 text-[11px] text-white/60">W
                    <input aria-label="Canvas width" type="number" min="200" max="8000" step="1" value={dimensionDraft.width}
                      onChange={event => setDimensionDraft(prev => ({ ...prev, width: event.target.value }))}
                      className="mt-1 w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white" />
                  </label>
                  <label className="flex-1 min-w-0 text-[11px] text-white/60">H
                    <input aria-label="Canvas height" type="number" min="200" max="8000" step="1" value={dimensionDraft.height}
                      onChange={event => setDimensionDraft(prev => ({ ...prev, height: event.target.value }))}
                      className="mt-1 w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white" />
                  </label>
                  <button type="submit" className="rounded-lg bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-950 dark:bg-indigo-600 dark:text-white cursor-pointer">Set</button>
                </form>
                {dimensionError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{dimensionError}</p>}
                <div className="grid grid-cols-2 gap-1.5">
                  {aspectOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setAspectRatio(opt)}
                      className={`text-left px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer active:scale-[0.98] ${
                        aspectRatio.id === opt.id 
                          ? 'bg-white/[0.08] border-white/30 text-white shadow-sm ring-1 ring-white/20' 
                          : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white hover:border-white/15 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="block">{opt.label}</span>
                      <span className="block text-[10px] opacity-65">{opt.id === 'auto' ? `${canonicalAutoW} × ${canonicalAutoH}` : opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Download Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={handleDownload}
                  disabled={isExporting}
                  className="w-full bg-white hover:bg-white/90 text-black text-xs font-bold py-2.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExporting ? 'Exporting...' : `Download ${exportScale === 4 ? '4K' : exportScale + 'x'} (${dynamicExportDimensions.width}×${dynamicExportDimensions.height})`}</span>
                </button>

                <button
                  onClick={handleCopyClipboard}
                  disabled={isExporting}
                  className="w-full bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white border border-white/10 text-xs font-semibold py-2 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy to Clipboard (2x HD)'}</span>
                </button>
              </div>

              {/* Batch Multi-Size Export Section */}
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Batch Multi-Size Export</span>
                  </span>
                  {!isProUnlocked && (
                    <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                      PRO
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-white/50">
                  Generate all platform sizes in one click with zero layout distortion:
                </p>

                <div className="space-y-1.5 text-xs">
                  {aspectOptions.map((opt) => {
                    const isChecked = selectedBatchAspects.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/15 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBatchAspects([...selectedBatchAspects, opt.id]);
                              } else {
                                setSelectedBatchAspects(selectedBatchAspects.filter((id) => id !== opt.id));
                              }
                            }}
                            className="accent-indigo-400 rounded cursor-pointer"
                          />
                          <span className="text-white/80 font-medium">{opt.label}</span>
                        </div>
                        <span className="text-[11px] text-white/40">{opt.id === 'auto' ? `${canonicalAutoW} × ${canonicalAutoH}` : opt.desc}</span>
                      </label>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    if (!isProUnlocked) {
                      setShowProModal(true);
                      return;
                    }
                    handleBatchExport();
                  }}
                  disabled={isExporting || selectedBatchAspects.length === 0}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold py-2 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {!isProUnlocked
                      ? 'Unlock Batch Export in Pro'
                      : batchProgress
                      ? `Exporting ${batchProgress.current}/${batchProgress.total}...`
                      : `Export ${selectedBatchAspects.length} Sizes (${exportScale === 4 ? '4K' : exportScale + 'x'})`}
                  </span>
                </button>
              </div>
            </div>
          )}

        </aside>

      </main>
      </div>

      {/* Footer with Real Legal & Trust Links */}
      <footer className="border-t border-white/[0.06] bg-[#07080c] py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-white/40 space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-white/60">
          <button onClick={() => setActiveLegalModal('privacy')} className="hover:text-white cursor-pointer flex items-center gap-1.5 transition-colors">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy Policy</span>
          </button>
          <span>•</span>
          <button onClick={() => setActiveLegalModal('terms')} className="hover:text-white cursor-pointer flex items-center gap-1.5 transition-colors">
            <FileText className="w-3.5 h-3.5" />
            <span>Terms of Service</span>
          </button>
          <span>•</span>
          <button onClick={() => setActiveLegalModal('refund')} className="hover:text-white cursor-pointer flex items-center gap-1.5 transition-colors">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>30-Day Refund Guarantee</span>
          </button>
          <span>•</span>
          <button onClick={() => setActiveLegalModal('contact')} className="hover:text-white cursor-pointer flex items-center gap-1.5 transition-colors">
            <Mail className="w-3.5 h-3.5" />
            <span>Contact Founder</span>
          </button>
          <span>•</span>
          <a href="/admin" className="hover:text-white text-white/70 cursor-pointer flex items-center gap-1.5 transition-colors">
            <Lock className="w-3.5 h-3.5" />
            <span>Admin</span>
          </a>
        </div>
        <p className="text-[11px] text-white/60 max-w-2xl mx-auto">
          © 2026 DevSnapKit. Studio-Grade Visual Asset Studio for Creators, Marketers & Builders • 100% Client-Side In-Browser Processing • Zero Server Uploads.
        </p>
      </footer>

      {/* Pro Lifetime License Modal (with PayPal Integration) */}
      {showProModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl md:max-w-2xl lg:max-w-3xl w-full p-5 sm:p-6 shadow-2xl relative my-auto">
            
            <button
              onClick={() => setShowProModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer z-10"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header with integrated price pill */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-800/80 pr-8">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                  <Zap className="w-3.5 h-3.5 fill-amber-300" />
                  <span>COMMERCIAL CREATOR & PRO DEAL</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">Unlock DevSnapKit Pro</h3>
                <p className="text-xs text-slate-400">One-time payment of $1. Lifetime commercial access. No recurring subscriptions.</p>
              </div>
              <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-1 shrink-0 pt-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-black text-white">$1</span>
                  <span className="text-sm text-slate-500 line-through">$29</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Lifetime Access
                </span>
              </div>
            </div>

            {/* Responsive 2-Column Content */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-4">
              {/* Left Column: Feature List */}
              <div className="md:col-span-7 bg-slate-950 p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-2 text-xs text-slate-300">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800/80">
                  Everything Included Forever
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2 text-white font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-tight">Upload Your Brand Logo — watermark every visual with your agency, channel or company mark</span>
                  </div>
                  <div className="flex items-start gap-2 text-white font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-tight">Dynamic QR Code on Every Visual — turn social posts into direct website clicks & waitlist signups</span>
                  </div>
                  <div className="flex items-start gap-2 text-white font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-tight">One-Click Batch Export for All Platforms (Twitter/X, LinkedIn, OpenGraph, 16:9, 1:1)</span>
                  </div>
                  <div className="flex items-start gap-2 text-white font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-tight">Ultra HD 4K Lossless Retina PNG & WebP (up to 3840px) for crystal-clear presentations</span>
                  </div>
                  <div className="flex items-start gap-2 text-white font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-tight">Stamp Custom Brand Attribution (@YourHandle, company.com, or newsletter name)</span>
                  </div>
                  <div className="flex items-start gap-2 text-white font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-tight">Unlock All 32 Handcrafted Studio Lighting Themes & Luxury Color Palettes</span>
                  </div>
                  <div className="flex items-start gap-2 text-white font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-tight">Full Commercial License for Client Deliverables, Social Posts & Product Launches</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Instant Checkout & Key Activation */}
              <div className="md:col-span-5 flex flex-col justify-between space-y-3">
                <div className="space-y-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Instant Checkout
                  </div>

                  {/* PayPal Smart Payment Buttons Container */}
                  <div className="w-full min-h-[44px] space-y-1.5">
                    <div ref={paypalContainerRef} className="w-full" />
                    {isCapturingPayment && (
                      <div className="text-center py-2 text-xs font-semibold text-cyan-400 animate-pulse bg-cyan-950/40 border border-cyan-800/40 rounded-lg flex items-center justify-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying PayPal payment and issuing license key...</span>
                      </div>
                    )}
                  </div>

                  {/* Trust Badges */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                    <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> <span>30-Day Refund</span></span>
                    <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5 text-indigo-400" /> <span>256-Bit SSL</span></span>
                    <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-400" /> <span>Instant Key Delivery</span></span>
                  </div>
                </div>

                {/* License Key Activation input */}
                <div className="pt-2.5 border-t border-slate-800/80 space-y-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <p className="text-[11px] text-slate-400 font-medium">Already purchased? Enter your License Key:</p>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={proLicenseInput}
                      onChange={(e) => {
                        setProLicenseInput(e.target.value);
                        setLicenseError('');
                      }}
                      placeholder="DSK-XXXX-XXXX-XXXX"
                      className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <button
                      onClick={handleActivatePro}
                      disabled={isVerifyingKey}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isVerifyingKey ? 'Verifying...' : 'Activate'}
                    </button>
                  </div>
                  {licenseError && <p className="text-[11px] text-rose-400 text-center">{licenseError}</p>}
                  
                  <p className="text-[10px] text-slate-500 text-center pt-0.5">
                    Lost your key? <button type="button" onClick={() => { setShowProModal(false); setClaimModalTab('claim'); setShowClaimModal(true); }} className="text-indigo-400 hover:underline">Claim with PayPal Transaction ID</button>
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Pro License Activation & Claim Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowClaimModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white">DevSnapKit Pro License</h3>
              <p className="text-xs text-slate-300">
                Activate an existing license key or retrieve your license using PayPal purchase details.
              </p>
            </div>

            {/* Segmented Tab Controls */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setClaimModalTab('key')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  claimModalTab === 'key'
                    ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Enter License Key</span>
              </button>
              <button
                type="button"
                onClick={() => setClaimModalTab('claim')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  claimModalTab === 'claim'
                    ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Claim via PayPal</span>
              </button>
            </div>

            {/* Tab 1: Enter Existing License Key */}
            {claimModalTab === 'key' ? (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">DevSnapKit Pro License Key</label>
                  <input
                    type="text"
                    value={proLicenseInput}
                    onChange={(e) => {
                      setProLicenseInput(e.target.value);
                      setLicenseError('');
                    }}
                    placeholder="DSK-XXXX-XXXX-XXXX"
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 uppercase tracking-wider"
                  />
                </div>

                {licenseError && (
                  <p className="text-[11px] text-rose-400">{licenseError}</p>
                )}

                <button
                  onClick={handleActivatePro}
                  disabled={isVerifyingKey}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {isVerifyingKey ? 'Verifying with Server...' : 'Activate Pro Lifetime Pass'}
                </button>

                <p className="text-[11px] text-slate-400 text-center pt-1">
                  Don't have your key handy? <button type="button" onClick={() => setClaimModalTab('claim')} className="text-indigo-400 hover:underline">Claim with PayPal Transaction Details</button>
                </p>
              </div>
            ) : (
              /* Tab 2: Claim via PayPal Receipt */
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">PayPal Order ID / Transaction ID (Required)</label>
                  <input
                    type="text"
                    value={claimOrderId}
                    onChange={(e) => setClaimOrderId(e.target.value)}
                    placeholder="e.g. 8XY1234567890ABCD"
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <p className="text-[11px] text-slate-400">Find your order or transaction ID on your PayPal receipt.</p>

                {claimError && (
                  <p className="text-[11px] text-rose-400">{claimError}</p>
                )}

                <button
                  onClick={handleClaimLicense}
                  disabled={isClaiming}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {isClaiming ? 'Authenticating Order...' : 'Verify Purchase & Retrieve Key'}
                </button>

                <p className="text-[11px] text-slate-400 text-center pt-1">
                  Already have your key? <button type="button" onClick={() => setClaimModalTab('key')} className="text-indigo-400 hover:underline">Switch to Enter License Key</button>
                </p>
              </div>
            )}

            <p className="text-[11px] text-slate-500 text-center">
              Need immediate help? Contact <a href="mailto:support@devsnapkit.com" className="text-indigo-400 underline">support@devsnapkit.com</a>
            </p>
          </div>
        </div>
      )}

      {/* Purchase Success & License Key Delivery Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white">Payment Verified!</h3>
              <p className="text-xs text-slate-300">
                Thank you for purchasing DevSnapKit Pro Lifetime Pass. All Pro features, 32 themes, and 4K exports are unlocked forever.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Your Personal License Key:</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={purchasedLicenseKey}
                  className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm font-mono font-bold text-emerald-400 select-all focus:outline-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(purchasedLicenseKey);
                    setKeyCopied(true);
                    setTimeout(() => setKeyCopied(false), 2000);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{keyCopied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Keep this license key in your records. You can use it to activate Pro on any of your personal computers or browsers (up to 3 devices).</span>
              </p>
            </div>

            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm py-2.5 rounded-xl transition-all cursor-pointer"
            >
              Start Creating Mockups
            </button>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal (F2) */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowShortcutsModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold mb-1">
                <Keyboard className="w-3.5 h-3.5" />
                <span>KEYBOARD SHORTCUTS</span>
              </div>
              <h3 className="text-xl font-black text-white">Keyboard Shortcuts</h3>
              <p className="text-xs text-slate-400">Boost your workflow with essential shortcuts.</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 divide-y divide-slate-800/80 text-xs">
              <div className="flex items-center justify-between py-2.5 first:pt-0">
                <span className="text-slate-300 font-medium">Undo</span>
                <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-200">⌘Z / Ctrl+Z</kbd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-slate-300 font-medium">Redo</span>
                <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-200">⇧⌘Z / Ctrl+Shift+Z</kbd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-slate-300 font-medium">Export / Download</span>
                <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-200">⌘S / Ctrl+S</kbd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-slate-300 font-medium">Paste Image</span>
                <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-200">⌘V / Ctrl+V</kbd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-slate-300 font-medium">Single / Duo Mode</span>
                <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-200">1 / 2</kbd>
              </div>
              <div className="flex items-center justify-between py-2.5 last:pb-0">
                <span className="text-slate-300 font-medium">Clear Slot 2 Image</span>
                <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-200">Delete / Backspace</kbd>
              </div>
            </div>

            <button
              onClick={() => setShowShortcutsModal(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm py-2.5 rounded-xl transition-all cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Legal & Support Modals */}
      <LegalModals
        activeModal={activeLegalModal}
        onClose={() => setActiveLegalModal(null)}
      />

      {/* First-Visit Welcome Overlay */}
      <WelcomeOverlay
        onOpenLegal={() => setActiveLegalModal('terms')}
        onOpenLegalPrivacy={() => setActiveLegalModal('privacy')}
      />

    </div>
  );
}
