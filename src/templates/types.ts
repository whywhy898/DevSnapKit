import type { CanvasTextLayer } from '../text/types';
import type { WindowTheme } from '../MockupUnit';

export interface MediaRegion { x: number; y: number; width: number; height: number }
export interface MockupTemplate {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly description: string;
  readonly badge: string;
  readonly thumbnail: string;
  readonly sampleId: 'saas' | 'mobile' | 'code';
  readonly canvas: { readonly aspectRatioId: 'og' | '16-9' | 'ig-story'; readonly width: number; readonly height: number };
  readonly style: { readonly gradientId: string; readonly windowTheme: WindowTheme; readonly padding: number; readonly roundedCorners: number; readonly shadowLevel: 'soft' | 'dramatic'; readonly shadowOpacity: number };
  readonly mediaRegion: Readonly<MediaRegion>;
  readonly text: { readonly headline: Readonly<Omit<CanvasTextLayer, 'id'>>; readonly description: Readonly<Omit<CanvasTextLayer, 'id'>> };
}
export interface TemplateContext {
  id: string;
  version: number;
  mediaRegion: MediaRegion;
  textRoles: { headline: string; description: string; [role: string]: string };
}
export type PrimaryMediaOrigin = { kind: 'builtin'; sampleId: string } | { kind: 'user' } | { kind: 'unknown' };
