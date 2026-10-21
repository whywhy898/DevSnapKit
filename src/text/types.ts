export type TextFont = 'manrope' | 'gelasio';
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
}
export interface CanvasTextDocument { version: 1; layers: CanvasTextLayer[] }
export interface TextCanvasSize { width: number; height: number }
