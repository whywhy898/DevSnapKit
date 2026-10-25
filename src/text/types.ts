export type TextFont = 'manrope' | 'gelasio';
export interface TextRunStyle {
  font?: TextFont;
  weight?: 400 | 600 | 700 | 800;
  italic?: boolean;
  color?: string;
  highlightColor?: string;
}
/** Finite inline styling; text is literal, never HTML. */
export interface TextRun extends TextRunStyle { text: string }
/** Replacement interval in pre-edit UTF-16 textarea offsets; never serialized. */
export interface TextReplacementRange { start: number; end: number }
export interface CanvasTextLayer {
  id: string;
  content: string;
  centerX: number;
  centerY: number;
  widthRatio: number;
  font: TextFont;
  fontSize: number;
  weight: 400 | 600 | 700 | 800;
  italic: boolean;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight?: number;
  /** Tracking in logical canvas pixels. */
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase';
  /** Authoritative when present; content is its validated plain-text projection. */
  runs?: readonly TextRun[];
}
export interface CanvasTextDocument { version: 1; layers: CanvasTextLayer[] }
export interface TextCanvasSize { width: number; height: number }
