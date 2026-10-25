export type MonochromeKind = 'outline' | 'grayscale' | 'silhouette';
export interface MonochromeDirectory {
  total: number;
  collections: { slug: string; label: string; count: number }[];
  topics: { slug: string; label: string; count: number; collections: string[] }[];
  kinds: { slug: MonochromeKind; label: string; count: number }[];
}

/** Use the audited result when available; metadata fallback supports imports. */
export function isMonochrome(item: { monochrome?: boolean; style: string }) {
  return item.monochrome ?? ['outline', 'black & white'].includes(item.style.toLowerCase());
}
