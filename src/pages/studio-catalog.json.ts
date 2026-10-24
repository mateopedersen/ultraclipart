import { art } from '../lib/catalog';
export const prerender = true;
export function GET() {
  return new Response(
    JSON.stringify(
      art
        .filter((a) => a.sourceType === 'raster')
        .map((a) => ({
          id: a.id,
          title: a.title,
          topic: a.topic,
          style: a.style,
          thumb: a.thumb,
          width: a.width,
          height: a.height,
          webp: { url: a.webp, ...a.files.webp },
          pdf: { url: a.pdf, ...a.files.pdf },
        })),
    ),
    { headers: { 'Content-Type': 'application/json' } },
  );
}
