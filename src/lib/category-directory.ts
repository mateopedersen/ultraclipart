import ownerCollectionContexts from '../../scripts/remaining-thirty-one-contexts.json';
import {
  art,
  availableTopics,
  availableClusters,
  slugify,
  clustersForTopic,
  topicInCluster,
} from './catalog';

const collectionStyle: Record<
  string,
  { title: string; description: string; color: string; subjects: string[] }
> = {
  'Animals & nature': {
    title: 'Animals & nature',
    description: 'Little creatures. Big personalities.',
    color: 'sage',
    subjects: ['fox', 'butterfly', 'baby-elephant'],
  },
  Halloween: {
    title: 'Halloween',
    description: 'A little spooky. A lot of fun.',
    color: 'peach',
    subjects: ['halloween', 'pumpkin', 'ghost'],
  },
  'Family & celebrations': {
    title: 'Family & celebrations',
    description: 'Make the little moments memorable.',
    color: 'rose',
    subjects: ['baby', 'dad'],
  },
  'Christmas & Winter': {
    title: 'Winter wonder',
    description: 'Cozy characters for chilly days.',
    color: 'ice',
    subjects: ['winter', 'penguin'],
  },
  "Valentine's Day": {
    title: 'Hearts & love',
    description: 'A thoughtful touch for someone special.',
    color: 'rose',
    subjects: ['heart'],
  },
  Sports: {
    title: 'Sports & play',
    description: 'Players, game-day details and bright moments in motion.',
    color: 'lavender',
    subjects: ['volleyball', 'basketball'],
  },
  'Thanksgiving & Autumn': {
    title: 'Autumn & gratitude',
    description: 'Warm colors and harvest-time details.',
    color: 'sand',
    subjects: ['thanksgiving', 'squirrel'],
  },
  'Food & drink': {
    title: 'Food & fresh ideas',
    description: 'Fresh fruit, favorite treats and playful kitchen inspiration.',
    color: 'peach',
    subjects: ['apple', 'pizza', 'cookie'],
  },
  'Nature & elements': {
    title: 'Nature & elements',
    description: 'Our planet, natural shapes and details drawn from the world around us.',
    color: 'sage',
    subjects: ['leaves', 'earth', 'beach'],
  },
  'School & learning': {
    title: 'School & learning',
    description: 'School days, favorite stories and reading moments.',
    color: 'ice',
    subjects: ['school', 'book', 'question-mark'],
  },
  'People & activities': {
    title: 'Everyday adventures',
    description: 'Curious minds, creative moments and characters in motion.',
    color: 'lavender',
    subjects: ['boy', 'girl', 'hat'],
  },
  'Arts & entertainment': {
    title: 'Arts & entertainment',
    description: 'Music, movies, games and character-inspired illustrations.',
    color: 'rose',
    subjects: ['music', 'movie'],
  },
  'Business & money': {
    title: 'Money & little lessons',
    description: 'Coins, savings and familiar details for learning about money.',
    color: 'sand',
    subjects: ['money'],
  },
  'Flags & countries': {
    title: 'Flags & countries',
    description: 'National colors, flag designs and country-themed details.',
    color: 'ice',
    subjects: ['american-flag', 'france-flag', 'mexico-flag'],
  },
  'Places & travel': {
    title: 'Places & travel',
    description: 'Landmarks, local food and little memories from a journey.',
    color: 'sand',
    subjects: ['paris', 'new-york', 'spain'],
  },
  'Transport & vehicles': {
    title: 'Transport & vehicles',
    description: 'Railway journeys, aircraft and electric-vehicle ideas.',
    color: 'ice',
    subjects: ['train', 'airplane', 'tesla'],
  },
  'Clothing & accessories': {
    title: 'Clothing & accessories',
    description: 'Everyday footwear, seasonal handwear and outfit details.',
    color: 'peach',
    subjects: ['shoe', 'glove', 'hat'],
  },
  'Space & science': {
    title: 'Space & science',
    description: 'Lunar details, red-planet exploration and imagined space scenes.',
    color: 'lavender',
    subjects: ['moon', 'mars', 'earth'],
  },
  'Technology & devices': {
    title: 'Technology & devices',
    description: 'Phones, household devices and familiar connected objects.',
    color: 'ice',
    subjects: ['iphone', 'samsung', 'smartphone'],
  },
};
const preferred: Record<string, string> = {
  fox: 'baby-fennec-fox-watercolor-clipart',
  baby: 'baby-girl-with-pink-bow-clipart',
  heart: 'floral-heart-roses-wreath-clipart',
  volleyball: 'female-volleyball-spike-dynamic-clipart',
  basketball: 'basketball-kids-playing-playful-clipart',
  winter: 'winter-penguin-cocoa',
  leaves: 'leaf-sugar-maple-five-lobed-autumn-watercolor-clipart',
  fire: 'fire-crossed-logs-campfire-colored-pencil-clipart',
  school: 'school-students-reading-in-library-classic-clipart',
  book: 'book-children-reading-together-classic-clipart',
  ...Object.fromEntries(
    Object.entries(ownerCollectionContexts).map(([topic, context]) => [topic, context.cover]),
  ),
};
const artworkByTopic = new Map<string, typeof art>();
for (const item of art) {
  const group = artworkByTopic.get(item.topic) ?? [];
  group.push(item);
  artworkByTopic.set(item.topic, group);
}
export const categorySubjects = availableTopics
  .map((topic) => {
    const items = artworkByTopic.get(topic.slug)!;
    const sample =
      items.find((item) => item.id === preferred[topic.slug]) ??
      items.find((item) => item.style === 'Color') ??
      items[0];
    const name = topic.keyword.replace(/\s+clipart$/i, '');
    return {
      ...topic,
      name: name[0].toUpperCase() + name.slice(1),
      count: items.length,
      sample,
      group: slugify(topic.cluster),
      groups: clustersForTopic(topic).map(slugify),
      color: collectionStyle[topic.cluster]?.color ?? 'sage',
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

const order = Object.keys(collectionStyle);
export const categoryCollections = availableClusters
  .map((cluster) => {
    const subjects = categorySubjects.filter((topic) => topicInCluster(topic, cluster));
    const design = collectionStyle[cluster] ?? {
      title: cluster,
      description: 'Find a new starting point for your next project.',
      color: 'sage',
      subjects: subjects.map((s) => s.slug),
    };
    const previews = design.subjects.flatMap((slug) => {
      const subject = subjects.find((s) => s.slug === slug);
      return subject ? [subject.sample] : [];
    });
    for (const subject of subjects) {
      for (const item of artworkByTopic.get(subject.slug)!) {
        if (previews.length >= 3) break;
        if (!previews.some((preview) => preview.id === item.id)) previews.push(item);
      }
      if (previews.length >= 3) break;
    }
    return {
      ...design,
      cluster,
      slug: slugify(cluster),
      subjects,
      previews: previews.slice(0, 3),
      count: subjects.reduce((sum, s) => sum + s.count, 0),
    };
  })
  .sort(
    (a, b) =>
      (order.indexOf(a.cluster) < 0 ? 999 : order.indexOf(a.cluster)) -
      (order.indexOf(b.cluster) < 0 ? 999 : order.indexOf(b.cluster)),
  );
