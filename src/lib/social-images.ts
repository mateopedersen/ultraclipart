import manifest from '../../data/social-images.json';

type SocialImage = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  type?: string;
};

const pages: Record<string, SocialImage> = manifest.pages;

function pagePath(pathname: string) {
  if (pathname === '/404.html') return '/404/';
  return pathname === '/' ? '/' : `${pathname.replace(/\/+$/, '')}/`;
}

function imageType(src: string) {
  const extension = new URL(src, 'https://ultraclipart.com').pathname.split('.').at(-1);
  const types: Record<string, string> = {
    png: 'image/png',
    webp: 'image/webp',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  };
  return types[extension ?? ''];
}

/** Hubs have composed covers; artwork and subject pages retain their own original. */
export function pageSocialImage(pathname: string, original?: SocialImage): SocialImage {
  const dedicated = pages[pagePath(pathname)];
  if (dedicated) return dedicated;
  if (original?.src) return { ...original, type: original.type ?? imageType(original.src) };
  return pages['/'];
}
