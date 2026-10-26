import { PAPER_LAUNCH_DUO } from './definitions/paper-launch-duo';
import { NIGHT_SIGNAL_DUO } from './definitions/night-signal-duo';
import { POCKET_FLOW_DUO } from './definitions/pocket-flow-duo';
import { CALM_SPLIT } from './definitions/calm-split';
import type { CuratedTemplateId } from './types';

/** Only implemented templates are available; declared future IDs are not listings. */
export const CURATED_TEMPLATE_CATALOG = [
  { id: 'editorial-honey' as const, version: 2, name: 'Editorial Honey', tier: 'free' as const, width: 1600, height: 1200, thumbnail: '/designed/editorial-honey.webp', description: 'An editorial launch poster with expressive type and two screenshots.' },
  { id: PAPER_LAUNCH_DUO.id, version: PAPER_LAUNCH_DUO.version, name: PAPER_LAUNCH_DUO.name, tier: PAPER_LAUNCH_DUO.tier, width: 1200, height: 630, thumbnail: '/designed/collection/paper-launch-duo.webp', description: 'A calm launch canvas with two browser screenshots and an optional single-image layout.' },
  { id: CALM_SPLIT.id, version: CALM_SPLIT.version, name: CALM_SPLIT.name, tier: CALM_SPLIT.tier, width: 1080, height: 1080, thumbnail: '/designed/collection/calm-split.webp', description: 'A quiet square canvas with two equal browser views and room for a clear story.' },
  { id: NIGHT_SIGNAL_DUO.id, version: NIGHT_SIGNAL_DUO.version, name: NIGHT_SIGNAL_DUO.name, tier: NIGHT_SIGNAL_DUO.tier, width: 1600, height: 1200, thumbnail: '/designed/collection/night-signal-duo.webp', description: 'A dark product canvas with a large browser overview, release detail and a centered single-image layout.' },
  { id: POCKET_FLOW_DUO.id, version: POCKET_FLOW_DUO.version, name: POCKET_FLOW_DUO.name, tier: POCKET_FLOW_DUO.tier, width: 1080, height: 1920, thumbnail: '/designed/collection/pocket-flow-duo.webp', description: 'A warm portrait canvas with two independent light phones for your day and your focus.' },
];
export const getCuratedTemplate = (id: string) => CURATED_TEMPLATE_CATALOG.find(template => template.id === id);
export const isCuratedTemplateAvailable = (id: string): id is CuratedTemplateId => !!getCuratedTemplate(id);
