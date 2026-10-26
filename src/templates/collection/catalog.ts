import { PAPER_LAUNCH_DUO } from './definitions/paper-launch-duo';
import type { CuratedTemplateId } from './types';

/** Only implemented templates are available; declared future IDs are not listings. */
export const CURATED_TEMPLATE_CATALOG = [
  { id: 'editorial-honey' as const, version: 2, name: 'Editorial Honey', tier: 'free' as const, width: 1600, height: 1200, thumbnail: '/designed/editorial-honey.webp', description: 'An editorial launch poster with expressive type and two screenshots.' },
  { id: PAPER_LAUNCH_DUO.id, version: PAPER_LAUNCH_DUO.version, name: PAPER_LAUNCH_DUO.name, tier: PAPER_LAUNCH_DUO.tier, width: 1200, height: 630, thumbnail: '/designed/collection/paper-launch-duo.webp', description: 'A calm launch canvas with two browser screenshots and an optional single-image layout.' },
];
export const getCuratedTemplate = (id: string) => CURATED_TEMPLATE_CATALOG.find(template => template.id === id);
export const isCuratedTemplateAvailable = (id: string): id is CuratedTemplateId => !!getCuratedTemplate(id);
