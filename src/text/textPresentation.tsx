import type { CSSProperties } from 'react';
import type { CanvasTextLayer, TextFont } from './types';

export const textFontFamily = (font: TextFont) => font === 'manrope' ? 'Poster Manrope' : 'Poster Gelasio';
/** One logical-pixel style for artwork, hit boxes, editing mirrors and measurement. */
export function textLayoutStyle(layer: CanvasTextLayer): CSSProperties {
  return { fontFamily: `"${textFontFamily(layer.font)}"`, fontSize: layer.fontSize, fontWeight: layer.weight,
    fontStyle: layer.italic ? 'italic' : 'normal', fontSynthesis: 'none', lineHeight: layer.lineHeight ?? 1.25, color: layer.color,
    textAlign: layer.align, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'normal',
    letterSpacing: layer.letterSpacing ?? 'normal', textTransform: layer.textTransform ?? 'none',
    padding: 0, margin: 0, border: 0, boxSizing: 'border-box' };
}
export function TextRunContent({ layer, marker = false }: { layer: CanvasTextLayer; marker?: boolean }) {
  return <>{layer.runs ? layer.runs.map((run, index) => <span key={index} data-text-run style={{
    fontFamily: run.font ? `"${textFontFamily(run.font)}"` : undefined,
    fontWeight: run.weight, fontStyle: run.italic === undefined ? undefined : run.italic ? 'italic' : 'normal',
    color: run.color, backgroundColor: run.highlightColor, boxDecorationBreak: run.highlightColor ? 'clone' : undefined,
  }}>{run.text}</span>) : layer.content}{marker && (layer.content.endsWith('\n') || !layer.content) ? '\u200b' : null}</>;
}
