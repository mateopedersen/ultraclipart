import contexts from './gta-six-contexts.json' with { type: 'json' };
import reviews from '../data/identification/gta-six.json' with { type: 'json' };
import { validateIdentification } from './identification-review.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export const packageContexts = contexts;
export const packageDiscovery = () => ({ cute: false });
export function packageMetadata(topic, id, sourceSha256) {
  const record = reviews.artworks.find((row) => row.id === id);
  if (!record || (sourceSha256 && record.sourceSha256 !== sourceSha256))
    throw Error('Missing or changed GTA source review: ' + id);
  const metadata = record.metadata;
  const root = resolve(import.meta.dirname, '..');
  const original = resolve(root, record.source);
  // Clean CI checkouts restore the unchanged reviewed WebP from the verified CDN;
  // private owner ZIPs are not required to validate published metadata.
  const sourceBytes = readFileSync(
    existsSync(original) ? original : resolve(root, 'public/catalog', topic, id + '.webp'),
  );
  const checked = validateIdentification({ artwork: { id, ...metadata }, sourceBytes, record });
  return {
    ...metadata,
    style: record.style,
    visualStyle: record.visualStyle,
    productIdentity: checked.productIdentity,
  };
}
export function packageCollectionCopy(topic, items) {
  const c = contexts[topic];
  const ordered = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const featured = [
    c.cover,
    ...ordered.filter((x) => x.id !== c.cover && x.style === 'Color').map((x) => x.id),
  ].slice(0, 5);
  const mono = ordered.find((x) => x.style === 'Black & White');
  if (mono) featured.push(mono.id);
  return {
    description: `${items.length} ${c.label} fan-art clipart designs. Browse character illustrations and decorative compositions with transparent WebP and matching printable PDF downloads.`,
    lead: c.lead,
    intro: c.intro,
    featured,
    chips: c.chips.map((query) => ({ label: query, query })),
    heading: `Choose a ${c.label} illustration for your project`,
    paragraphs: [
      c.note,
      'Compare the complete composition and its original dimensions before downloading. In Clipart Studio you can position, crop and resize the picture or add your own lettering. The illustration is one raster image layer; its characters, objects and existing lettering are not separate vector layers.',
    ],
    print:
      'Each picture has two separate downloads: a transparent 1,254 × 1,254 pixel WebP and a single-page CMYK PDF at 300 pixels per inch. The PDF page measures 4.18 × 4.18 inches. Print at actual size to preserve that scale; enlargement lowers effective resolution. Make a sample print before producing multiple copies.',
    related: c.related,
  };
}
