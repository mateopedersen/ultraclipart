export const PUBLICATION_ORDER_VERSION = 2;
export interface PublicationDate {
  createdAt?: string;
  publishedAt?: string;
  firstPublishedAt?: string;
}
export function publicationTime(item: PublicationDate): number {
  for (const value of [item.firstPublishedAt, item.publishedAt, item.createdAt]) {
    if (!value) continue;
    const time = Date.parse(value);
    if (Number.isFinite(time)) return time;
  }
  return 0;
}
export function newestFirst<T extends PublicationDate>(items: readonly T[]): T[] {
  return items
    .map((item, order) => ({ item, order, time: publicationTime(item) }))
    .sort((a, b) => b.time - a.time || b.order - a.order)
    .map(({ item }) => item);
}
