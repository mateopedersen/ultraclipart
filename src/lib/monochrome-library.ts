import {
  blackAndWhiteArt,
  availableTopics,
  availableClusters,
  clustersForTopic,
  slugify,
} from './catalog';
import type { MonochromeDirectory } from './monochrome';

const topics = availableTopics
  .flatMap((topic) => {
    const count = blackAndWhiteArt.filter((item) => item.topic === topic.slug).length;
    return count
      ? [
          {
            slug: topic.slug,
            label: topic.keyword.replace(/\s+clipart$/i, ''),
            count,
            collections: clustersForTopic(topic).map(slugify),
          },
        ]
      : [];
  })
  .sort((a, b) => a.label.localeCompare(b.label, 'en'));

export const monochromeDirectory: MonochromeDirectory = {
  total: blackAndWhiteArt.length,
  topics,
  collections: availableClusters
    .flatMap((label) => {
      const slug = slugify(label);
      const count = topics
        .filter((topic) => topic.collections.includes(slug))
        .reduce((sum, topic) => sum + topic.count, 0);
      const title = label
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return count ? [{ slug, label: title, count }] : [];
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'en')),
  kinds: [
    {
      slug: 'outline',
      label: 'Line Art',
      count: blackAndWhiteArt.filter((item) => item.monochromeKind === 'outline').length,
    },
    {
      slug: 'grayscale',
      label: 'Shaded & Ink Drawings',
      count: blackAndWhiteArt.filter((item) => item.monochromeKind === 'grayscale').length,
    },
    {
      slug: 'silhouette',
      label: 'Silhouettes',
      count: blackAndWhiteArt.filter((item) => item.monochromeKind === 'silhouette').length,
    },
  ].filter((kind) => kind.count) as MonochromeDirectory['kinds'],
};
