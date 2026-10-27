import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
// Preserve source captures and illustrations; generate display-sized copies only.
export async function uiPreview(source: ImageMetadata) {
  const widths = [
    ...new Set(
      [160, 320, 640, 960].filter((w) => w < source.width).concat(Math.min(source.width, 960)),
    ),
  ];
  const images = await Promise.all(
    widths.map(async (width) => ({
      width,
      ...(await getImage({ src: source, width, format: 'webp', quality: 80 })),
    })),
  );
  return {
    src: images.at(-1)!.src,
    srcset: images.map((image) => `${image.src} ${image.width}w`).join(', '),
  };
}
