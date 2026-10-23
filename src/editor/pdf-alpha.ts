import { deflate, Inflate } from 'pako';
import { PDFName, PDFRawStream, type PDFDocument } from 'pdf-lib';

/** PNG row prediction is reversible byte arithmetic, not image quantization.
 * The decoded grayscale mask stays identical. CMYK image streams are untouched.
 */
export function predictAlpha(
  raw: Uint8Array,
  width: number,
  height: number,
  strategy: 'adaptive' | 'sub' | 'none' = 'adaptive',
): Uint8Array {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 4096 ||
    height > 4096 ||
    raw.length !== width * height
  )
    throw new Error('Invalid alpha-mask dimensions');
  const output = new Uint8Array((width + 1) * height);
  const candidates = Array.from({ length: 5 }, () => new Uint8Array(width));
  for (let y = 0; y < height; y++) {
    const row = y * (width + 1);
    if (strategy === 'none') {
      output.set(raw.subarray(y * width, (y + 1) * width), row + 1);
      continue;
    }
    if (strategy === 'sub') {
      output[row] = 1;
      for (let x = 0; x < width; x++) {
        const offset = y * width + x;
        output[row + 1 + x] = (raw[offset] - (x ? raw[offset - 1] : 0)) & 255;
      }
      continue;
    }
    const scores = [0, 0, 0, 0, 0];
    for (let x = 0; x < width; x++) {
      const offset = y * width + x,
        value = raw[offset];
      const left = x ? raw[offset - 1] : 0;
      const up = y ? raw[offset - width] : 0;
      const upperLeft = x && y ? raw[offset - width - 1] : 0;
      const p = left + up - upperLeft;
      const dl = Math.abs(p - left),
        du = Math.abs(p - up),
        dul = Math.abs(p - upperLeft);
      const paeth = dl <= du && dl <= dul ? left : du <= dul ? up : upperLeft;
      const predictions = [0, left, up, Math.floor((left + up) / 2), paeth];
      for (let filter = 0; filter < 5; filter++) {
        const delta = (value - predictions[filter]) & 255;
        candidates[filter][x] = delta;
        scores[filter] += Math.min(delta, 256 - delta);
      }
    }
    const best = scores.indexOf(Math.min(...scores));
    output[row] = best;
    output.set(candidates[best], row + 1);
  }
  return output;
}

/** Only the explicitly supported unpredicted 8-bit soft-mask format is rewritten.
 * Already compact or other valid source formats are preserved as supplied.
 */
export async function compactSoftMasks(document: PDFDocument): Promise<void> {
  const masks = new Set<PDFRawStream>();
  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    const mask = object.dict.lookup(PDFName.of('SMask'));
    if (mask instanceof PDFRawStream) masks.add(mask);
  }
  for (const mask of masks) {
    const dict = mask.dict;
    if (
      String(dict.get(PDFName.of('Filter'))) !== '/FlateDecode' ||
      dict.has(PDFName.of('DecodeParms')) ||
      String(dict.get(PDFName.of('ColorSpace'))) !== '/DeviceGray' ||
      String(dict.get(PDFName.of('BitsPerComponent'))) !== '8'
    )
      continue;
    const width = Number(String(dict.get(PDFName.of('Width'))));
    const height = Number(String(dict.get(PDFName.of('Height'))));
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 4096 ||
      height > 4096
    )
      throw new Error('Invalid source mask dimensions');
    // Fixed output bound prevents a compressed mask from allocating arbitrary memory.
    const raw = inflateAlpha(mask.getContents(), width * height);
    const candidates = (['adaptive', 'sub', 'none'] as const).map((strategy) =>
      deflate(predictAlpha(raw, width, height, strategy), { level: 9 }),
    );
    const encoded = candidates.reduce((best, candidate) =>
      candidate.length < best.length ? candidate : best,
    );
    if (encoded.length + 128 >= mask.getContents().length) continue;
    const replacement = dict.clone(document.context);
    replacement.set(
      PDFName.of('DecodeParms'),
      document.context.obj({ Predictor: 15, Colors: 1, BitsPerComponent: 8, Columns: width }),
    );
    const stream = PDFRawStream.of(replacement, encoded);
    const ref = document.context.getObjectRef(mask);
    if (ref) document.context.assign(ref, stream);
  }
}

export function inflateAlpha(bytes: Uint8Array, expected: number): Uint8Array {
  if (!Number.isInteger(expected) || expected < 1 || expected > 4096 * 4096)
    throw new Error('Invalid alpha size');
  const raw = new Uint8Array(expected);
  const decoder = new Inflate({ chunkSize: 65536 });
  let offset = 0,
    ended = false;
  const onEnd = decoder.onEnd.bind(decoder);
  decoder.onEnd = (status) => {
    ended = status === 0;
    onEnd(status);
  };
  decoder.onData = (chunk) => {
    if (!(chunk instanceof Uint8Array) || offset + chunk.length > expected)
      throw new Error('Alpha stream exceeds its declared dimensions');
    raw.set(chunk, offset);
    offset += chunk.length;
  };
  decoder.push(bytes, true);
  if (decoder.err || !ended || offset !== expected) throw new Error('Invalid alpha stream length');
  return raw;
}
