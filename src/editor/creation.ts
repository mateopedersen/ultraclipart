import type { EditorDocument, VectorLayer } from './model';

export const shapeNames = {
  rectangle: 'Rectangle',
  rounded: 'Rounded rectangle',
  ellipse: 'Ellipse',
  star: 'Star',
  polygon: 'Polygon',
  line: 'Line',
  bubble: 'Speech bubble',
  heart: 'Heart',
} as const;
export type ShapeKind = keyof typeof shapeNames;
export interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
}
export interface ShapeOptions extends ShapeStyle {
  width: number;
  height: number;
  sides: number;
  rounding: number;
}
export interface DrawPoint {
  x: number;
  y: number;
}
const number = (value: number) => String(Math.round(value * 100) / 100);
function finiteRange(value: number, min: number, max: number, name: string) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`${name} must be between ${min} and ${max}.`);
  return value;
}
export function paintAttributes(style: ShapeStyle): string {
  for (const color of [style.fill, style.stroke])
    if (color !== 'none' && !/^#[0-9a-f]{6}$/i.test(color))
      throw new Error('Choose a valid fill and stroke color.');
  finiteRange(style.strokeWidth, 0, 100, 'Stroke width');
  if (style.fill === 'none' && (style.stroke === 'none' || style.strokeWidth === 0))
    throw new Error('Give the shape a fill or a visible stroke.');
  return `fill="${style.fill}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;
}
export function blankDocument(artId: string, width = 800, height = 800): EditorDocument {
  finiteRange(width, 64, 4096, 'Canvas width');
  finiteRange(height, 64, 4096, 'Canvas height');
  return {
    version: 1,
    artId,
    width,
    height,
    background: 'transparent',
    layers: [],
    crop: null,
    print: { paper: 'letter', orientation: 'portrait', margin: 0.5, scale: 'fit' },
  };
}
export function shapeMarkup(kind: ShapeKind, options: ShapeOptions): string {
  if (!(kind in shapeNames)) throw new Error('Choose a supported shape.');
  const w = finiteRange(options.width, 4, 4096, 'Shape width'),
    h = finiteRange(options.height, 4, 4096, 'Shape height');
  const sides = Math.round(finiteRange(options.sides, 3, 12, 'Points or sides'));
  const round = finiteRange(options.rounding, 0, 50, 'Corner roundness') / 100;
  const attrs = paintAttributes(kind === 'line' ? { ...options, fill: 'none' } : options);
  const path = (d: string) => `<path ${attrs} d="${d}"/>`;
  if (kind === 'rectangle' || kind === 'rounded')
    return `<rect ${attrs} width="${w}" height="${h}" rx="${kind === 'rounded' ? number(Math.min(w, h) * round) : 0}"/>`;
  if (kind === 'ellipse')
    return `<ellipse ${attrs} cx="${number(w / 2)}" cy="${number(h / 2)}" rx="${number(w / 2)}" ry="${number(h / 2)}"/>`;
  if (kind === 'line') return `<line ${attrs} x1="0" y1="${number(h)}" x2="${number(w)}" y2="0"/>`;
  if (kind === 'star' || kind === 'polygon') {
    const count = kind === 'star' ? sides * 2 : sides;
    const points = Array.from({ length: count }, (_, i) => {
      const angle = (i * Math.PI * 2) / count - Math.PI / 2,
        radius = kind === 'star' && i % 2 ? 0.46 : 1;
      return `${number(w / 2 + ((Math.cos(angle) * w) / 2) * radius)},${number(h / 2 + ((Math.sin(angle) * h) / 2) * radius)}`;
    }).join(' ');
    return `<polygon ${attrs} points="${points}"/>`;
  }
  const p = (x: number, y: number) => `${number(x * w)} ${number(y * h)}`;
  if (kind === 'heart')
    return path(
      `M${p(0.5, 0.96)} C${p(0.38, 0.83)} ${p(0.02, 0.55)} ${p(0.02, 0.29)} C${p(0.02, 0.03)} ${p(0.35, -0.02)} ${p(0.5, 0.22)} C${p(0.65, -0.02)} ${p(0.98, 0.03)} ${p(0.98, 0.29)} C${p(0.98, 0.55)} ${p(0.62, 0.83)} ${p(0.5, 0.96)} Z`,
    );
  return path(
    `M${p(0.14, 0.04)} L${p(0.86, 0.04)} Q${p(0.98, 0.04)} ${p(0.98, 0.18)} L${p(0.98, 0.64)} Q${p(0.98, 0.78)} ${p(0.86, 0.78)} L${p(0.45, 0.78)} L${p(0.2, 0.98)} L${p(0.25, 0.78)} L${p(0.14, 0.78)} Q${p(0.02, 0.78)} ${p(0.02, 0.64)} L${p(0.02, 0.18)} Q${p(0.02, 0.04)} ${p(0.14, 0.04)} Z`,
  );
}
export function vectorLayer(id: string, label: string, markup: string, x = 0, y = 0): VectorLayer {
  return {
    kind: 'vector',
    id,
    label,
    markup,
    visible: true,
    locked: false,
    opacity: 1,
    x,
    y,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
  };
}
/** Bounded Catmull–Rom interpolation gives a native, editable cubic path, without raster tracing. */
export function freehandPath(points: DrawPoint[]): string {
  if (points.length < 2 || points.length > 2000)
    throw new Error('A stroke needs 2 to 2,000 points.');
  if (
    points.some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        Math.abs(p.x) > 10000 ||
        Math.abs(p.y) > 10000,
    )
  )
    throw new Error('The drawing contains an invalid coordinate.');
  const p = (point: DrawPoint) => `${number(point.x)} ${number(point.y)}`;
  let d = `M${p(points[0])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)],
      b = points[i],
      c = points[i + 1],
      e = points[Math.min(points.length - 1, i + 2)];
    d += ` C${p({ x: b.x + (c.x - a.x) / 6, y: b.y + (c.y - a.y) / 6 })} ${p({ x: c.x - (e.x - b.x) / 6, y: c.y - (e.y - b.y) / 6 })} ${p(c)}`;
  }
  return d;
}
