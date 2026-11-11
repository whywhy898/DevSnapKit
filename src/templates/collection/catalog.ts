import { PAPER_LAUNCH_DUO } from './definitions/paper-launch-duo';
import { NIGHT_SIGNAL_DUO } from './definitions/night-signal-duo';
import { POCKET_FLOW_DUO } from './definitions/pocket-flow-duo';
import { CALM_SPLIT } from './definitions/calm-split';
import { APP_PAIR } from './definitions/app-pair';
import { STUDIO_BRIDGE } from './definitions/studio-bridge';
import { EDITORIAL_STORY } from './definitions/editorial-story';
import { FEATURE_SPOTLIGHT } from './definitions/feature-spotlight';
import { CODE_PREVIEW } from './definitions/code-preview';
import { METRIC_FOCUS } from './definitions/metric-focus';
import { BEFORE_AFTER } from './definitions/before-after';
import { VIOLET_LAUNCH } from './definitions/violet-launch';
import { ELECTRIC_PAIR } from './definitions/electric-pair';
import { PEACH_EDITORIAL } from './definitions/peach-editorial';
import { NEXT_STAGE } from './definitions/next-stage';
import type { CuratedTemplateId } from './types';
import { SCENE_TEMPLATES } from './scenes';

/** Only implemented templates are available; declared future IDs are not listings. */
export const CURATED_TEMPLATE_CATALOG = [
  { id: 'editorial-honey' as const, version: 2, name: 'Editorial Honey', tier: 'free' as const, width: 1600, height: 1200, thumbnail: '/designed/editorial-honey.webp', description: 'An editorial launch poster with expressive type and two screenshots.' },
  { id: PAPER_LAUNCH_DUO.id, version: PAPER_LAUNCH_DUO.version, name: PAPER_LAUNCH_DUO.name, tier: PAPER_LAUNCH_DUO.tier, width: 1200, height: 630, thumbnail: '/designed/collection/paper-launch-duo.webp', description: 'A calm launch canvas with two browser screenshots and an optional single-image layout.' },
  { id: CALM_SPLIT.id, version: CALM_SPLIT.version, name: CALM_SPLIT.name, tier: CALM_SPLIT.tier, width: 1080, height: 1080, thumbnail: '/designed/collection/calm-split.webp', description: 'A quiet square canvas with two equal browser views and room for a clear story.' },
  { id: APP_PAIR.id, version: APP_PAIR.version, name: APP_PAIR.name, tier: APP_PAIR.tier, width: 1080, height: 1920, thumbnail: '/designed/collection/app-pair.webp', description: 'A pale blue portrait canvas with two equal phone views for connected app screens.' },
  { id: NIGHT_SIGNAL_DUO.id, version: NIGHT_SIGNAL_DUO.version, name: NIGHT_SIGNAL_DUO.name, tier: NIGHT_SIGNAL_DUO.tier, width: 1600, height: 1200, thumbnail: '/designed/collection/night-signal-duo.webp', description: 'A dark product canvas with a large browser overview, release detail and a centered single-image layout.' },
  { id: POCKET_FLOW_DUO.id, version: POCKET_FLOW_DUO.version, name: POCKET_FLOW_DUO.name, tier: POCKET_FLOW_DUO.tier, width: 1080, height: 1920, thumbnail: '/designed/collection/pocket-flow-duo.webp', description: 'A warm portrait canvas with two independent light phones for your day and your focus.' },
  { id: STUDIO_BRIDGE.id, version: STUDIO_BRIDGE.version, name: STUDIO_BRIDGE.name, tier: STUDIO_BRIDGE.tier, width: 1920, height: 1080, thumbnail: '/designed/collection/studio-bridge.webp', description: 'Oversized launch typography with a dark browser and a light phone on vivid orange.' },
  { id: EDITORIAL_STORY.id, version: EDITORIAL_STORY.version, name: EDITORIAL_STORY.name, tier: EDITORIAL_STORY.tier, width: 1080, height: 1350, thumbnail: '/designed/collection/editorial-story.webp', description: 'An editorial journal cover with expressive serif type, a light phone and a weekly writing card.' },
  { id: FEATURE_SPOTLIGHT.id, version: FEATURE_SPOTLIGHT.version, name: FEATURE_SPOTLIGHT.name, tier: FEATURE_SPOTLIGHT.tier, width: 1200, height: 630, thumbnail: '/designed/collection/feature-spotlight.webp', description: 'A red feature panel and two overlapping browser views for one focused workflow.' },
  { id: CODE_PREVIEW.id, version: CODE_PREVIEW.version, name: CODE_PREVIEW.name, tier: CODE_PREVIEW.tier, width: 1600, height: 1200, thumbnail: '/designed/collection/code-preview.webp', description: 'A listening room across a wide desktop browser and a light phone on pale green.' },
  { id: METRIC_FOCUS.id, version: METRIC_FOCUS.version, name: METRIC_FOCUS.name, tier: METRIC_FOCUS.tier, width: 1920, height: 1080, thumbnail: '/designed/collection/metric-focus.webp', description: 'An editable headline metric on cobalt with an overview and a closer audience view.' },
  { id: BEFORE_AFTER.id, version: BEFORE_AFTER.version, name: BEFORE_AFTER.name, tier: BEFORE_AFTER.tier, width: 1080, height: 1080, thumbnail: '/designed/collection/before-after.webp', description: 'Equal browser views and editable comparison headings on charcoal and pale green.' },
  { id: VIOLET_LAUNCH.id, version: VIOLET_LAUNCH.version, name: VIOLET_LAUNCH.name, tier: VIOLET_LAUNCH.tier, width: 1920, height: 1080, thumbnail: '/designed/collection/violet-launch.webp', description: 'A rich purple launch canvas with oversized typography and two independently editable phones.' },
  { id: ELECTRIC_PAIR.id, version: ELECTRIC_PAIR.version, name: ELECTRIC_PAIR.name, tier: ELECTRIC_PAIR.tier, width: 1920, height: 1080, thumbnail: '/designed/collection/electric-pair.webp', description: 'A cobalt and navy canvas connecting a desktop overview with a foreground phone.' },
  { id: PEACH_EDITORIAL.id, version: PEACH_EDITORIAL.version, name: PEACH_EDITORIAL.name, tier: PEACH_EDITORIAL.tier, width: 1080, height: 1350, thumbnail: '/designed/collection/peach-editorial.webp', description: 'An expressive peach editorial cover with large serif typography and two independent journal views.' },
  { id: NEXT_STAGE.id, version: NEXT_STAGE.version, name: NEXT_STAGE.name, tier: NEXT_STAGE.tier, width: NEXT_STAGE.canvas.width, height: NEXT_STAGE.canvas.height, thumbnail: '/designed/collection/next-stage.webp', description: 'Oversized acid-lime typography on black with two overlapping, independently editable phone screens.' },
  ...SCENE_TEMPLATES.map(({ blueprint, scene }) => ({ id: blueprint.id, version: blueprint.version, name: blueprint.name, tier: blueprint.tier, width: blueprint.canvas.width, height: blueprint.canvas.height,
    thumbnail: blueprint.examples.main.src, scene, description: 'Scene · Replace the screenshot and edit the title and subtitle. Canvas size, background and placement are ready.' })),
];
export const getCuratedTemplate = (id: string) => CURATED_TEMPLATE_CATALOG.find(template => template.id === id);
export const isCuratedTemplateAvailable = (id: string): id is CuratedTemplateId => !!getCuratedTemplate(id);
