/** Small public count contract; never import the catalog into the browser. */
export interface CatalogCounts {
  schema: 1;
  version: string;
  totals: { artworks: number; subjects: number; collections: number; printable: number };
  topics: Record<string, number>;
  collections: Record<string, { artworks: number; subjects: number }>;
}
export type CatalogCountKind =
  | 'artworks'
  | 'subjects'
  | 'collections'
  | 'printable'
  | 'topic'
  | 'collection-artworks'
  | 'collection-subjects';
export type CatalogCountUnit = 'illustration' | 'artwork' | 'subject' | 'available topic';

export function catalogCountValue(counts: CatalogCounts, kind: CatalogCountKind, key = ''): number {
  if (kind === 'topic') return counts.topics[key] ?? 0;
  if (kind === 'collection-artworks') return counts.collections[key]?.artworks ?? 0;
  if (kind === 'collection-subjects') return counts.collections[key]?.subjects ?? 0;
  return counts.totals[kind];
}

export function formatCatalogCount(value: number, unit?: CatalogCountUnit): string {
  const number = value.toLocaleString('en-US');
  return unit ? `${number} ${unit}${value === 1 ? '' : 's'}` : number;
}

export function isCatalogCounts(value: unknown): value is CatalogCounts {
  if (!value || typeof value !== 'object') return false;
  const data = value as CatalogCounts;
  const count = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
  const map = (m: unknown) => !!m && typeof m === 'object' && !Array.isArray(m);
  return (
    data.schema === 1 &&
    typeof data.version === 'string' &&
    /^[a-f0-9]{16}$/.test(data.version) &&
    map(data.totals) &&
    ['artworks', 'subjects', 'collections', 'printable'].every((key) =>
      count(data.totals[key as keyof CatalogCounts['totals']]),
    ) &&
    map(data.topics) &&
    Object.values(data.topics).every(count) &&
    map(data.collections) &&
    Object.values(data.collections).every(
      (group) => map(group) && count(group.artworks) && count(group.subjects),
    )
  );
}
