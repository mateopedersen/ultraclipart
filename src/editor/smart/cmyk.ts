import { predictRows } from './predict';
import { deflate } from 'pako';
import type { PixelImage } from './types';
import type { ColorLut } from '../pdf-math';
/** Same trilinear ICC LUT as vector exports; actual four-channel pixel data. */
export function cmykStreams(image: PixelImage, lut: ColorLut) {
  const { width: w, height: h, data } = image,
    n = lut.gridSize,
    colors = new Uint8Array(w * 4 * h),
    alpha = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w * 4,
      arow = y * w;
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4,
        r = data[p],
        g = data[p + 1],
        b = data[p + 2],
        out = [0, 0, 0, 0];
      if (r === g && g === b) out[3] = 1 - r / 255;
      else {
        const R = (r / 255) * (n - 1),
          G = (g / 255) * (n - 1),
          B = (b / 255) * (n - 1),
          r0 = Math.floor(R),
          g0 = Math.floor(G),
          b0 = Math.floor(B),
          rf = R - r0,
          gf = G - g0,
          bf = B - b0;
        for (let dr = 0; dr < 2; dr++)
          for (let dg = 0; dg < 2; dg++)
            for (let db = 0; db < 2; db++) {
              const index =
                  ((Math.min(r0 + dr, n - 1) * n + Math.min(g0 + dg, n - 1)) * n +
                    Math.min(b0 + db, n - 1)) *
                  4,
                weight = (dr ? rf : 1 - rf) * (dg ? gf : 1 - gf) * (db ? bf : 1 - bf);
              for (let c = 0; c < 4; c++) out[c] += lut.values[index + c] * weight;
            }
      }
      for (let c = 0; c < 4; c++) {
        const v = data[p + 3] ? Math.max(0, Math.min(255, Math.round(out[c] * 255))) : 0;
        colors[row + x * 4 + c] = v;
      }
      alpha[arow + x] = data[p + 3];
    }
  }
  return {
    colors: deflate(predictRows(colors, w, h, 4), { level: 9 }),
    alpha: deflate(predictRows(alpha, w, h, 1), { level: 9 }),
  };
}
