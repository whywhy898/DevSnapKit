import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';

let dialogCount = 0;
let returnFocus: HTMLElement | null = null;
let focusGeneration = 0;

/** One keyboard/focus policy for editor dialogs, including dialog-to-dialog flows. */
export function Modal({ onClose, onClick, children, ...props }: HTMLAttributes<HTMLDivElement> & { onClose: () => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  // Capture before descendant autofocus and preserve it across effect replay.
  const opener = useRef(typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  useLayoutEffect(() => {
    const node = root.current!;
    const previousFocus = opener.current;
    // A fresh opener wins over an earlier close's pending animation frame.
    // Keep the original opener when one dialog hands off directly to another.
    if (!dialogCount && (!returnFocus || (previousFocus?.isConnected && previousFocus !== document.body && !previousFocus.closest('[data-app-dialog]')))) returnFocus = previousFocus;
    dialogCount++;
    focusGeneration++;
    const focusable = () => Array.from(node.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], iframe, [tabindex]'))
      .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length > 0);
    (node.querySelector<HTMLElement>('[data-modal-close]') ?? focusable()[0] ?? node).focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[data-app-dialog]');
      if (dialogs[dialogs.length - 1] !== node) return;
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault(); event.stopImmediatePropagation(); close.current();
      } else if (event.key === 'Tab') {
        const controls = focusable(), first = controls[0] ?? node, last = controls[controls.length - 1] ?? node;
        if (!node.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      dialogCount--;
      const closingGeneration = ++focusGeneration;
      requestAnimationFrame(() => {
        if (closingGeneration !== focusGeneration) return;
        const remaining = Array.from(document.querySelectorAll<HTMLElement>('[data-app-dialog]')).at(-1);
        if (remaining) {
          if (previousFocus?.isConnected && remaining.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
          else if (!remaining.contains(document.activeElement)) (remaining.querySelector<HTMLElement>('[data-modal-close]') ?? remaining).focus({ preventScroll: true });
          return;
        }
        const target = returnFocus?.isConnected && returnFocus !== document.body ? returnFocus : document.querySelector<HTMLElement>('[data-canvas-toolbar] button');
        target?.focus({ preventScroll: true }); returnFocus = null;
      });
    };
  }, []);
  return <div {...props} ref={root} role="dialog" aria-modal="true" data-app-dialog tabIndex={-1} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && event.target === event.currentTarget) close.current();
  }}>{children}</div>;
}
