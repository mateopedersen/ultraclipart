import { catalogStatistics } from './catalog-statistics';
import { catalogCountValue, formatCatalogCount } from './catalog-counts';

// Legacy collection introductions begin with e.g. "Explore 50 cat clipart designs".
// Resolve those catalog-size claims centrally, along with explicit future templates.
export function collectionCountTemplate(text: string): string {
  return text.replace(
    /^((?:explore|browse|find|download|choose(?: from)?)\s+)[\d,]+(?=\s+[^.!?]{0,80}\b(?:illustrations|clipart designs|artworks)\b)/i,
    '$1{{artworkCount}}',
  );
}

export function resolveCollectionCountCopy(text: string, topic: string): string {
  return collectionCountTemplate(text).replaceAll(
    '{{artworkCount}}',
    formatCatalogCount(catalogCountValue(catalogStatistics, 'topic', topic)),
  );
}
