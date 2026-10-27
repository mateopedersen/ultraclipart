import source from '../../data/topics.json';
import illustrations from '../../data/art.json';
import editorialReviews from '../../data/editorial/reviews.json';
import { reviewedImportCatalog } from '../../scripts/reviewed-imports.mjs';
import { readRequiredCollectionIntroductions } from '../../scripts/collection-editorial.mjs';
import extraTopics from '../../data/extra-topics.json';
import { validateEditorSource } from './artwork-source';
import { auditMonochrome } from '../../scripts/monochrome-catalog.mjs';
import type { MonochromeKind } from './monochrome';
import { newestFirst } from './publication-order.ts';
import {
  previewUrls,
  previewIdentity,
  preparePreviewAssets,
  readPreviewIndex,
} from '../../scripts/preview-assets.mjs';
import { clustersForTopic, topicInCluster, primaryClusterForTopic } from './topic-clusters';
export { clustersForTopic, topicInCluster } from './topic-clusters';
export const topics = [...source.topics, ...extraTopics].map((topic) => ({
  ...topic,
  sourceCluster: topic.cluster,
  cluster: primaryClusterForTopic(topic),
}));
type AssetKind = 'svg' | 'webp' | 'pdf' | 'thumb';
type PublishedAssets = Record<string, Record<AssetKind, string>>;
const publishedAssets = import.meta.env.PUBLIC_ASSET_URLS as PublishedAssets | null;
const reviewedIllustrations = reviewedImportCatalog(illustrations, editorialReviews);
const monochromeAudit = await auditMonochrome(reviewedIllustrations);
export const reviewedCollectionIntroductions =
  readRequiredCollectionIntroductions(reviewedIllustrations);
await preparePreviewAssets(reviewedIllustrations);
const previewIndex = readPreviewIndex();
const screenImages = (item: (typeof illustrations)[number]) => {
  if (!item.published || !item.indexable)
    return {
      originalThumb: item.thumb,
      preview: item.webp,
      previewWidth: item.width,
      previewHeight: item.height,
      previewSrcSet: undefined as string | undefined,
      thumbWidth: 440,
      thumbSrcSet: undefined as string | undefined,
    };
  const urls = previewUrls(item),
    files = previewIndex[previewIdentity(item)].files;
  return {
    originalThumb: publishedAssets?.[item.id]?.thumb ?? item.thumb,
    thumb: urls[440],
    thumbWidth: files[440].width,
    preview: urls[960],
    previewWidth: files[960].width,
    previewHeight: files[960].height,
    previewSrcSet: [440, 640, 960]
      .filter((w) => files[w])
      .map((w) => `${urls[w]} ${files[w].width}w`)
      .join(', '),
    thumbSrcSet: [96, 220, 320, 440]
      .filter((w) => files[w])
      .map((w) => `${urls[w]} ${files[w].width}w`)
      .join(', '),
  };
};
export const art = reviewedIllustrations.map((item) => ({
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
  // Originals and their download checksums stay untouched. Only screen previews
  // use the reproducible, source-bound presentation files generated before build.
  ...screenImages(item),
}));
// Public counters and navigation exclude drafts, withdrawn and non-indexable records.
export const publishedArt = art.filter((item) => item.published && item.indexable);
export const blackAndWhiteArt = publishedArt.filter((item) => item.monochrome);
export const newestArt = newestFirst(publishedArt);
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
