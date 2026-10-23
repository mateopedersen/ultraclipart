import { guides } from './guides.ts';
const SITE = 'https://ultraclipart.com/';
const XML = '<?xml version="1.0" encoding="UTF-8"?>';
const NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';

type Artwork = { id: string; topic: string; webp: string; published: boolean; indexable: boolean };
type Topic = { slug: string };

/** Escape XML data, including query strings in real CDN image URLs. */
export function xmlEscape(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

export const approvedArt = (art: Artwork[]) =>
  art.filter((item) => item.published && item.indexable);
const absolute = (path: string) => new URL(path, SITE).href;
const artUrl = (item: Artwork) => absolute(`art/${encodeURIComponent(item.id)}/`);

export function pageSitemap(art: Artwork[], topics: Topic[]): string {
  const routes = [
    '',
    'categories/',
    'collections/',
    'create/',
    'guides/',
    'print-size/',
    ...guides.map((guide) => `guides/${guide.slug}/`),
    'about/',
    'license/',
    'contact/',
    'privacy/',
    'terms/',
    'faq/',
    'for-teachers/',
    'accessibility/',
    'copyright/',
    'editorial-process/',
  ];
  const urls = routes.map(absolute);
  urls.push(...approvedArt(art).map(artUrl));
  for (const topic of topics) {
    const items = art.filter((item) => item.topic === topic.slug);
    if (items.length === 50 && items.every((item) => item.published && item.indexable))
      urls.push(absolute(`clipart/${encodeURIComponent(topic.slug)}/`));
  }
  return `${XML}<urlset xmlns="${NS}">${urls.map((url) => `<url><loc>${xmlEscape(url)}</loc></url>`).join('')}</urlset>`;
}

export function imageSitemap(art: Artwork[]): string {
  const items = approvedArt(art);
  if (!items.length)
    throw new Error('Do not publish an empty image sitemap. No artwork is approved for indexing.');
  const entries = items.map(
    (item) =>
      `<url><loc>${xmlEscape(artUrl(item))}</loc><image:image><image:loc>${xmlEscape(absolute(item.webp))}</image:loc></image:image></url>`,
  );
  return `${XML}<urlset xmlns="${NS}" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${entries.join('')}</urlset>`;
}

export function sitemapIndex(art: Artwork[]): string {
  // The image child is generated only after a real, reviewed image is indexable.
  const children = [
    'sitemap-pages.xml',
    ...(approvedArt(art).length ? ['sitemap-images.xml'] : []),
  ];
  return `${XML}<sitemapindex xmlns="${NS}">${children.map((path) => `<sitemap><loc>${xmlEscape(absolute(path))}</loc></sitemap>`).join('')}</sitemapindex>`;
}
