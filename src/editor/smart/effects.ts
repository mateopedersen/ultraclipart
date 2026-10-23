import { effectPadding } from './padding';
import type { PixelImage, RasterEffect, Region } from './types';
import { blurMask, morphology, hexRgb, adjustPixels } from './pixels';
const clamp = (v: number) => Math.max(0, Math.min(255, v));
function alphaOf(image: PixelImage) {
  return Uint8Array.from({ length: image.width * image.height }, (_, i) => image.data[i * 4 + 3]);
}
function blurred(image: PixelImage, radius: number): PixelImage {
  const { width: w, height: h } = image,
    output = new Uint8ClampedArray(image.data.length);
  const alpha = blurMask(alphaOf(image), w, h, radius);
  for (let c = 0; c < 3; c++) {
    const channel = Uint8Array.from({ length: w * h }, (_, i) =>
      Math.round((image.data[i * 4 + c] * image.data[i * 4 + 3]) / 255),
    );
    const smooth = blurMask(channel, w, h, radius);
    for (let i = 0; i < w * h; i++)
      output[i * 4 + c] = alpha[i] ? clamp((smooth[i] * 255) / alpha[i]) : 0;
  }
  for (let i = 0; i < w * h; i++) output[i * 4 + 3] = alpha[i];
  return { width: w, height: h, data: output };
}
function behind(
  image: PixelImage,
  mask: Uint8Array,
  color: string,
  opacity: number,
  dx = 0,
  dy = 0,
): PixelImage {
  const { width: w, height: h } = image,
    data = image.data.slice(),
    rgb = hexRgb(color);
  dx = Math.round(dx);
  dy = Math.round(dy);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        p = i * 4,
        sx = x - dx,
        sy = y - dy;
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const a = data[p + 3] / 255,
        b = (mask[sy * w + sx] / 255) * opacity * (1 - a),
        sum = a + b;
      if (sum) for (let c = 0; c < 3; c++) data[p + c] = (data[p + c] * a + rgb[c] * b) / sum;
      data[p + 3] = sum * 255;
    }
  return { width: w, height: h, data };
}
export function applyEffects(source: PixelImage, effects: RasterEffect[]): PixelImage {
  let image = source;
  for (const e of effects) {
    if (!e.enabled) continue;
    const { width: w, height: h } = image;
    if (e.kind === 'blur') {
      image = blurred(image, e.radius);
      continue;
    }
    if (['sticker', 'outline', 'glow', 'shadow'].includes(e.kind)) {
      let mask = morphology(alphaOf(image), w, h, e.radius, true);
      if (e.kind === 'glow' || e.kind === 'shadow' || e.smooth)
        mask = blurMask(
          mask,
          w,
          h,
          e.kind === 'glow' || e.kind === 'shadow' ? Math.max(1, e.radius) : e.smooth,
        );
      if (e.kind === 'sticker' && e.amount > 0)
        image = behind(
          image,
          blurMask(mask, w, h, Math.max(1, e.radius * 0.6)),
          '#15233b',
          e.amount * 0.5,
          e.x,
          e.y,
        );
      image = behind(
        image,
        mask,
        e.color,
        e.kind === 'sticker' || e.kind === 'outline' ? 1 : e.amount,
        e.kind === 'shadow' ? e.x : 0,
        e.kind === 'shadow' ? e.y : 0,
      );
      if (e.cut) {
        const edge = morphology(mask, w, h, 1, true),
          inside = morphology(mask, w, h, 1, false),
          data = image.data.slice();
        for (let i = 0; i < mask.length; i++)
          if (edge[i] - inside[i] > 80) {
            const p = i * 4;
            data[p] = data[p + 1] = data[p + 2] = 70;
            data[p + 3] = 255;
          }
        image = { width: w, height: h, data };
      }
      continue;
    }
    const data = image.data.slice();
    if (e.kind === 'coloring') {
      const gray = Uint8Array.from({ length: w * h }, (_, i) => {
        const p = i * 4;
        return (
          ((image.data[p] * 0.2126 + image.data[p + 1] * 0.7152 + image.data[p + 2] * 0.0722) *
            image.data[p + 3]) /
            255 +
          255 -
          image.data[p + 3]
        );
      });
      const smooth = blurMask(gray, w, h, e.smooth),
        lines = new Uint8Array(w * h),
        threshold = 15 + e.detail * 180;
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x,
            gx =
              -smooth[i - w - 1] +
              smooth[i - w + 1] -
              2 * smooth[i - 1] +
              2 * smooth[i + 1] -
              smooth[i + w - 1] +
              smooth[i + w + 1],
            gy =
              -smooth[i - w - 1] -
              2 * smooth[i - w] -
              smooth[i - w + 1] +
              smooth[i + w - 1] +
              2 * smooth[i + w] +
              smooth[i + w + 1];
          lines[i] = Math.hypot(gx, gy) > threshold || smooth[i] < 35 ? 255 : 0;
        }
      const thick = morphology(lines, w, h, Math.min(8, e.radius), true);
      for (let i = 0; i < w * h; i++) {
        const p = i * 4;
        data[p] = data[p + 1] = data[p + 2] = 255 - thick[i];
        data[p + 3] = image.data[p + 3];
      }
    } else if (e.kind === 'inner-shadow') {
      const inv = alphaOf(image).map((v) => 255 - v),
        soft = blurMask(inv, w, h, e.radius),
        color = hexRgb(e.color);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = y * w + x,
            p = i * 4,
            sx = Math.max(0, Math.min(w - 1, Math.round(x - e.x))),
            sy = Math.max(0, Math.min(h - 1, Math.round(y - e.y))),
            t = (soft[sy * w + sx] / 255) * e.amount;
          for (let c = 0; c < 3; c++) data[p + c] = data[p + c] * (1 - t) + color[c] * t;
        }
    } else if (e.kind === 'balance') {
      const color = hexRgb(e.color);
      for (let i = 0; i < data.length; i += 4)
        for (let c = 0; c < 3; c++) data[i + c] = clamp(data[i + c] + (color[c] - 128) * e.amount);
    } else {
      const soft = blurred(image, Math.max(1, Math.min(8, e.radius)));
      for (let i = 0; i < w * h; i++) {
        const p = i * 4;
        for (let c = 0; c < 3; c++) {
          if (e.kind === 'sharpen')
            data[p + c] = clamp(data[p + c] + (data[p + c] - soft.data[p + c]) * e.amount * 3);
          else {
            const q = (Math.max(0, Math.floor(i / w) - 1) * w + Math.max(0, (i % w) - 1)) * 4;
            data[p + c] = clamp(data[p + c] + (image.data[p + c] - image.data[q + c]) * e.amount);
          }
        }
      }
    }
    image = { width: w, height: h, data };
  }
  return image;
}
export function inspectImage(image: PixelImage, printWidthInches: number) {
  const { width: w, height: h, data } = image;
  let transparent = 0,
    partial = 0,
    isolated = 0,
    minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3];
    if (!a) {
      transparent++;
      continue;
    }
    const x = i % w,
      y = Math.floor(i / w);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    if (a < 255) partial++;
    if (
      x > 0 &&
      x < w - 1 &&
      y > 0 &&
      y < h - 1 &&
      a < 128 &&
      [i - 1, i + 1, i - w, i + w].every((p) => data[p * 4 + 3] === 0)
    )
      isolated++;
  }
  const occupied = maxX < 0 ? 0 : (maxX - minX + 1) * (maxY - minY + 1);
  return {
    width: w,
    height: h,
    effectivePpi: Math.round(w / Math.max(0.01, printWidthInches)),
    transparentPercent: Math.round((100 * transparent) / (w * h)),
    partialPixels: partial,
    isolatedPixels: isolated,
    emptyMarginPercent: Math.round(100 * (1 - occupied / (w * h))),
    bounds: {
      x: minX,
      y: minY,
      width: Math.max(0, maxX - minX + 1),
      height: Math.max(0, maxY - minY + 1),
    },
  };
}
/** Quantized frequency palette. No external model or upload. */
export function palette(image: PixelImage, mask?: Uint8Array): string[] {
  const bins = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < image.width * image.height; i += 3) {
    const p = i * 4;
    if (image.data[p + 3] < 128 || (mask && !mask[i])) continue;
    const r = image.data[p],
      g = image.data[p + 1],
      b = image.data[p + 2],
      key = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5),
      bin = bins.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bin.count++;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bins.set(key, bin);
  }
  return [...bins.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(
      (v) =>
        '#' +
        [v.r, v.g, v.b]
          .map((n) =>
            Math.round(n / v.count)
              .toString(16)
              .padStart(2, '0'),
          )
          .join(''),
    );
}

/** Corrections to coloring pages run after line generation so erasing cannot create new outlines. */
export function renderPixels(
  source: PixelImage,
  regions: Region[],
  effects: RasterEffect[],
): PixelImage {
  const pad = effectPadding(effects),
    adjusted = adjustPixels(
      source,
      regions.filter((r) => r.stage !== 'after-effects'),
    );
  let padded = adjusted;
  if (pad) {
    const width = source.width + pad * 2,
      height = source.height + pad * 2,
      data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < source.height; y++)
      data.set(
        adjusted.data.subarray(y * source.width * 4, (y + 1) * source.width * 4),
        ((y + pad) * width + pad) * 4,
      );
    padded = { width, height, data };
  }
  const base = applyEffects(padded, effects),
    corrections = regions.filter((r) => r.stage === 'after-effects');
  if (!corrections.length) return base;
  if (!pad) return adjustPixels(base, corrections);
  const crop = {
    width: source.width,
    height: source.height,
    data: new Uint8ClampedArray(source.data.length),
  };
  for (let y = 0; y < source.height; y++)
    crop.data.set(
      base.data.subarray(
        ((y + pad) * base.width + pad) * 4,
        ((y + pad) * base.width + pad + source.width) * 4,
      ),
      y * source.width * 4,
    );
  const fixed = adjustPixels(crop, corrections);
  for (let y = 0; y < source.height; y++)
    base.data.set(
      fixed.data.subarray(y * source.width * 4, (y + 1) * source.width * 4),
      ((y + pad) * base.width + pad) * 4,
    );
  return base;
}

export type Inspection = ReturnType<typeof inspectImage>;
