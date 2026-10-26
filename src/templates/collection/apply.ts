import type { EditorSnapshot } from '../../useHistory';
import { buildDesignedSnapshot, restoreDesignedLayout, resetDesignedStyles } from '../../composition/designedCatalog';
import { createIndependentComposition } from '../../composition/document';
import { validateText } from '../../text/document';
import type { ObjectFrame } from '../../composition/types';
import { PAPER_LAUNCH_DUO, PAPER_BRAND_MARK } from './definitions/paper-launch-duo';
import { NIGHT_SIGNAL_DUO, NIGHT_BRAND_MARK } from './definitions/night-signal-duo';
import { POCKET_FLOW_DUO, POCKET_BRAND_MARK } from './definitions/pocket-flow-duo';
import { CALM_SPLIT, CALM_BRAND_MARK } from './definitions/calm-split';

const templates = [
  { blueprint: PAPER_LAUNCH_DUO, brandMark: PAPER_BRAND_MARK, background: '#F6F3EC' },
  { blueprint: CALM_SPLIT, brandMark: CALM_BRAND_MARK, background: '#EEF2EE' },
  { blueprint: NIGHT_SIGNAL_DUO, brandMark: NIGHT_BRAND_MARK, background: '#101513' },
  { blueprint: POCKET_FLOW_DUO, brandMark: POCKET_BRAND_MARK, background: '#F4E4D6' },
];
const templateFor = (id: string | undefined) => templates.find(template => template.blueprint.id === id);
const blueprintFor = (id: string | undefined) => templateFor(id)?.blueprint;

export function buildCuratedSnapshot(before: EditorSnapshot, id: string, prefix: string): EditorSnapshot {
  if (id === 'editorial-honey') return buildDesignedSnapshot(before, id, prefix);
  const template = templateFor(id);
  if (!template) throw new Error('Unknown or unavailable curated template');
  const paper = template.blueprint;
  const replaceMain = !before.imageSrc || before.primaryMediaOrigin?.kind === 'builtin';
  const hiddenSecondary = before.compositionDocument?.detailVisible === false || !!before.compositionDocument?.hiddenIds.includes('secondary');
  const replaceSecondary = !hiddenSecondary && (before.secondarySrc ? before.secondaryMediaOrigin?.kind === 'builtin' : replaceMain);
  const imageSrc = replaceMain ? paper.examples.main.src : before.imageSrc;
  const secondarySrc = replaceSecondary ? paper.examples.secondary.src : before.secondarySrc;
  const layers = paper.text.map(({ role, layer }) => validateText({ ...structuredClone(layer), id: `${prefix}-${role}` }));
  const roles = Object.fromEntries(paper.text.map(({ role }) => [role, `${prefix}-${role}`]));
  return { ...before,
    textDocument: { version: 1, layers },
    templateContext: { id: paper.id, version: paper.version, mediaRegion: { x: 0, y: 0, width: 1, height: 1 }, textRoles: { headline: roles.headline, description: roles.description, ...roles } },
    compositionDocument: { ...createIndependentComposition(), templateId: paper.id, mediaLayout: 'independent', adaptiveMediaLayout: paper.singlePlacement ? 'auto' : 'manual',
      placements: structuredClone(paper.placements), ...(paper.singlePlacement ? { singlePlacement: structuredClone(paper.singlePlacement) } : {}), mediaPresentation: structuredClone(paper.mediaPresentation),
      detailVisible: !!imageSrc && !!secondarySrc && !hiddenSecondary, detailRadius: 12, detailBorder: 'none', detailShadow: '0 18px 36px #25281826',
      objects: structuredClone([paper.cta, template.brandMark]), decorations: structuredClone(paper.decorations),
      order: ['main', 'secondary', 'brand-mark', 'cta', ...layers.map(layer => layer.id)], knownTextIds: layers.map(layer => layer.id),
    },
    imageSrc, imageName: replaceMain ? paper.examples.main.name : before.imageName,
    primaryMediaOrigin: replaceMain ? { kind: 'builtin', sampleId: paper.examples.main.sampleId } : before.primaryMediaOrigin ?? { kind: 'unknown' },
    secondarySrc, secondaryName: replaceSecondary ? paper.examples.secondary.name : before.secondaryName,
    secondaryMediaOrigin: replaceSecondary ? { kind: 'builtin', sampleId: paper.examples.secondary.sampleId } : before.secondaryMediaOrigin ?? { kind: 'unknown' },
    aspectRatioId: 'custom', customCanvasSize: { ...paper.canvas }, bgType: 'solid', solidColor: template.background,
    windowTheme: 'browser', padding: 0, roundedCorners: 12, shadowLevel: 'soft', shadowOpacity: 35, hideMockup: false,
    layoutMode: 'single', duoLayout: 'side', layoutPreset: 'flat', cornerStyle: 'default',
    mockupZoom: 100, mockupOffsetX: 0, mockupOffsetY: 0, imageZoom: 100, imageOffsetX: 0, imageOffsetY: 0,
    vfxGlow: false, vfxNoise: false, bgImageSrc: null,
  };
}

export function restoreCuratedLayout(before: EditorSnapshot): EditorSnapshot {
  if (before.compositionDocument?.templateId === 'editorial-honey') return restoreDesignedLayout(before);
  const doc = before.compositionDocument;
  const paper = blueprintFor(doc?.templateId);
  if (!doc || !paper) return before;
  const defaults = buildCuratedSnapshot(before, paper.id, 'geometry');
  const target = defaults.compositionDocument!;
  const geometry = <T extends { id: string; frame: ObjectFrame }>(node: T): T => {
    const match = [...target.objects, ...target.decorations].find(item => item.id === node.id);
    return match ? { ...node, frame: { ...match.frame } } : node;
  };
  const roles: Record<string, string> = before.templateContext?.textRoles ?? {};
  return { ...before, aspectRatioId: 'custom', customCanvasSize: { ...paper.canvas }, layoutPreset: 'flat', mockupZoom: 100, mockupOffsetX: 0, mockupOffsetY: 0,
    compositionDocument: { ...doc, mediaLayout: 'independent', adaptiveMediaLayout: paper.singlePlacement ? 'auto' : 'manual', placements: structuredClone(paper.placements), ...(paper.singlePlacement ? { singlePlacement: structuredClone(paper.singlePlacement) } : {}), objects: doc.objects.map(geometry), decorations: doc.decorations.map(geometry) },
    textDocument: { ...before.textDocument, layers: before.textDocument.layers.map(layer => {
      const role = Object.keys(roles).find(role => roles[role] === layer.id), match = paper.text.find(text => text.role === role)?.layer;
      return match ? validateText({ ...layer, centerX: match.centerX, centerY: match.centerY, widthRatio: match.widthRatio }) : layer;
    }) },
  };
}

export function resetCuratedStyles(before: EditorSnapshot): EditorSnapshot {
  if (before.compositionDocument?.templateId === 'editorial-honey') return resetDesignedStyles(before);
  const doc = before.compositionDocument;
  const paper = blueprintFor(doc?.templateId);
  if (!doc || !paper) return before;
  const defaults = buildCuratedSnapshot(before, paper.id, 'style'), target = defaults.compositionDocument!;
  return { ...before, bgType: defaults.bgType, solidColor: defaults.solidColor, windowTheme: defaults.windowTheme, roundedCorners: defaults.roundedCorners,
    shadowLevel: defaults.shadowLevel, shadowOpacity: defaults.shadowOpacity, cornerStyle: defaults.cornerStyle, vfxGlow: false, vfxNoise: false, bgImageSrc: null,
    compositionDocument: { ...doc, mediaPresentation: structuredClone(target.mediaPresentation), detailFit: target.detailFit, detailAlign: target.detailAlign, detailRadius: target.detailRadius, detailBorder: target.detailBorder, detailShadow: target.detailShadow,
      objects: doc.objects.map(node => { const style = target.objects.find(item => item.id === node.id && item.kind === node.kind); return style ? { ...style, frame: node.frame, hidden: node.hidden, ...(node.kind === 'button' ? { text: node.text } : {}) } : node; }),
      decorations: doc.decorations.map(node => { const style = target.decorations.find(item => item.id === node.id); return style ? { ...style, frame: node.frame, hidden: node.hidden } : node; }),
    },
  };
}
