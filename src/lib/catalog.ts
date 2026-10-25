import source from '../../data/topics.json';
import illustrations from '../../data/art.json';
import extraTopics from '../../data/extra-topics.json';
import { validateEditorSource } from './artwork-source';
import { auditMonochrome } from '../../scripts/monochrome-catalog.mjs';
import type { MonochromeKind } from './monochrome';
import { clustersForTopic, topicInCluster, primaryClusterForTopic } from './topic-clusters';
export { clustersForTopic, topicInCluster } from './topic-clusters';
export const topics = [...source.topics, ...extraTopics].map((topic) => ({
  ...topic,
  cluster: primaryClusterForTopic(topic),
}));
type AssetKind = 'svg' | 'webp' | 'pdf' | 'thumb';
type PublishedAssets = Record<string, Record<AssetKind, string>>;
const publishedAssets = import.meta.env.PUBLIC_ASSET_URLS as PublishedAssets | null;
const monochromeAudit = await auditMonochrome(illustrations);
export const art = illustrations.map((item) => ({
  ...item,
  monochrome: monochromeAudit.get(item.id)?.monochrome === true,
  monochromeKind: (monochromeAudit.get(item.id)?.kind ?? null) as MonochromeKind | null,
  editable: true,
  layered: validateEditorSource(item) === 'layered',
  ...Object.fromEntries(
    (['svg', 'webp', 'pdf', 'thumb'] as const).map((kind) => {
      if (kind === 'svg' && (item as { sourceType?: string }).sourceType === 'raster')
        return [kind, null];
      if (publishedAssets && !publishedAssets[item.id]?.[kind])
        throw new Error(`Missing published asset: ${item.id}/${kind}`);
      return [kind, publishedAssets?.[item.id]?.[kind] ?? item[kind]];
    }),
  ),
}));
// Public counters and navigation exclude drafts, withdrawn and non-indexable records.
export const publishedArt = art.filter((item) => item.published && item.indexable);
export const blackAndWhiteArt = publishedArt.filter((item) => item.monochrome);
export const newestArt = [...publishedArt].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const clusters = [...new Set(topics.flatMap(clustersForTopic))];
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const topicArt = (slug: string) => publishedArt.filter((a) => a.topic === slug);

// Planned keywords remain in the production queue; public navigation only links to real artwork.
export const availableTopics = topics.filter((topic) =>
  publishedArt.some((item) => item.topic === topic.slug),
);
export const availableClusters = clusters.filter((cluster) =>
  availableTopics.some((topic) => topicInCluster(topic, cluster)),
);
