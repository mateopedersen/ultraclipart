import { publishedArt } from '../lib/catalog';
import { featuredStudioIds } from '../lib/studio-artwork';
import { categoryCollections } from '../lib/category-directory';
export const prerender = true;
export function GET() {
  const all = publishedArt.filter((a) => a.sourceType === 'raster');
  return new Response(
    JSON.stringify({
      total: all.length,
      topics: [...new Set(all.map((a) => a.topic))].sort(),
      categories: categoryCollections.map((category) => ({
        id: category.slug,
        title: category.title,
        thumb: category.previews[0]?.thumb || '',
        topics: category.subjects.map((subject) => ({
          id: subject.slug,
          title: subject.name,
          count: subject.count,
          thumb: subject.sample.thumb,
        })),
      })),
      items: all
        .filter((a) => featuredStudioIds.has(a.id))
        .map((a) => ({
          id: a.id,
          title: a.title,
          alt: a.alt,
          topic: a.topic,
          style: a.style,
          featured: true,
          createdAt: a.createdAt,
          monochrome: a.monochrome,
          thumb: a.thumb,
          thumbSrcSet: a.thumbSrcSet,
          width: a.width,
          height: a.height,
          webp: { url: a.webp, ...a.files.webp },
          pdf: { url: a.pdf, ...a.files.pdf },
        })),
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}
