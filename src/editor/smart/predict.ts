/** Reversible PNG row prediction for PDF Flate streams. No quantization or downsampling. */
export function predictRows(raw: Uint8Array, width: number, height: number, channels: number) {
  const stride = width * channels;
  if (raw.length !== stride * height) throw new Error('Image prediction dimensions do not match.');
  const out = new Uint8Array((stride + 1) * height),
    candidates = Array.from({ length: 5 }, () => new Uint8Array(stride));
  for (let y = 0; y < height; y++) {
    const scores = [0, 0, 0, 0, 0],
      offset = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[offset + x],
        left = x >= channels ? raw[offset + x - channels] : 0,
        up = y ? raw[offset + x - stride] : 0,
        corner = y && x >= channels ? raw[offset + x - stride - channels] : 0,
        p = left + up - corner;
      const a = Math.abs(p - left),
        b = Math.abs(p - up),
        c = Math.abs(p - corner),
        paeth = a <= b && a <= c ? left : b <= c ? up : corner;
      const predictions = [0, left, up, Math.floor((left + up) / 2), paeth];
      for (let k = 0; k < 5; k++) {
        const d = (v - predictions[k]) & 255;
        candidates[k][x] = d;
        scores[k] += Math.min(d, 256 - d);
      }
    }
    const best = scores.indexOf(Math.min(...scores)),
      row = y * (stride + 1);
    out[row] = best;
    out.set(candidates[best], row + 1);
  }
  return out;
}
