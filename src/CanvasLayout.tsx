import React, { useLayoutEffect, useRef, useState } from 'react';
import { MockupUnit, MockupUnitProps } from './MockupUnit';
import { DuoLayoutType } from './DuoThumbnail';
import { getLayoutTransform, LayoutPreset } from './stylePresets';
import type { MediaRegion } from './templates/types';

export interface SceneSize { width: number; height: number }
interface Bounds extends SceneSize { x: number; y: number }
const close = (a: number, b: number) => Math.abs(a - b) < 0.05;

/** Only the preview is scaled; all artwork stays in stable logical coordinates. */
export function CanvasStage({ width, height, children, freezePreviewWhileEditing = false, onDeselect }: SceneSize & { children: React.ReactNode; freezePreviewWhileEditing?: boolean; onDeselect?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<SceneSize>({ width: 1, height: 1 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    const update = () => setSize(prev => {
      const desktop = window.matchMedia('(min-width: 1024px)').matches;
      let availableHeight = Math.max(280, window.innerHeight * .65);
      if (desktop && parent) {
        const styles = getComputedStyle(parent);
        const siblings = [...parent.children].filter(node => node !== el && node instanceof HTMLElement && getComputedStyle(node).position !== 'absolute');
        const used = siblings.reduce((total, node) => {
          const child = node as HTMLElement, css = getComputedStyle(child);
          return total + child.offsetHeight + (parseFloat(css.marginTop) || 0) + (parseFloat(css.marginBottom) || 0);
        }, 0);
        availableHeight = Math.max(1, parent.clientHeight - used - (parseFloat(styles.paddingTop) || 0) - (parseFloat(styles.paddingBottom) || 0));
      }
      const next = { width: el.clientWidth, height: availableHeight };
      return close(prev.width, next.width) && close(prev.height, next.height) ? prev : next;
    });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (parent) { observer.observe(parent); [...parent.children].forEach(child => { if (child !== el) observer.observe(child); }); }
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, []);
  const calculated = Math.min(1, Math.max(1, size.width - 32) / width, Math.max(1, size.height - 32) / height);
  const frozen = useRef({ width: size.width, scale: calculated, editing: false });
  if (!freezePreviewWhileEditing || !frozen.current.editing || !close(frozen.current.width, size.width)) frozen.current = { width: size.width, scale: calculated, editing: freezePreviewWhileEditing };
  const scale = freezePreviewWhileEditing ? frozen.current.scale : calculated;
  return (
    <div ref={ref} data-canvas-stage onClick={event => { if (!(event.target as HTMLElement).closest('[data-text-editor-ui]')) onDeselect?.(); }} className="relative flex-none min-h-0 w-full flex items-center justify-center overflow-visible" style={{ height: height * scale + 32, minHeight: freezePreviewWhileEditing ? Math.min(height * scale + 32, 500) : undefined }}>
      <div className="relative shrink-0" style={{ width: width * scale, height: height * scale, '--canvas-preview-scale': scale } as React.CSSProperties}>
        {children}
      </div>
    </div>
  );
}

interface CompositionProps extends MockupUnitProps {
  mode: 'single' | 'duo';
  duoLayout: DuoLayoutType;
  secondarySrc: string | null;
  secondaryName: string;
  onReplaceSecondary: () => void;
  emptySlot: React.ReactNode;
}

export function DeviceComposition({ mode, duoLayout, secondarySrc, secondaryName, onReplaceSecondary, emptySlot, ...unit }: CompositionProps) {
  const phone = unit.theme === 'iphone-17' || unit.theme === 'phone-clay';
  const basis = mode === 'single' && phone ? 375 : 1024;
  const slot = (index: number, width: number, style: React.CSSProperties = {}) => (
    <div key={index} data-scene-slot={index + 1} className="relative flex shrink-0 items-center justify-center"
      style={{ width, height: phone ? width * 852 / 393 : undefined, ...style }}>
      {index === 0 ? <MockupUnit {...unit} /> : secondarySrc ? (
        <MockupUnit {...unit} imageSrc={secondarySrc} imageName={secondaryName || 'Second Image'} onReplace={onReplaceSecondary} zoomStyle={undefined} />
      ) : emptySlot}
    </div>
  );
  if (mode === 'single') return slot(0, basis);
  const vertical = duoLayout === 'vertical';
  let first = phone ? 300 : basis * 0.46;
  let second = first;
  let gap = basis * 0.08;
  let a: React.CSSProperties = {}, b: React.CSSProperties = {};
  if (duoLayout === 'stack') {
    first = phone ? 340 : basis * 0.62;
    second = phone ? 300 : basis * 0.48;
    gap = 0;
    a = { transform: 'translate(-12%, -3%)', zIndex: 10 };
    b = { marginLeft: -basis * (phone ? 0.14 : 0.18), transform: 'translate(10%, 6%) rotate(2deg)', zIndex: 20 };
  } else if (duoLayout === 'hero') {
    first = phone ? 340 : basis * 0.6;
    second = phone ? 220 : basis * 0.34;
    gap = basis * 0.06;
  } else if (vertical) {
    first = second = phone ? 260 * 393 / 852 : basis * 0.8;
    gap = basis * (phone ? 0.04 : 0.06);
  }
  return <div data-duo-composition={duoLayout} style={{ width: basis, display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap }}>
    {slot(0, first, a)}{slot(1, second, b)}
  </div>;
}

interface FittedSceneProps extends SceneSize {
  mediaRegion?: MediaRegion;
  measurementKey?: unknown;
  paddingX: number;
  paddingY: number;
  basisWidth: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
  projection: LayoutPreset;
  onNaturalSize: (size: SceneSize) => void;
  children: React.ReactNode;
}

/** Measures the complete composition, including hardware, rotated slots and backplates. */
export function FittedScene({ width, height, paddingX, paddingY, basisWidth, zoom, offsetX, offsetY, projection, onNaturalSize, children, mediaRegion, measurementKey = children }: FittedSceneProps) {
  const origin = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<Bounds>({ x: 0, y: 0, width: basisWidth, height: 600 });
  useLayoutEffect(() => {
    const el = origin.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      // Read natural geometry without ancestor preview/fit/camera transforms. Restored
      // synchronously before paint; avoids subpixel viewport rounding changing Auto exports.
      const scaledAncestors = ['[data-scene-fit]', '[data-scene-camera]', '[data-composition-object]', '[data-canvas-root]']
        .map(selector => el.closest<HTMLElement>(selector)).filter((node): node is HTMLElement => !!node);
      const savedTransforms = scaledAncestors.map(node => node.style.transform);
      scaledAncestors.forEach(node => { node.style.transform = 'none'; });
      let next: Bounds | undefined;
      try {
      const anchor = el.getBoundingClientRect();
      // The origin itself is never projected: this removes preview/fit/camera scaling.
      const unitScale = anchor.width / basisWidth;
      if (!(unitScale > 0)) return;
      const rects = [...el.querySelectorAll<HTMLElement>('[data-scene-slot], [data-scene-slot] div')]
        .filter(node => !node.closest('[data-export-ignore="true"]'))
        .map(node => node.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
      if (!rects.length) return;
      const left = Math.min(...rects.map(r => r.left));
      const top = Math.min(...rects.map(r => r.top));
      const right = Math.max(...rects.map(r => r.right));
      const bottom = Math.max(...rects.map(r => r.bottom));
      next = { x: (left - anchor.left) / unitScale, y: (top - anchor.top) / unitScale, width: (right - left) / unitScale, height: (bottom - top) / unitScale };
      } finally {
        scaledAncestors.forEach((node, index) => { node.style.transform = savedTransforms[index]; });
      }
      if (!next) return;
      const measured = next;
      setBounds(prev => Object.keys(measured).every(k => close(prev[k as keyof Bounds], measured[k as keyof Bounds])) ? prev : measured);
      onNaturalSize({ width: Math.ceil(measured.width - 0.001), height: Math.ceil(measured.height - 0.001) });
    };
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    el.querySelectorAll('[data-scene-slot]').forEach(node => observer.observe(node));
    el.addEventListener('load', schedule, true);
    document.fonts.addEventListener('loadingdone', schedule);
    schedule();
    return () => { cancelAnimationFrame(raf); observer.disconnect(); el.removeEventListener('load', schedule, true); document.fonts.removeEventListener('loadingdone', schedule); };
  }, [measurementKey, basisWidth, projection, onNaturalSize]);
  const paddedW = Math.max(1, width - 2 * paddingX), paddedH = Math.max(1, height - 2 * paddingY);
  const region = mediaRegion ?? { x: 0, y: 0, width: 1, height: 1 };
  const innerW = paddedW * region.width, innerH = paddedH * region.height;
  // The measurement basis is fixed, not the canvas width; fit may therefore grow
  // as well as shrink. The composition keeps its own proportions in either case.
  const fit = Math.min(innerW / bounds.width, innerH / bounds.height);
  return (
    <div data-scene-inner style={{ position: 'absolute', left: paddingX + region.x * paddedW, top: paddingY + region.y * paddedH, width: innerW, height: innerH }}>
      <div data-scene-camera style={{ position: 'absolute', inset: 0, transform: `translate(${offsetX}%, ${offsetY}%) scale(${zoom / 100})`, transformOrigin: 'center' }}>
        <div data-scene-fit={fit} style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, transform: `scale(${fit})` }}>
          <div ref={origin} className="artwork-origin" style={{ position: 'absolute', width: basisWidth, left: -bounds.x - bounds.width / 2, top: -bounds.y - bounds.height / 2 }}>
            <div data-scene-projection style={{ width: basisWidth, transform: getLayoutTransform(projection), transformOrigin: 'center' }}>{children}</div>
            <div data-scene-bounds aria-hidden="true" style={{ position: 'absolute', pointerEvents: 'none', left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }} />
          </div>
        </div>
      </div>
    </div>
  );
}
