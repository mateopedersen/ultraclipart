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

/** Use the same public subset for HTML directories and XML discovery. */
export function indexableTopics<T extends Topic>(art: Artwork[], topics: T[]): T[] {
  const counts = new Map<string, number>();
  for (const item of approvedArt(art)) counts.set(item.topic, (counts.get(item.topic) ?? 0) + 1);
  return topics.filter((topic) => (counts.get(topic.slug) ?? 0) >= 50);
}

/** Published individual works still need an HTML discovery path while their
 * subject is below the collection threshold. Never expose drafts as a bridge. */
export function directoryArtwork<T extends Artwork>(art: T[], topics: Topic[]): T[] {
  const indexed = new Set(indexableTopics(art, topics).map((topic) => topic.slug));
  return art.filter((item) => item.published && item.indexable && !indexed.has(item.topic));
}
const absolute = (path: string) => new URL(path, SITE).href;
const artUrl = (item: Artwork) => absolute(`art/${encodeURIComponent(item.id)}/`);

function pageEntries(art: Artwork[], topics: Topic[]): string[] {
  const routes = [
    '',
    'categories/',
    'collections/',
    'library-index/',
    'create/',
    'ai-clipart-generator/',
    'guides/',
    'print-size/',
    ...guides.map((guide) => `guides/${guide.slug}/`),
    'about/',
    'license/',
    'contact/',
    'privacy/',
    'cookies/',
    'terms/',
    'faq/',
    'for-teachers/',
    'accessibility/',
    'copyright/',
    'editorial-process/',
  ];
  const urls = routes.map(absolute);
  urls.push(...approvedArt(art).map(artUrl));
  for (const topic of indexableTopics(art, topics))
    urls.push(absolute(`clipart/${encodeURIComponent(topic.slug)}/`));
  return [...new Set(urls)].map((url) => `<url><loc>${xmlEscape(url)}</loc></url>`);
}

function imageEntries(art: Artwork[]): string[] {
  const items = approvedArt(art);
  if (!items.length)
    throw new Error('Do not publish an empty image sitemap. No artwork is approved for indexing.');
  const entries = items.map(
    (item) =>
      `<url><loc>${xmlEscape(artUrl(item))}</loc><image:image><image:loc>${xmlEscape(absolute(item.webp))}</image:loc></image:image></url>`,
  );
  return entries;
}

const prefix = (images: boolean) =>
  `${XML}<urlset xmlns="${NS}"${images ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ''}>`;
const suffix = '</urlset>';
export function partitionSitemapEntries(
  entries: string[],
  images = false,
  maxUrls = 50000,
  maxBytes = 50 * 1024 ** 2,
): string[] {
  const start = prefix(images),
    overhead = Buffer.byteLength(start + suffix),
    parts: string[] = [];
  let chunk: string[] = [],
    bytes = overhead;
  for (const entry of entries) {
    const size = Buffer.byteLength(entry);
    if (size + overhead > maxBytes) throw Error('One sitemap entry exceeds the XML byte limit');
    if (chunk.length && (chunk.length >= maxUrls || bytes + size > maxBytes)) {
      parts.push(start + chunk.join('') + suffix);
      chunk = [];
      bytes = overhead;
    }
    chunk.push(entry);
    bytes += size;
  }
  if (chunk.length) parts.push(start + chunk.join('') + suffix);
  return parts;
}
export function pageSitemap(art: Artwork[], topics: Topic[]): string {
  return prefix(false) + pageEntries(art, topics).join('') + suffix;
}
export function imageSitemap(art: Artwork[]): string {
  return prefix(true) + imageEntries(art).join('') + suffix;
}
export function sitemapDocuments(art: Artwork[], topics: Topic[] = []) {
  return [
    ...partitionSitemapEntries(pageEntries(art, topics)).map((xml, index) => ({
      kind: index ? `pages-${index + 1}` : 'pages',
      xml,
    })),
    ...(approvedArt(art).length
      ? partitionSitemapEntries(imageEntries(art), true).map((xml, index) => ({
          kind: index ? `images-${index + 1}` : 'images',
          xml,
        }))
      : []),
  ];
}
export function sitemapIndex(art: Artwork[], topics: Topic[] = []): string {
  const children = sitemapDocuments(art, topics).map((document) => `sitemap-${document.kind}.xml`);
  return `${XML}<sitemapindex xmlns="${NS}">${children.map((path) => `<sitemap><loc>${xmlEscape(absolute(path))}</loc></sitemap>`).join('')}</sitemapindex>`;
}
