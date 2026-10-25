import { fingerprint } from './cache-fingerprint';
import {
  publishedArt,
  blackAndWhiteArt,
  availableTopics,
  availableClusters,
  topicInCluster,
  slugify,
} from './catalog';
import type { CatalogCounts } from './catalog-counts';

const topics: Record<string, number> = Object.fromEntries(
  availableTopics.map((topic) => [topic.slug, 0]),
);
for (const item of publishedArt) {
  if (Object.hasOwn(topics, item.topic)) topics[item.topic]++;
}
const collections = Object.fromEntries(
  availableClusters.map((cluster) => {
    const subjects = availableTopics.filter((topic) => topicInCluster(topic, cluster));
    return [
      slugify(cluster),
      {
        artworks: subjects.reduce((total, topic) => total + topics[topic.slug], 0),
        subjects: subjects.length,
      },
    ];
  }),
);
const totals = {
  artworks: publishedArt.length,
  subjects: availableTopics.length,
  collections: availableClusters.length,
  printable: blackAndWhiteArt.length,
};
const values = { totals, topics, collections };
// One stable release identity changes for additions, removals and regrouping.
export const catalogStatistics: CatalogCounts = {
  schema: 1,
  version: fingerprint(values),
  ...values,
};
