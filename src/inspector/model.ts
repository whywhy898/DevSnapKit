import type { CompositionDocument } from '../composition/types';
import type { CanvasTextDocument } from '../text/types';
import type { TemplateContext } from '../templates/types';

export function inspectorTabFor(id: string, texts: CanvasTextDocument, doc: CompositionDocument | null) {
  if (id === 'main' || id === 'secondary') return 'style' as const;
  if (texts.layers.some(layer => layer.id === id)) return 'text' as const;
  const node = [...(doc?.objects || []), ...(doc?.decorations || [])].find(node => node.id === id);
  return node?.kind === 'shape' && node.shape === 'mark' ? 'brand' as const : 'text' as const;
}

export function resolveImageSlots(doc: CompositionDocument | null, layout: 'single' | 'duo', main: string, secondary: string | null) {
  const detail = doc?.mediaLayout === 'independent' ? doc.detailVisible : layout === 'duo';
  return [{ id: 'main' as const, label: 'Image 1', loaded: Boolean(main) }, ...(detail ? [{ id: 'secondary' as const, label: 'Image 2', loaded: Boolean(secondary) }] : [])];
}

export function elementItems(doc: CompositionDocument | null, texts: CanvasTextDocument, context: Pick<TemplateContext, 'textRoles'> | null) {
  const nodes = [...(doc?.objects || []), ...(doc?.decorations || [])];
  const ids = [...new Set([...(doc?.order || ['main']), ...(doc ? ['main', 'secondary'] : []), ...texts.layers.map(layer => layer.id), ...nodes.map(node => node.id)])];
  return ids.filter(id => id === 'main' || id === 'secondary' || texts.layers.some(layer => layer.id === id) || nodes.some(node => node.id === id)).map(id => {
    const text = texts.layers.find(layer => layer.id === id), node = nodes.find(item => item.id === id);
    const role = text && Object.entries(context?.textRoles || {}).find(([, value]) => value === id)?.[0];
    const label = id === 'main' ? 'Image 1' : id === 'secondary' ? 'Image 2' : text ? role ? role.charAt(0).toUpperCase() + role.slice(1).replace(/[-_]/g, ' ') : 'Text' : node?.name || 'Element';
    const content = text?.content || '';
    return { id, label, preview: Array.from(content.replace(/\s+/g, ' ')).slice(0, 24).join(''), title: content ? `${label}: ${content}` : label, selectionLabel: `Select ${label}${content ? `: ${content}` : ''}`,
      hidden: Boolean(doc?.hiddenIds.includes(id) || (id === 'secondary' && !doc?.detailVisible)), reorderable: Boolean(doc?.order.includes(id)) };
  });
}
