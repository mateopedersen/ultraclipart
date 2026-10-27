import type { SearchCard } from './search-index';
import { verifiedSourceUrl } from '../editor/source-policy.ts';
export type FavoriteFormat = 'webp' | 'pdf';
export interface FavoriteFile {
  id: string;
  title: string;
  name: string;
  url: string;
  bytes: number;
  sha256: string;
}
export const FAVORITE_ARCHIVE_LIMIT = 64 * 1024 * 1024;
export function planFavoriteDownload(
  items: (SearchCard | null)[],
  format: FavoriteFormat,
  origin: string,
) {
  const files: FavoriteFile[] = [],
    unavailable: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const representation = item?.download?.files[format],
      url = item?.[format];
    if (!item || !representation || !url) {
      unavailable.push(item?.title || 'Unavailable saved artwork');
      continue;
    }
    if (seen.has(item.id)) continue;
    try {
      verifiedSourceUrl({ url, ...representation }, format, origin);
    } catch {
      unavailable.push(item.title);
      continue;
    }
    seen.add(item.id);
    files.push({
      id: item.id,
      title: item.title,
      name: `${item.id}.${format}`,
      url,
      ...representation,
    });
  }
  const parts: FavoriteFile[][] = [];
  let part: FavoriteFile[] = [],
    bytes = 0;
  for (const file of files) {
    if (part.length && (bytes + file.bytes > FAVORITE_ARCHIVE_LIMIT || part.length >= 128)) {
      parts.push(part);
      part = [];
      bytes = 0;
    }
    part.push(file);
    bytes += file.bytes;
  }
  if (part.length) parts.push(part);
  return { files, unavailable, parts };
}
