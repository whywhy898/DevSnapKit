import { canUse } from '../../../shared/productCapabilities';
import { getCuratedTemplate } from './catalog';

/** Application-only admission: saved documents and history never use this gate. */
export function canApplyCuratedTemplate(id: string, isProUnlocked: boolean): boolean {
  const template = getCuratedTemplate(id);
  return Boolean(template && (template.tier === 'free' || canUse('premium_templates', isProUnlocked)));
}
