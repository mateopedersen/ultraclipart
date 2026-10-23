import source from '../../data/topics.json';
import illustrations from '../../data/art.json';
export const topics = source.topics;
type AssetKind = 'svg' | 'webp' | 'pdf' | 'thumb';
type PublishedAssets = Record<string, Record<AssetKind, string>>;
const publishedAssets = import.meta.env.PUBLIC_ASSET_URLS as PublishedAssets | null;
export const art = illustrations.map((item) => ({
  ...item,
  ...Object.fromEntries(
    (['svg', 'webp', 'pdf', 'thumb'] as const).map((kind) => {
      if (publishedAssets && !publishedAssets[item.id]?.[kind])
        throw new Error(`Missing published asset: ${item.id}/${kind}`);
      return [kind, publishedAssets?.[item.id]?.[kind] ?? item[kind]];
    }),
  ),
}));
export const clusters = [...new Set(topics.map((t) => t.cluster))];
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const topicArt = (slug: string) => art.filter((a) => a.topic === slug);
