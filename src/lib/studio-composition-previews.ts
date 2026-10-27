import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { publishedArt } from './catalog';
import { studioScenes } from './studio-scenes';
import { buildStudioComposition, studioCompositionSvg } from './studio-compositions';

// Astro moves this module while prerendering. Resolve against the project root,
// just like the shared screenshot generator, rather than the emitted chunk.
const publicRoot = resolve(process.cwd(), 'public');
const artwork = new Map(publishedArt.map((item) => [item.id, item]));
const embedded = new Map<string, string>();
function previewImage(id: string) {
  const item = artwork.get(id);
  if (!item || !item.thumb.startsWith('/previews/') || item.thumb.includes('..'))
    throw new Error(`Unverified Studio preview source: ${id}`);
  if (!embedded.has(item.thumb)) {
    const bytes = readFileSync(resolve(publicRoot, '.' + item.thumb));
    embedded.set(item.thumb, 'data:image/webp;base64,' + bytes.toString('base64'));
  }
  return embedded.get(item.thumb)!;
}

// A self-contained, source-bound SVG allows native image lazy loading. An SVG
// <image> inside an inline document would fetch every offscreen project at once.
export const studioCompositionPreviews = studioScenes.map((scene) => {
  const plan = buildStudioComposition(scene, artwork);
  const images = new Map(scene.items.map((item) => [item.id, previewImage(item.id)]));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1000" width="1400" height="1000">${studioCompositionSvg(plan, images)}</svg>`;
  const hash = createHash('sha256').update(svg).digest('hex').slice(0, 16);
  return {
    id: scene.id,
    filename: `${scene.id}-${hash}.svg`,
    src: `/studio-previews/${scene.id}-${hash}.svg`,
    svg,
    hash,
    bytes: Buffer.byteLength(svg),
    layers: plan.layers.length,
  };
});
