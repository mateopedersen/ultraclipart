/** Catalog image facts shared by detail pages, collections and the build audit. */
import { ORGANIZATION_ID } from './page-seo.ts';
export const IMAGE_SITE = 'https://ultraclipart.com/';
export const IMAGE_LICENSE = new URL('license/', IMAGE_SITE).href;
export const IMAGE_COPYRIGHT =
  'UltraClipart. Rights in protectable contributions reserved; third-party rights remain with their owners.';

type CatalogImage = {
  id: string;
  title: string;
  alt: string;
  description: string;
  webp: string;
  thumb: string;
  width: number;
  height: number;
};
type ImageOptions = {
  contentUrl?: string;
  thumbnailUrl?: string;
  width?: number | null;
  height?: number | null;
  primary?: boolean;
  context?: boolean;
};
export const absoluteImageUrl = (value: string) => new URL(value, IMAGE_SITE).href;
export const artworkImageId = (id: string) =>
  new URL(`art/${encodeURIComponent(id)}/#image`, IMAGE_SITE).href;

export function imageObject(item: CatalogImage, options: ImageOptions = {}) {
  const original = absoluteImageUrl(item.webp);
  const contentUrl = absoluteImageUrl(options.contentUrl ?? item.webp);
  const originalImage = contentUrl === original;
  return {
    ...(options.context ? { '@context': 'https://schema.org' } : {}),
    '@type': 'ImageObject',
    '@id': originalImage ? artworkImageId(item.id) : `${contentUrl}#image`,
    name: item.title,
    description: item.description,
    caption: item.alt,
    contentUrl,
    url: new URL(`art/${encodeURIComponent(item.id)}/`, IMAGE_SITE).href,
    thumbnailUrl: absoluteImageUrl(options.thumbnailUrl ?? item.thumb),
    encodingFormat: /\.svg(?:$|[?#])/i.test(contentUrl) ? 'image/svg+xml' : 'image/webp',
    ...(options.width === null ? {} : { width: options.width ?? item.width }),
    ...(options.height === null ? {} : { height: options.height ?? item.height }),
    creator: {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: 'UltraClipart',
      url: IMAGE_SITE,
    },
    creditText: 'UltraClipart',
    copyrightNotice: IMAGE_COPYRIGHT,
    license: IMAGE_LICENSE,
    acquireLicensePage: IMAGE_LICENSE,
    ...(!originalImage ? { isBasedOn: { '@id': artworkImageId(item.id) } } : {}),
    ...(options.primary
      ? {
          mainEntityOfPage: new URL(`art/${encodeURIComponent(item.id)}/`, IMAGE_SITE).href,
          representativeOfPage: true,
        }
      : {}),
  };
}
