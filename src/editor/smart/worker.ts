import { selectRegion, refineMask, decodeMask } from './pixels';
import { renderPixels, inspectImage, palette } from './effects';
import type { PixelImage } from './types';
let source: PixelImage;
self.onmessage = async (event) => {
  const { id, op, payload } = event.data;
  try {
    let result: unknown;
    if (op === 'source') {
      source = payload;
      result = true;
    } else if (op === 'select') result = selectRegion(source, payload.point, payload.options);
    else if (op === 'refine')
      result = refineMask(payload.mask, source, payload.kind, payload.radius);
    else if (op === 'render')
      result = renderPixels(source, payload.regions || [], payload.effects || []);
    else if (op === 'inspect') result = inspectImage(payload.image || source, payload.widthInches);
    else if (op === 'cmyk') {
      const { cmykStreams } = await import('./cmyk');
      result = cmykStreams(payload.image, payload.lut);
    } else if (op === 'trace') {
      const { traceLineArt } = await import('./trace');
      result = traceLineArt(payload.image, payload.threshold);
    } else if (op === 'palette')
      result = palette(source, payload.mask ? decodeMask(payload.mask) : undefined);
    else throw new Error('Unknown image operation.');
    const transfer: Transferable[] = [];
    if (result instanceof Uint8Array) transfer.push(result.buffer);
    else if (
      result &&
      typeof result === 'object' &&
      'data' in result &&
      result.data instanceof Uint8ClampedArray
    )
      transfer.push(result.data.buffer);
    self.postMessage({ id, result }, { transfer });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : 'Image processing failed.',
    });
  }
};
