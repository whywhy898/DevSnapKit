export interface MediaRegion { x: number; y: number; width: number; height: number }
export interface TemplateContext {
  id: string;
  version: number;
  mediaRegion: MediaRegion;
  textRoles: { headline: string; description: string };
}
export type PrimaryMediaOrigin = { kind: 'builtin'; sampleId: string } | { kind: 'user' } | { kind: 'unknown' };
