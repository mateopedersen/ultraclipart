import type { EditorDocument, RasterLayer } from '../model';
import { rasterPixels, rasterPreview } from '../raster';
import { effectBounds } from './padding';
import { Processor } from './processor';
import type { PixelImage } from './types';
const rendered = new Map<string, { url: string; image: PixelImage }>();
const jobs = new Map<string, Promise<void>>();
const processors = new Map<string, { processor: Promise<Processor>; users: number }>();
const waiting: (() => void)[] = [];
let documentGeneration = 0;
export const rasterKey = (layer: RasterLayer) =>
  JSON.stringify([layer.sourceSha256, layer.regions || [], layer.effects || []]);
export const hasRasterEdits = (layer: RasterLayer) =>
  !!(layer.regions?.some((r) => r.visible) || layer.effects?.some((e) => e.enabled));
/** Two source workers, leased until each task finishes. Never evict a running export or selection. */
export async function withProcessor<T>(
  layer: RasterLayer,
  task: (p: Processor) => Promise<T>,
): Promise<T> {
  const key = layer.assetId + layer.sourceSha256;
  while (!processors.has(key) && processors.size >= 2) {
    const idle = [...processors].find(([, entry]) => entry.users === 0);
    if (idle) {
      processors.delete(idle[0]);
      void idle[1].processor.then((p) => p.dispose());
      break;
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  let entry = processors.get(key);
  if (!entry) {
    entry = {
      users: 0,
      processor: (async () => {
        const p = new Processor();
        await p.open(rasterPixels(layer));
        return p;
      })(),
    };
    processors.set(key, entry);
  }
  entry.users++;
  try {
    return await task(await entry.processor);
  } finally {
    entry.users--;
    for (const wake of waiting.splice(0)) wake();
  }
}
export function processedPreview(layer: RasterLayer) {
  if (!hasRasterEdits(layer)) return rasterPreview(layer);
  return rendered.get(rasterKey(layer))?.url || rasterPreview(layer);
}
export async function prepareRaster(layer: RasterLayer): Promise<void> {
  if (!hasRasterEdits(layer)) return;
  const key = rasterKey(layer);
  if (rendered.has(key)) return;
  if (jobs.has(key)) return jobs.get(key)!;
  const promise = withProcessor(layer, async (processor) => {
    const image = await processor.run<PixelImage>('render', {
      regions: layer.regions,
      effects: layer.effects,
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not render image.');
    context.putImageData(
      new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
      0,
      0,
    );
    rendered.set(key, { url: canvas.toDataURL('image/png'), image });
  });
  jobs.set(key, promise);
  try {
    await promise;
  } finally {
    jobs.delete(key);
  }
}
export async function prepareDocument(doc: EditorDocument) {
  const generation = ++documentGeneration;
  // Repeated copies of one artwork share a rendered bitmap. Transforms remain independent.
  for (const layer of doc.layers)
    if (layer.kind === 'raster' && layer.visible) await prepareRaster(layer);
  if (generation !== documentGeneration) return;
  const keys = new Set(
    doc.layers.filter((l): l is RasterLayer => l.kind === 'raster').map(rasterKey),
  );
  for (const key of rendered.keys()) if (!keys.has(key)) rendered.delete(key);
}
export async function processedPixels(layer: RasterLayer): Promise<PixelImage> {
  await prepareRaster(layer);
  return hasRasterEdits(layer) ? rendered.get(rasterKey(layer))!.image : rasterPixels(layer);
}
export function disposeProcessors() {
  for (const entry of processors.values()) void entry.processor.then((p) => p.dispose());
  processors.clear();
  rendered.clear();
  for (const wake of waiting.splice(0)) wake();
}
addEventListener('pagehide', disposeProcessors);

export function processedBounds(layer: RasterLayer) {
  return hasRasterEdits(layer) && rendered.has(rasterKey(layer))
    ? effectBounds(layer)
    : { x: 0, y: 0, width: layer.width, height: layer.height };
}
