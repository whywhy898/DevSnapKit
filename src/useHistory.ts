import { useRef, useState, useEffect, useCallback } from 'react';
import { WindowTheme } from './MockupUnit';
import { CornerStyle, LayoutPreset } from './stylePresets';
import { DuoLayoutType } from './DuoThumbnail';

export interface EditorSnapshot {
  selectedPreset: string;
  imageSrc: string;
  imageName: string;
  windowTheme: WindowTheme;
  windowTitle: string;
  padding: number;
  roundedCorners: number;
  shadowLevel: string;
  shadowOpacity: number;
  activeCuratedLayout: string;
  cornerStyle: CornerStyle;
  layoutPreset: LayoutPreset;
  aspectRatioId: string;
  customCanvasSize: { width: number; height: number };
  secondarySrc: string | null;
  secondaryName: string;
  layoutMode: 'single' | 'duo';
  duoLayout: DuoLayoutType;
  bgType: string;
  solidColor: string;
  isCustomGradient: boolean;
  customGradColor1: string;
  customGradColor2: string;
  customGradAngle: number;
  selectedPattern: string;
  vfxNoise: boolean;
  vfxNoiseOpacity: number;
  vfxGlow: boolean;
  vfxGlowColor: string;
  vfxGlowOpacity: number;
  customBrandWatermark: string;
  logoDataUrl: string | null;
  logoPos: string;
  logoScale: number;
  logoOpacity: number;
  qrUrl: string;
  qrPos: string;
  qrScale: number;
  // F3
  bgImageSrc: string | null;
  bgImageBlur: number;
  bgImageOpacity: number;
  bgImageFit: 'cover' | 'contain';
  // F4
  hideMockup: boolean;
  // F7 Shots-aligned Mockup Zoom & Pan (Camera Dolly)
  mockupZoom: number;
  mockupOffsetX: number;
  mockupOffsetY: number;
  // F7 In-Frame Image Crop & Pan
  imageZoom: number;
  imageOffsetX: number;
  imageOffsetY: number;
}

export function useEditorHistory(
  currentSnapshot: EditorSnapshot,
  onRestore: (snapshot: EditorSnapshot) => void,
  maxHistory: number = 50
) {
  const historyRef = useRef<EditorSnapshot[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isRestoringRef = useRef<boolean>(false);
  const timerRef = useRef<any>(null);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);

  // Initialize history with initial snapshot
  useEffect(() => {
    if (historyRef.current.length === 0) {
      historyRef.current = [currentSnapshot];
      historyIndexRef.current = 0;
      setHistoryCount(1);
    }
  }, []);

  // Debounced snapshot capture (400ms)
  useEffect(() => {
    if (isRestoringRef.current) return;
    if (historyRef.current.length === 0) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      if (isRestoringRef.current) return;

      const currentIndex = historyIndexRef.current;
      const topSnapshot = historyRef.current[currentIndex];

      // Deep compare top of stack with current
      if (topSnapshot && JSON.stringify(topSnapshot) === JSON.stringify(currentSnapshot)) {
        return;
      }

      // Truncate redo branch
      const nextHistory = historyRef.current.slice(0, currentIndex + 1);
      nextHistory.push(currentSnapshot);

      // Limit max history
      if (nextHistory.length > maxHistory) {
        nextHistory.shift();
      }

      historyRef.current = nextHistory;
      historyIndexRef.current = nextHistory.length - 1;

      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(false);
      setHistoryCount(nextHistory.length);
    }, 400);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentSnapshot, maxHistory]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    isRestoringRef.current = true;
    historyIndexRef.current -= 1;
    const target = historyRef.current[historyIndexRef.current];

    onRestore(target);

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);

    setTimeout(() => {
      isRestoringRef.current = false;
    }, 100);
  }, [onRestore]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    isRestoringRef.current = true;
    historyIndexRef.current += 1;
    const target = historyRef.current[historyIndexRef.current];

    onRestore(target);

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);

    setTimeout(() => {
      isRestoringRef.current = false;
    }, 100);
  }, [onRestore]);

  return {
    canUndo,
    canRedo,
    historyCount,
    undo,
    redo,
    historyIndex: historyIndexRef.current,
  };
}
