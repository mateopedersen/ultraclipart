import { clone, validateDocument, type EditorDocument, type RasterLayer } from '../model';
import { defaultAdjustment, type PixelImage, type MaskData } from './types';
import { decodeMask } from './pixels';

/** Source-coordinate selection, including masks softened to fractional alpha, on a padded render. */
export function extractSelectionPixels(
  image: PixelImage,
  selection: MaskData,
  offset: { x: number; y: number },
) {
  const mask = decodeMask(selection);
  if (
    image.data.length !== image.width * image.height * 4 ||
    !Number.isInteger(offset.x) ||
    !Number.isInteger(offset.y)
  )
    throw new Error('The rendered image has invalid dimensions.');
  let left = selection.width,
    top = selection.height,
    right = -1,
    bottom = -1;
  const alphaAt = (x: number, y: number) => {
    const px = x - offset.x,
      py = y - offset.y;
    return px >= 0 && py >= 0 && px < image.width && py < image.height
      ? Math.round(
          (image.data[(py * image.width + px) * 4 + 3] * mask[y * selection.width + x]) / 255,
        )
      : 0;
  };
  for (let y = 0; y < selection.height; y++)
    for (let x = 0; x < selection.width; x++)
      if (alphaAt(x, y)) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
  if (right < left) throw new Error('Select visible pixels before extracting a layer.');
  const width = right - left + 1,
    height = bottom - top + 1,
    data = new Uint8ClampedArray(width * height * 4);
  for (let y = top; y <= bottom; y++)
    for (let x = left; x <= right; x++) {
      const a = alphaAt(x, y);
      if (!a) continue;
      const source = ((y - offset.y) * image.width + x - offset.x) * 4,
        target = ((y - top) * width + x - left) * 4;
      data.set(image.data.subarray(source, source + 3), target);
      data[target + 3] = a;
    }
  return { width, height, data, x: left, y: top };
}
/** Translate cropped pixels through the source transform, so rotated/scaled cutouts do not jump. */
export function extractedDocument(
  doc: EditorDocument,
  sourceId: string,
  cutout: RasterLayer,
  box: { x: number; y: number },
  remove: boolean,
  name: string,
) {
  const source = doc.layers.find((l): l is RasterLayer => l.id === sourceId && l.kind === 'raster');
  if (!source || source.locked || !source.visible || doc.selection?.layerId !== sourceId)
    throw new Error('Select an unlocked, visible image region first.');
  const next = clone(doc),
    index = next.layers.findIndex((l) => l.id === sourceId),
    angle = (source.angle * Math.PI) / 180;
  const layer = clone(cutout);
  layer.x =
    source.x + Math.cos(angle) * box.x * source.scaleX - Math.sin(angle) * box.y * source.scaleY;
  layer.y =
    source.y + Math.sin(angle) * box.x * source.scaleX + Math.cos(angle) * box.y * source.scaleY;
  layer.angle = source.angle;
  layer.scaleX = source.scaleX;
  layer.scaleY = source.scaleY;
  layer.opacity = source.opacity;
  layer.label = name.trim().slice(0, 100) || 'Extracted object';
  if (source.ai) layer.ai = clone(source.ai);
  if (remove) {
    const target = next.layers[index] as RasterLayer;
    target.regions ??= [];
    target.regions.push({
      id: `region-${crypto.randomUUID()}`,
      name: `Extracted: ${layer.label}`.slice(0, 100),
      visible: true,
      locked: false,
      mask: clone(doc.selection.mask),
      adjustment: { ...defaultAdjustment(), mode: 'adjust' },
      operation: 'erase',
      stage: 'after-effects',
    });
  }
  next.version = 2;
  next.layers.splice(index + 1, 0, layer);
  delete next.selection;
  if (!validateDocument(next, doc.artId))
    throw new Error(
      'This extraction would exceed the 500 layers, 12 unique images, 40 million source pixels, or 100 saved regions limit. Your source is unchanged.',
    );
  return next;
}
