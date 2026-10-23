import { identity, type EditorDocument, type RasterLayer } from './model';
import { verifiedSourceUrl, type VerifiedRepresentation as Representation } from './source-policy';
export interface RasterAsset {
  id: string;
  width: number;
  height: number;
  webp: Representation;
  pdf: Representation;
}
interface LoadedAsset {
  asset: RasterAsset;
  preview: string;
  pdf?: Promise<Uint8Array<ArrayBuffer>>;
}
// Projects contain compact, hash-bound references, never executable image URLs.
// Only the current catalog page can register a source. Undo does not copy bitmap bytes.
const assets = new Map<string, LoadedAsset>();
async function readVerified(file: Representation, kind: 'webp' | 'pdf') {
  const url = verifiedSourceUrl(file, kind, location.origin);
  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'omit',
    cache: 'reload',
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  const mime = kind === 'pdf' ? 'application/pdf' : 'image/webp';
  if (
    !response.ok ||
    response.headers.get('content-type')?.split(';')[0] !== mime ||
    !response.body
  )
    throw new Error('The artwork could not be loaded. Reconnect and refresh to retry.');
  const buffer = new Uint8Array(file.bytes),
    reader = response.body.getReader();
  let offset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.byteLength > buffer.length) {
        await reader.cancel();
        throw new Error('Artwork source exceeds its verified size.');
      }
      buffer.set(value, offset);
      offset += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
  if (offset !== file.bytes || hash !== file.sha256)
    throw new Error('Artwork source verification failed. No edits or exports have been changed.');
  return buffer;
}
export async function openRaster(asset: RasterAsset): Promise<EditorDocument> {
  if (
    !/^[a-z0-9-]+$/.test(asset.id) ||
    ![asset.width, asset.height].every((v) => Number.isInteger(v) && v > 0 && v <= 4096)
  )
    throw new Error('Invalid image dimensions.');
  const bytes = await readVerified(asset.webp, 'webp');
  const preview = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The image could not be opened.'));
    reader.readAsDataURL(new Blob([bytes], { type: 'image/webp' }));
  });
  const image = new Image();
  image.src = preview;
  await image.decode();
  if (image.naturalWidth !== asset.width || image.naturalHeight !== asset.height)
    throw new Error('Image dimensions differ from the verified catalog.');
  assets.set(asset.id, { asset, preview });
  return {
    version: 1,
    artId: asset.id,
    width: asset.width,
    height: asset.height,
    background: 'transparent',
    crop: null,
    print: { paper: 'letter', orientation: 'portrait', margin: 0.5, scale: 'fit' },
    layers: [
      {
        id: 'original-image',
        label: 'Original image',
        kind: 'raster',
        assetId: asset.id,
        sourceSha256: asset.webp.sha256,
        width: asset.width,
        height: asset.height,
        visible: true,
        locked: false,
        opacity: 1,
        ...identity(),
      },
    ],
  };
}
export function requireRaster(layer: RasterLayer) {
  const loaded = assets.get(layer.assetId);
  if (!loaded || loaded.asset.webp.sha256 !== layer.sourceSha256)
    throw new Error('This project references an image that is not available for this artwork.');
  return loaded;
}
export function rasterPreview(layer: RasterLayer) {
  return requireRaster(layer).preview;
}
export async function rasterPdf(layer: RasterLayer) {
  const loaded = requireRaster(layer);
  loaded.pdf ??= readVerified(loaded.asset.pdf, 'pdf').catch((error) => {
    loaded.pdf = undefined;
    throw error;
  });
  return loaded.pdf;
}
