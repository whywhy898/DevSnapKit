import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject, PointerEvent, KeyboardEvent } from 'react';

type Box = { left: number; top: number; width: number; height: number };
/** The textarea owns editing; actual rendered text owns rich caret/selection geometry. */
export function useRichTextSelection(input: RefObject<HTMLTextAreaElement>, mirror: RefObject<HTMLDivElement>, enabled: boolean, value: string, revision: unknown) {
  const [selection, setSelection] = useState({ start: 0, end: value.length, direction: 'none' });
  const [boxes, setBoxes] = useState<{ caret: Box | null; selection: Box[] }>({ caret: null, selection: [] });
  const drag = useRef<{ pointer: number; anchor: number } | null>(null);
  const sync = () => { const node = input.current; if (node) setSelection({ start: node.selectionStart, end: node.selectionEnd, direction: node.selectionDirection }); };
  useLayoutEffect(() => {
    const node = input.current; if (!enabled || !node) return;
    node.addEventListener('select', sync); node.addEventListener('selectionchange', sync);
    return () => { node.removeEventListener('select', sync); node.removeEventListener('selectionchange', sync); };
  }, [enabled]);
  const position = (offset: number) => {
    const node = mirror.current; if (!node) return null;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let text: Node | null, last: Node = node, remaining = offset;
    while ((text = walker.nextNode())) {
      last = text; if (remaining <= (text.textContent?.length ?? 0)) return { node: text, offset: remaining };
      remaining -= text.textContent?.length ?? 0;
    }
    return { node: last, offset: last.textContent?.length ?? 0 };
  };
  const rangeAt = (start: number, end = start) => {
    const a = position(start), b = position(end); if (!a || !b) return null;
    const range = document.createRange(); range.setStart(a.node, a.offset); range.setEnd(b.node, b.offset); return range;
  };
  useLayoutEffect(() => {
    const node = mirror.current; if (!enabled || !node) return;
    const bounds = node.getBoundingClientRect(), scale = bounds.width / node.offsetWidth || 1;
    const box = (rect: DOMRect): Box => ({ left: (rect.left - bounds.left) / scale, top: (rect.top - bounds.top) / scale, width: rect.width / scale, height: rect.height / scale });
    const caret = rangeAt(selection.direction === 'backward' ? selection.start : selection.end)?.getClientRects()[0];
    const selected = selection.start === selection.end ? [] : Array.from(rangeAt(selection.start, selection.end)?.getClientRects() ?? []).filter(rect => rect.width > 0).map(box);
    setBoxes({ caret: caret ? box(caret) : null, selection: selected });
  }, [enabled, value, revision, selection]);
  const hit = (x: number, y: number) => {
    const node = mirror.current; if (!node) return 0;
    const bounds = node.getBoundingClientRect();
    x = Math.max(bounds.left + .1, Math.min(bounds.right - .1, x)); y = Math.max(bounds.top + .1, Math.min(bounds.bottom - .1, y));
    const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null; caretRangeFromPoint?: (x: number, y: number) => Range | null };
    const point = doc.caretPositionFromPoint?.(x, y), range = point ? null : doc.caretRangeFromPoint?.(x, y);
    const target = point?.offsetNode ?? range?.startContainer, offset = point?.offset ?? range?.startOffset;
    if (!target || offset === undefined || !node.contains(target)) return selection.end;
    const prefix = document.createRange(); prefix.selectNodeContents(node); prefix.setEnd(target, offset);
    const at = Math.min(value.length, prefix.toString().length);
    // Never place a textarea selection between the halves of a surrogate pair.
    return at > 0 && /[\uD800-\uDBFF]/.test(value[at - 1]) && /[\uDC00-\uDFFF]/.test(value[at] ?? '') ? at + 1 : at;
  };
  const choose = (anchor: number, focus: number) => {
    input.current?.setSelectionRange(Math.min(anchor, focus), Math.max(anchor, focus), focus < anchor ? 'backward' : 'forward'); sync();
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const at = hit(event.clientX, event.clientY), node = input.current;
    const anchor = event.shiftKey ? node?.selectionDirection === 'backward' ? node.selectionEnd : node?.selectionStart ?? selection.start : at;
    input.current?.focus({ preventScroll: true }); choose(anchor, at);
    drag.current = { pointer: event.pointerId, anchor }; event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointer === event.pointerId) choose(drag.current.anchor, hit(event.clientX, event.clientY));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!enabled || event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const node = mirror.current, inputNode = input.current; if (!node || !inputNode) return;
    const focus = inputNode.selectionDirection === 'backward' ? inputNode.selectionStart : inputNode.selectionEnd;
    const rect = rangeAt(focus)?.getClientRects()[0]; if (!rect) return;
    event.preventDefault();
    const bounds = node.getBoundingClientRect(), scale = bounds.width / node.offsetWidth || 1;
    const lineHeight = parseFloat(getComputedStyle(node).lineHeight) * scale;
    const x = event.key === 'Home' ? bounds.left + 1 : event.key === 'End' ? bounds.right - 1 : rect.left;
    const y = rect.top + rect.height / 2 + (event.key === 'ArrowUp' ? -lineHeight : event.key === 'ArrowDown' ? lineHeight : 0);
    const at = hit(x, y), anchor = event.shiftKey ? inputNode.selectionDirection === 'backward' ? inputNode.selectionEnd : inputNode.selectionStart : at;
    choose(anchor, at);
  };
  return { ...boxes, sync, onPointerDown, onPointerMove, onPointerUp, onKeyDown };
}
