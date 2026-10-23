export interface PixelImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
export interface MaskData {
  width: number;
  height: number;
  encoding: 'rle8';
  data: string;
}
export interface Point {
  x: number;
  y: number;
}
export interface Adjustment {
  mode: 'replace' | 'tint' | 'adjust';
  color: string;
  intensity: number;
  hue: number;
  saturation: number;
  brightness: number;
  contrast: number;
  opacity: number;
  grayscale: boolean;
}
export interface Pattern {
  kind: 'none' | 'dots' | 'stripes' | 'plaid' | 'diamonds' | 'texture' | 'gradient';
  color: string;
  secondary: string;
  scale: number;
  angle: number;
  opacity: number;
  blend: 'normal' | 'multiply' | 'screen';
}
export interface Region {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  mask: MaskData;
  adjustment: Adjustment;
  pattern?: Pattern;
  paletteAdjustment?: Adjustment;
  palette?: { source: string[]; target: string[] };
  operation?: 'color' | 'erase' | 'restore' | 'clone' | 'repair';
  offset?: Point;
  stage?: 'before-effects' | 'after-effects';
}
export interface RasterEffect {
  id: string;
  enabled: boolean;
  kind:
    | 'sticker'
    | 'coloring'
    | 'outline'
    | 'shadow'
    | 'inner-shadow'
    | 'glow'
    | 'blur'
    | 'sharpen'
    | 'balance'
    | 'emboss';
  amount: number;
  radius: number;
  color: string;
  x: number;
  y: number;
  detail: number;
  smooth: number;
  cut: boolean;
}
export interface Typography {
  layout: 'straight' | 'arc' | 'circle';
  radius: number;
  spacing: number;
  lineHeight: number;
  stroke: string;
  strokeWidth: number;
  shadow: boolean;
  font: 'sans' | 'serif' | 'mono';
}
export const defaultAdjustment = (): Adjustment => ({
  mode: 'replace',
  color: '#326acb',
  intensity: 1,
  hue: 0,
  saturation: 0,
  brightness: 0,
  contrast: 0,
  opacity: 1,
  grayscale: false,
});
export const defaultPattern = (): Pattern => ({
  kind: 'none',
  color: '#326acb',
  secondary: '#ffffff',
  scale: 40,
  angle: 0,
  opacity: 0.6,
  blend: 'multiply',
});
export const defaultEffect = (kind: RasterEffect['kind']): RasterEffect => ({
  id: '',
  kind,
  enabled: true,
  amount: 0.6,
  radius: 10,
  color: kind === 'sticker' || kind === 'glow' ? '#ffffff' : '#15233b',
  x: 8,
  y: 8,
  detail: 0.15,
  smooth: 2,
  cut: false,
});
