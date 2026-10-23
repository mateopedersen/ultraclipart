import type { RasterEffect } from './types';
/** Extra pixels around effects; source coordinates and masks never change. */
export function effectPadding(effects: RasterEffect[] = []): number {
  return Math.min(
    256,
    effects
      .filter((e) => e.enabled)
      .reduce(
        (sum, e) =>
          sum +
          (['sticker', 'outline', 'glow', 'shadow', 'blur'].includes(e.kind)
            ? Math.ceil(e.radius * 2 + e.smooth + Math.max(Math.abs(e.x), Math.abs(e.y)) + 2)
            : 0),
        0,
      ),
  );
}
export function effectBounds(layer: { width: number; height: number; effects?: RasterEffect[] }) {
  const padding = effectPadding(layer.effects);
  return {
    x: -padding,
    y: -padding,
    width: layer.width + padding * 2,
    height: layer.height + padding * 2,
  };
}
