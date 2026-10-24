import type { MockupTemplate } from './types';
import type { CanvasTextLayer } from '../text/types';

const text = (content: string, fontSize: number, weight: CanvasTextLayer['weight'], color: string, headline: boolean): Omit<CanvasTextLayer, 'id'> => ({
  content, fontSize, weight, color, centerX: .5, centerY: headline ? .13 : .25,
  widthRatio: headline ? .84 : .82, font: 'manrope', italic: false, align: 'center',
});

/** Product presets, not arbitrary snapshot patches. All four use free styles. */
export const TEMPLATE_CATALOG: readonly MockupTemplate[] = [
  {
    id: 'social-launch', version: 1, name: 'Social Launch', description: 'A clear announcement for your next release.', badge: 'Creator',
    thumbnail: '/templates/social-launch-v1.webp', sampleId: 'saas',
    canvas: { aspectRatioId: 'og', width: 1200, height: 630 },
    style: { gradientId: 'mesh-dark', windowTheme: 'browser', padding: 64, roundedCorners: 12, shadowLevel: 'soft', shadowOpacity: 35 },
    mediaRegion: { x: 0, y: .30, width: 1, height: .68 },
    text: { headline: text('Ship it.', 72, 800, '#FFFFFF', true), description: text('One screenshot. One clear update.', 28, 400, '#E2E8F0', false) },
  },
  {
    id: 'saas-dashboard', version: 1, name: 'SaaS Dashboard', description: 'Put your product metrics in the spotlight.', badge: 'SaaS',
    thumbnail: '/templates/saas-dashboard-v1.webp', sampleId: 'saas',
    canvas: { aspectRatioId: '16-9', width: 1920, height: 1080 },
    style: { gradientId: 'slate', windowTheme: 'mac-dark', padding: 72, roundedCorners: 14, shadowLevel: 'dramatic', shadowOpacity: 45 },
    mediaRegion: { x: 0, y: .30, width: 1, height: .68 },
    text: { headline: text('Know your numbers.', 96, 800, '#FFFFFF', true), description: text('Every metric that matters, in one view.', 36, 400, '#CBD5E1', false) },
  },
  {
    id: 'mobile-app', version: 1, name: 'Mobile App', description: 'A portrait story for your app.', badge: 'App',
    thumbnail: '/templates/mobile-app-v1.webp', sampleId: 'mobile',
    canvas: { aspectRatioId: 'ig-story', width: 1080, height: 1920 },
    style: { gradientId: 'studio-light', windowTheme: 'iphone-17', padding: 80, roundedCorners: 10, shadowLevel: 'soft', shadowOpacity: 30 },
    mediaRegion: { x: 0, y: .30, width: 1, height: .68 },
    text: { headline: text('Your day,\ntracked.', 80, 800, '#1E293B', true), description: text('Calm progress, every morning.', 32, 400, '#475569', false) },
  },
  {
    id: 'code-terminal', version: 1, name: 'Code & Terminal', description: 'Share a focused code or terminal update.', badge: 'Developer',
    thumbnail: '/templates/code-terminal-v1.webp', sampleId: 'code',
    canvas: { aspectRatioId: '16-9', width: 1920, height: 1080 },
    style: { gradientId: 'studio-dark', windowTheme: 'mac-dark', padding: 64, roundedCorners: 12, shadowLevel: 'soft', shadowOpacity: 40 },
    mediaRegion: { x: 0, y: .30, width: 1, height: .68 },
    text: { headline: text('Show the change.', 96, 800, '#FFFFFF', true), description: text('Code, context, and a clearer update.', 36, 400, '#CBD5E1', false) },
  },
];

export const getTemplate = (id: string) => TEMPLATE_CATALOG.find(template => template.id === id);
