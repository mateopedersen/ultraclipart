import type { PixelImage, Point, MaskData, Region, Pattern } from './types';
const clamp = (v: number, low = 0, high = 1) => Math.max(low, Math.min(high, v));
const linear = Float32Array.from({ length: 256 }, (_, i) =>
  i / 255 <= 0.04045 ? i / 3294.6 : ((i / 255 + 0.055) / 1.055) ** 2.4,
);
export function toLab(r: number, g: number, b: number): [number, number, number] {
  const R = linear[r],
    G = linear[g],
    B = linear[b];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
export function fromLab(L: number, a: number, b: number): number[] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) =>
    Math.round(
      255 * clamp(v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055),
    ),
  );
}
export const hexRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export function assertImage(image: PixelImage) {
  if (
    ![image.width, image.height].every((v) => Number.isInteger(v) && v > 0 && v <= 4096) ||
    image.data.length !== image.width * image.height * 4
  )
    throw new Error('Invalid image dimensions.');
}
/** Run lengths and 8-bit coverage, never original pixel copies. Bounded on decode. */
export function encodeMask(mask: Uint8Array, width: number, height: number): MaskData {
  if (mask.length !== width * height) throw new Error('Mask dimensions do not match.');
  const bytes = new Uint8Array(mask.length * 2 + 4);
  let written = 0;
  for (let i = 0; i < mask.length;) {
    const value = mask[i];
    let end = i + 1;
    while (end < mask.length && mask[end] === value) end++;
    let n = end - i;
    while (n >= 128) {
      bytes[written++] = (n & 127) | 128;
      n >>>= 7;
    }
    bytes[written++] = n;
    bytes[written++] = value;
    i = end;
  }
  let binary = '';
  for (let i = 0; i < written; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(written, i + 8192)));
  return { width, height, encoding: 'rle8', data: btoa(binary) };
}
export function decodeMask(value: MaskData): Uint8Array {
  if (
    value.encoding !== 'rle8' ||
    ![value.width, value.height].every((v) => Number.isInteger(v) && v > 0 && v <= 4096) ||
    value.data.length > 24_000_000
  )
    throw new Error('Invalid mask.');
  const bytes = atob(value.data),
    output = new Uint8Array(value.width * value.height);
  let i = 0,
    offset = 0;
  while (i < bytes.length) {
    let n = 0,
      shift = 0,
      byte;
    do {
      if (i >= bytes.length || shift > 21) throw new Error('Invalid mask run.');
      byte = bytes.charCodeAt(i++);
      n += (byte & 127) * 2 ** shift;
      shift += 7;
    } while (byte & 128);
    if (n < 1 || offset + n > output.length || i >= bytes.length)
      throw new Error('Invalid mask size.');
    output.fill(bytes.charCodeAt(i++), offset, offset + n);
    offset += n;
  }
  if (offset !== output.length) throw new Error('Incomplete mask.');
  return output;
}
export interface SelectOptions {
  tolerance: number;
  contiguous: boolean;
  perceptual: boolean;
  connectivity: 4 | 8;
  smart: boolean;
}
export function selectRegion(image: PixelImage, point: Point, options: SelectOptions): Uint8Array {
  assertImage(image);
  const { width: w, height: h, data: d } = image,
    n = w * h,
    output = new Uint8Array(n);
  const x = Math.floor(point.x),
    y = Math.floor(point.y);
  if (x < 0 || y < 0 || x >= w || y >= h) return output;
  const start = y * w + x,
    s = start * 4;
  if (d[s + 3] < 8) return output;
  const seed = toLab(d[s], d[s + 1], d[s + 2]),
    tolerance = clamp(options.tolerance, 1, 100) / 100;
  const test = (p: number, previous: number) => {
    const j = p * 4;
    if (d[j + 3] < 8) return false;
    if (!options.perceptual)
      return (
        Math.hypot(d[j] - d[s], d[j + 1] - d[s + 1], d[j + 2] - d[s + 2]) / 441.673 <= tolerance
      );
    const lab = toLab(d[j], d[j + 1], d[j + 2]);
    const dist = Math.hypot(
      (lab[0] - seed[0]) * (options.smart ? 0.18 : 1),
      lab[1] - seed[1],
      lab[2] - seed[2],
    );
    if (dist > tolerance * (options.smart ? 0.4 : 0.5)) return false;
    if (options.smart && Math.hypot(seed[1], seed[2]) > 0.035) {
      if (Math.hypot(lab[1], lab[2]) < 0.018) return false;
      const hue = Math.atan2(lab[2], lab[1]) - Math.atan2(seed[2], seed[1]);
      if (
        Math.abs(Math.atan2(Math.sin(hue), Math.cos(hue))) >
        ((5 + tolerance * 30) * Math.PI) / 180
      )
        return false;
    }
    if (options.smart && previous >= 0) {
      const k = previous * 4;
      const edge =
        Math.abs(
          d[j] * 0.2126 +
            d[j + 1] * 0.7152 +
            d[j + 2] * 0.0722 -
            (d[k] * 0.2126 + d[k + 1] * 0.7152 + d[k + 2] * 0.0722),
        ) / 255;
      if (edge > Math.max(0.22, tolerance * 0.8)) return false;
    }
    return true;
  };
  if (!options.contiguous) {
    for (let p = 0; p < n; p++) if (test(p, -1)) output[p] = 255;
    return output;
  }
  const queue = new Int32Array(n),
    seen = new Uint8Array(n);
  let head = 0,
    tail = 1;
  queue[0] = start;
  seen[start] = 1;
  output[start] = 255;
  while (head < tail) {
    const p = queue[head++],
      px = p % w,
      py = Math.floor(p / w);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (
          (!dx && !dy) ||
          (options.connectivity === 4 && dx && dy) ||
          px + dx < 0 ||
          px + dx >= w ||
          py + dy < 0 ||
          py + dy >= h
        )
          continue;
        const q = p + dy * w + dx;
        if (seen[q]) continue;
        // Edge failures are directional; another connected neighbor may reach this pixel.
        if (test(q, p)) {
          seen[q] = 1;
          output[q] = 255;
          queue[tail++] = q;
        } else if (!options.smart) seen[q] = 1;
      }
  }
  return output;
}
export function combineMasks(
  a: Uint8Array,
  b: Uint8Array,
  mode: 'replace' | 'add' | 'subtract',
): Uint8Array {
  if (a.length !== b.length) throw new Error('Masks do not match.');
  if (mode === 'replace') return b.slice();
  const out = a.slice();
  for (let i = 0; i < a.length; i++)
    out[i] = mode === 'add' ? Math.max(a[i], b[i]) : Math.min(a[i], 255 - b[i]);
  return out;
}
export function brushMask(
  mask: Uint8Array,
  w: number,
  h: number,
  from: Point,
  to: Point,
  radius: number,
  hardness: number,
  erase = false,
) {
  radius = clamp(radius, 0.5, 256);
  hardness = clamp(hardness);
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / Math.max(1, radius * 0.25)),
  );
  for (let step = 0; step <= steps; step++) {
    const cx = from.x + ((to.x - from.x) * step) / steps,
      cy = from.y + ((to.y - from.y) * step) / steps;
    for (
      let y = Math.max(0, Math.floor(cy - radius));
      y <= Math.min(h - 1, Math.ceil(cy + radius));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(cx - radius));
        x <= Math.min(w - 1, Math.ceil(cx + radius));
        x++
      ) {
        const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / radius;
        if (distance > 1) continue;
        const coverage = Math.round(
            255 * (distance <= hardness ? 1 : (1 - distance) / Math.max(0.001, 1 - hardness)),
          ),
          p = y * w + x;
        mask[p] = erase ? Math.min(mask[p], 255 - coverage) : Math.max(mask[p], coverage);
      }
  }
}
export function polygonMask(points: Point[], w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  if (points.length < 3) return out;
  for (
    let y = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y))));
    y < Math.min(h, Math.ceil(Math.max(...points.map((p) => p.y))));
    y++
  ) {
    const xs: number[] = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i],
        b = points[j];
      if (a.y > y + 0.5 !== b.y > y + 0.5)
        xs.push(a.x + ((y + 0.5 - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2)
      for (
        let x = Math.max(0, Math.ceil(xs[i] - 0.5));
        x < Math.min(w, Math.ceil(xs[i + 1] - 0.5));
        x++
      )
        out[y * w + x] = 255;
  }
  return out;
}
/** Sliding-window box filter, linear cost independent of radius. */
export function blurMask(input: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const r = Math.max(0, Math.min(64, Math.round(radius)));
  if (!r) return input.slice();
  const temp = new Float32Array(input.length),
    out = new Uint8Array(input.length),
    span = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += input[y * w + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      temp[y * w + x] = sum / span;
      sum += input[y * w + clamp(x + r + 1, 0, w - 1)] - input[y * w + clamp(x - r, 0, w - 1)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += temp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = Math.round(sum / span);
      sum += temp[clamp(y + r + 1, 0, h - 1) * w + x] - temp[clamp(y - r, 0, h - 1) * w + x];
    }
  }
  return out;
}
export function morphology(
  input: Uint8Array,
  w: number,
  h: number,
  radius: number,
  grow: boolean,
): Uint8Array {
  // Separable extrema using a monotonic queue: O(width * height), not radius squared.
  const r = Math.min(64, Math.max(0, Math.round(radius)));
  if (!r) return input.slice();
  const temp = new Uint8Array(input.length),
    out = new Uint8Array(input.length);
  const pass = (
    src: Uint8Array,
    dst: Uint8Array,
    lines: number,
    length: number,
    stride: number,
    step: number,
  ) => {
    const queue = new Int32Array(length + 2 * r + 2);
    for (let line = 0; line < lines; line++) {
      let head = 0,
        tail = 0;
      const base = line * step;
      for (let k = -r; k < length + r; k++) {
        const v = k < 0 || k >= length ? 0 : src[base + k * stride];
        while (tail > head) {
          const q = queue[tail - 1],
            old = q < 0 || q >= length ? 0 : src[base + q * stride];
          if (grow ? old > v : old < v) break;
          tail--;
        }
        queue[tail++] = k;
        while (queue[head] < k - 2 * r) head++;
        if (k >= r) {
          const q = queue[head];
          dst[base + (k - r) * stride] = q < 0 || q >= length ? 0 : src[base + q * stride];
        }
      }
    }
  };
  pass(input, temp, h, w, 1, w);
  pass(temp, out, w, h, w, 1);
  return out;
}
export function fillHoles(input: Uint8Array, w: number, h: number): Uint8Array {
  const seen = new Uint8Array(input.length),
    queue = new Int32Array(input.length);
  let head = 0,
    tail = 0;
  const add = (p: number) => {
    if (!seen[p] && input[p] < 128) {
      seen[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    add(x);
    add((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    add(y * w);
    add(y * w + w - 1);
  }
  while (head < tail) {
    const p = queue[head++];
    if (p % w) add(p - 1);
    if (p % w < w - 1) add(p + 1);
    if (p >= w) add(p - w);
    if (p < input.length - w) add(p + w);
  }
  return input.map((v, i) => (seen[i] ? v : 255));
}
export function refineMask(
  input: Uint8Array,
  image: PixelImage,
  kind: string,
  radius: number,
): Uint8Array {
  const { width: w, height: h, data } = image;
  let result: Uint8Array;
  if (kind === 'grow' || kind === 'shrink')
    result = morphology(input, w, h, radius, kind === 'grow');
  else if (kind === 'holes') result = fillHoles(input, w, h);
  else if (kind === 'smooth')
    result = blurMask(input, w, h, radius).map((v) => (v >= 128 ? 255 : 0));
  else if (kind === 'edge') {
    const soft = blurMask(input, w, h, Math.max(1, radius));
    result = soft.map((v, i) => {
      if (input[i] === 0) return 0;
      const p = i * 4;
      return data[p + 3] === 0 ? 0 : Math.min(input[i], v * 1.2);
    });
  } else result = blurMask(input, w, h, radius);
  // Masks never grow into fully transparent source pixels. Soft alpha is not multiplied twice.
  for (let i = 0; i < result.length; i++) if (!data[i * 4 + 3]) result[i] = 0;
  return result;
}
function patternPixel(pattern: Pattern, x: number, y: number): number[] | null {
  const rad = (pattern.angle * Math.PI) / 180,
    scale = Math.max(2, pattern.scale),
    u = (x * Math.cos(rad) + y * Math.sin(rad)) / scale,
    v = (-x * Math.sin(rad) + y * Math.cos(rad)) / scale;
  const fx = ((u % 1) + 1) % 1,
    fy = ((v % 1) + 1) % 1;
  let amount = 1;
  switch (pattern.kind) {
    case 'dots':
      if (Math.hypot(fx - 0.5, fy - 0.5) > 0.24) return null;
      break;
    case 'stripes':
      if (fx > 0.35) return null;
      break;
    case 'plaid':
      if (fx > 0.2 && fy > 0.2) return null;
      break;
    case 'diamonds':
      if (Math.abs(fx - 0.5) + Math.abs(fy - 0.5) > 0.35) return null;
      break;
    case 'texture':
      amount = (Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;
      amount = Math.abs(amount);
      break;
    case 'gradient':
      amount = fx;
      break;
    default:
      return null;
  }
  const a = hexRgb(pattern.color),
    b = hexRgb(pattern.secondary);
  return a.map((c, i) => c * amount + b[i] * (1 - amount));
}
export function adjustPixels(source: PixelImage, regions: Region[]): PixelImage {
  assertImage(source);
  const { width: w, height: h } = source,
    data = source.data.slice();
  for (const region of regions) {
    if (!region.visible) continue;
    const mask = decodeMask(region.mask);
    if (mask.length !== w * h || region.mask.width !== w)
      throw new Error('Region mask belongs to a different image.');
    const a = region.adjustment,
      targetRgb = hexRgb(a.color),
      target = toLab(targetRgb[0], targetRgb[1], targetRgb[2]),
      angle = (a.hue * Math.PI) / 180,
      paletteSource = region.palette?.source.map((c) => {
        const rgb = hexRgb(c);
        return toLab(rgb[0], rgb[1], rgb[2]);
      }),
      paletteTarget = region.palette?.target.map((c) => {
        const rgb = hexRgb(c);
        return toLab(rgb[0], rgb[1], rgb[2]);
      });
    let meanL = 0,
      weight = 0;
    for (let i = 0; i < mask.length; i++)
      if (mask[i] && data[i * 4 + 3]) {
        const p = i * 4,
          t = mask[i] / 255;
        meanL += toLab(data[p], data[p + 1], data[p + 2])[0] * t;
        weight += t;
      }
    meanL /= weight || 1;
    // Read clone samples from the state before this operation, never feedback from the brush destination.
    const before =
      region.operation === 'clone' || region.operation === 'repair' ? data.slice() : data;
    for (let i = 0; i < mask.length; i++) {
      const p = i * 4;
      if (!mask[i]) continue;
      const coverage = (mask[i] / 255) * a.opacity;
      if (region.operation === 'restore') {
        for (let c = 0; c < 4; c++)
          data[p + c] = Math.round(data[p + c] * (1 - coverage) + source.data[p + c] * coverage);
        continue;
      }
      if (region.operation === 'erase') {
        data[p + 3] = Math.round(data[p + 3] * (1 - coverage));
        continue;
      }
      if (region.operation === 'clone' || region.operation === 'repair') {
        const x = i % w,
          y = Math.floor(i / w),
          sx = Math.round(x + (region.offset?.x || 0)),
          sy = Math.round(y + (region.offset?.y || 0));
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        const sample = (sy * w + sx) * 4;
        for (let c = 0; c < 4; c++) {
          let value = before[sample + c];
          if (region.operation === 'repair' && c < 3) {
            let local = 0,
              near = 0,
              count = 0;
            for (const [dx, dy] of [
              [-6, 0],
              [6, 0],
              [0, -6],
              [0, 6],
            ]) {
              const px = clamp(x + dx, 0, w - 1),
                py = clamp(y + dy, 0, h - 1),
                qx = clamp(sx + dx, 0, w - 1),
                qy = clamp(sy + dy, 0, h - 1);
              local += before[(py * w + px) * 4 + c];
              near += before[(qy * w + qx) * 4 + c];
              count++;
            }
            value = clamp(value + (local - near) / count, 0, 255);
          }
          data[p + c] = Math.round(before[p + c] * (1 - coverage) + value * coverage);
        }
        continue;
      }
      if (!data[p + 3]) continue;
      const lab = toLab(data[p], data[p + 1], data[p + 2]);
      let L = lab[0],
        A = lab[1],
        B = lab[2];
      if (paletteSource?.length && paletteTarget?.length) {
        let nearest = 0,
          distance = Infinity;
        for (let k = 0; k < paletteSource.length; k++) {
          const c = paletteSource[k],
            d = (L - c[0]) ** 2 * 0.4 + (A - c[1]) ** 2 + (B - c[2]) ** 2;
          if (d < distance) {
            distance = d;
            nearest = k;
          }
        }
        const base = paletteSource[nearest],
          color = paletteTarget[nearest % paletteTarget.length];
        L = clamp(L + (color[0] - base[0]) * a.intensity);
        A = A * (1 - a.intensity) + color[1] * a.intensity;
        B = B * (1 - a.intensity) + color[2] * a.intensity;
      } else if (a.mode !== 'adjust') {
        const amount = a.intensity * (a.mode === 'tint' ? 0.55 : 1),
          shade = clamp(L / (meanL || 0.5), 0.3, 1.4);
        A = A * (1 - amount) + target[1] * shade * amount;
        B = B * (1 - amount) + target[2] * shade * amount;
        // Preserve local lightness differences; dark/white chosen colors can still change the base tone.
        L = clamp(L + (target[0] - meanL) * amount * 0.65);
      }
      const aa = A * Math.cos(angle) - B * Math.sin(angle),
        bb = A * Math.sin(angle) + B * Math.cos(angle),
        sat = a.grayscale ? 0 : 1 + a.saturation / 100;
      L = clamp((L - 0.5) * (1 + a.contrast / 100) + 0.5 + a.brightness / 100);
      let rgb = fromLab(L, aa * sat, bb * sat);
      if (region.pattern && region.pattern.kind !== 'none') {
        const pattern = region.pattern,
          paint = patternPixel(pattern, i % w, Math.floor(i / w));
        if (paint)
          rgb = rgb.map((c, k) => {
            const v =
              pattern.blend === 'multiply'
                ? (c * paint[k]) / 255
                : pattern.blend === 'screen'
                  ? 255 - ((255 - c) * (255 - paint[k])) / 255
                  : paint[k];
            return c * (1 - pattern.opacity) + v * pattern.opacity;
          });
      }
      for (let c = 0; c < 3; c++)
        data[p + c] = Math.round(data[p + c] * (1 - coverage) + rgb[c] * coverage);
      // Color-adjustment opacity controls blend strength, never source transparency.
    }
  }
  return { width: w, height: h, data };
}
