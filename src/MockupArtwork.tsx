import React, { useMemo } from 'react';
import { DeviceComposition, FittedScene, SceneSize } from './CanvasLayout';
import type { EditorSnapshot } from './useHistory';
import type { PresetGradient } from './themes';
import { CanvasTextLayerRenderer } from './text/CanvasTextLayerRenderer';
import { CompositionRenderer } from './composition/CompositionRenderer';
import { canUse } from '../shared/productCapabilities';

export interface MockupArtworkProps extends Pick<EditorSnapshot,
  | 'compositionDocument'
  | 'textDocument'
  | 'templateContext'
  | 'bgType'
  | 'isCustomGradient'
  | 'selectedPattern'
  | 'solidColor'
  | 'customGradAngle'
  | 'customGradColor1'
  | 'customGradColor2'
  | 'bgImageSrc'
  | 'bgImageOpacity'
  | 'bgImageFit'
  | 'bgImageBlur'
  | 'vfxGlow'
  | 'vfxGlowColor'
  | 'vfxGlowOpacity'
  | 'vfxNoise'
  | 'vfxNoiseOpacity'
  | 'layoutMode'
  | 'mockupZoom'
  | 'mockupOffsetX'
  | 'mockupOffsetY'
  | 'layoutPreset'
  | 'duoLayout'
  | 'windowTheme'
  | 'imageSrc'
  | 'imageName'
  | 'shadowLevel'
  | 'shadowOpacity'
  | 'cornerStyle'
  | 'roundedCorners'
  | 'windowTitle'
  | 'hideMockup'
  | 'secondarySrc'
  | 'secondaryName'
  | 'logoDataUrl'
  | 'logoPos'
  | 'padding'
  | 'logoScale'
  | 'logoOpacity'
  | 'qrPos'
  | 'qrScale'
  | 'customBrandWatermark'
> {
  canvasRef: React.Ref<HTMLDivElement>;
  gradient: PresetGradient;
  canvasLogicalSize: SceneSize;
  effectivePaddingX: number;
  effectivePaddingY: number;
  isPhoneTheme: boolean;
  zoomStyle: React.CSSProperties;
  handleNaturalSceneSize: (size: SceneSize) => void;
  onReplace: () => void;
  onReplaceSecondary: () => void;
  emptySlot: React.ReactNode;
  isProUnlocked: boolean;
  qrDataUrl: string | null;
  preview?: boolean;
  editingTextId?: string | null;
  onObjectPointerDown?: (id: string, event: React.PointerEvent<HTMLDivElement>) => void;
}

/** Original artwork tree; App retains the stage, state, history and export ownership. */
export function MockupArtwork({
  compositionDocument,
  onObjectPointerDown,
  textDocument,
  templateContext,
  preview = true,
  editingTextId,
  bgType,
  isCustomGradient,
  selectedPattern,
  solidColor,
  customGradAngle,
  customGradColor1,
  customGradColor2,
  bgImageSrc,
  bgImageOpacity,
  bgImageFit,
  bgImageBlur,
  vfxGlow,
  vfxGlowColor,
  vfxGlowOpacity,
  vfxNoise,
  vfxNoiseOpacity,
  layoutMode,
  mockupZoom,
  mockupOffsetX,
  mockupOffsetY,
  layoutPreset,
  duoLayout,
  windowTheme,
  imageSrc,
  imageName,
  shadowLevel,
  shadowOpacity,
  cornerStyle,
  roundedCorners,
  windowTitle,
  hideMockup,
  secondarySrc,
  secondaryName,
  logoDataUrl,
  logoPos,
  padding,
  logoScale,
  logoOpacity,
  qrPos,
  qrScale,
  customBrandWatermark,
  canvasRef,
  gradient,
  canvasLogicalSize,
  effectivePaddingX,
  effectivePaddingY,
  isPhoneTheme,
  zoomStyle,
  handleNaturalSceneSize,
  onReplace,
  onReplaceSecondary,
  emptySlot,
  isProUnlocked,
  qrDataUrl,
}: MockupArtworkProps) {
  // Actual interaction A/B (geometry/interaction-performance-*.json) showed that
  // remeasuring the image scene for each text move invalidated the entire canvas.
  // Keep every image/frame/composition geometry input, but exclude text changes.
  const imageStyleKey = JSON.stringify(zoomStyle);
  const sceneMeasurementKey = useMemo(() => ({}), [layoutMode, duoLayout, windowTheme, imageSrc, imageName, shadowLevel, shadowOpacity,
    cornerStyle, roundedCorners, windowTitle, hideMockup, secondarySrc, secondaryName, isPhoneTheme, imageStyleKey]);
  return (
    <div 
      ref={canvasRef}
      id={preview ? 'studio-canvas' : undefined}
      data-canvas-root="true"
      data-media-upload-enabled={preview && !editingTextId}
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
        transform: preview ? 'scale(var(--canvas-preview-scale, 1))' : 'none',
        transformOrigin: 'top left',
        padding: `${effectivePaddingY}px ${effectivePaddingX}px`,
        backgroundColor: bgType === 'solid' ? solidColor : undefined,
        backgroundImage: bgType === 'gradient' && isCustomGradient 
          ? `linear-gradient(${customGradAngle}deg, ${customGradColor1}, ${customGradColor2})` 
          : undefined
      }}
    >
      {/* Transparent checkerboard hint (only in transparent mode for preview) */}
      {preview && bgType === 'transparent' && (
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

      {compositionDocument ? <CompositionRenderer document={compositionDocument} size={canvasLogicalSize} textDocument={textDocument}
        imageSrc={imageSrc} imageName={imageName} secondarySrc={secondarySrc} secondaryName={secondaryName}
        windowTheme={windowTheme} windowTitle={windowTitle} shadowLevel={shadowLevel} shadowOpacity={shadowOpacity}
        cornerStyle={cornerStyle} roundedCorners={roundedCorners} hideMockup={hideMockup} layoutPreset={layoutPreset}
        preview={preview} editingTextId={editingTextId} onReplace={onReplace} onReplaceSecondary={onReplaceSecondary} onObjectPointerDown={onObjectPointerDown}
        legacy={{ effectivePaddingX, effectivePaddingY, layoutMode, duoLayout, mockupZoom, mockupOffsetX, mockupOffsetY, isPhoneTheme, zoomStyle, handleNaturalSceneSize }}
        isProUnlocked={isProUnlocked} logoDataUrl={logoDataUrl} logoOpacity={logoOpacity}
      /> : <FittedScene
        mediaRegion={templateContext?.mediaRegion}
        measurementKey={sceneMeasurementKey}
        width={canvasLogicalSize.width} height={canvasLogicalSize.height}
        paddingX={effectivePaddingX} paddingY={effectivePaddingY}
        basisWidth={layoutMode === 'single' && isPhoneTheme ? 375 : 1024}
        zoom={mockupZoom} offsetX={mockupOffsetX} offsetY={mockupOffsetY}
        projection={layoutPreset} onNaturalSize={handleNaturalSceneSize}
      >
        <DeviceComposition
          mediaFit={templateContext ? 'contain' : undefined}
          mode={layoutMode} duoLayout={duoLayout}
          theme={windowTheme} imageSrc={imageSrc} imageName={imageName}
          interactive={preview && !editingTextId}
          deferHoverOverlay={textDocument.layers.length > 0}
          onReplace={onReplace}
          shadowLevel={shadowLevel} shadowOpacity={shadowOpacity}
          cornerStyle={cornerStyle} roundedCorners={roundedCorners}
          windowTitle={windowTitle} hideFrame={hideMockup} zoomStyle={zoomStyle}
          secondarySrc={secondarySrc} secondaryName={secondaryName}
          onReplaceSecondary={onReplaceSecondary}
          emptySlot={emptySlot}
        />
      </FittedScene>}

      {/* Free logo slot; a template mark owns its own custom logo placement. */}
      {canUse('brand_logo', isProUnlocked) && logoDataUrl && !compositionDocument?.objects.some(node => node.kind === 'shape' && node.shape === 'mark') && (
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

      {/* Free static QR code. */}
      {canUse('qr_code', isProUnlocked) && qrDataUrl && (
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

      {/* Preserve existing saved text badges as free text content. */}
      {canUse('legacy_brand_badge', isProUnlocked) && customBrandWatermark.trim() && (
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

      {!compositionDocument && <CanvasTextLayerRenderer document={textDocument} size={canvasLogicalSize} editingId={preview ? editingTextId : null} />}
    </div>
  );
}
