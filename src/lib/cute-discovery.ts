/** Publisher metadata recognition, not a claim of pixel-based image recognition. */
export interface DiscoveryArtwork {
  id: string;
  topic: string;
  title: string;
  alt?: string;
  style: string;
  published?: boolean;
  indexable?: boolean;
  tags?: string[];
  discovery?: { cute?: boolean; exclude?: boolean };
}
export interface CutePick {
  id: string;
  topic: string;
}
const mono =
  /black[\s&-]*(?:and[\s&-]*)?white|b\s*&\s*w|gr[ae]yscale|monochrome|outline|silhouette|coloring|charcoal|engraving|linocut|line[\s-]*art|dotwork|stipple/i;
export const SURPRISE_INDEX_VERSION = 2;
const unsuitable =
  /\b(halloween|horror|spooky|scary|frighten(?:ed|ing)?|vampire|skeleton|zombie|witch|angry|aggressive|growling|roaring|fierce|fangs|weapon|skull|crying|sad|unhappy|grief|lonely|political|election|military|gun|sword|blood)\b/i;
const animalTopics = new Set(
  'baby-elephant bat bear bee butterfly camel cat chicken cow crab crocodile deer dog dolphin duck eagle elephant flamingo fox frog giraffe goat hedgehog hippo horse kangaroo kiwi koala lamb lion lobster monkey octopus owl panda parrot peacock penguin pig rabbit raccoon rhino shark sheep snake spider squirrel tiger turkey turtle whale wolf zebra'.split(
    ' ',
  ),
);
const familyTopics = new Set(['baby', 'boy', 'girl', 'mom', 'dad']);
const playfulTopics = new Set(
  'apple apricot avocado banana blackberry blackcurrant blueberry cantaloupe cherry coconut cranberry date dragon-fruit fig gooseberry grapefruit grapes green-apple guava heart kiwi-fruit kumquat lemon lime lychee mandarin mango melon mulberry nectarine orange papaya passion-fruit peach pear persimmon pineapple plum pomegranate pumpkin quince raspberry red-apple starfruit strawberry tangerine watermelon'.split(
    ' ',
  ),
);
const emotion =
  /\b(smiling|smile|grinning|cheerful|happy|joyful|laughing|giggling|playful|waving|dancing|celebrating|delighted)\b/i;
const affection =
  /\b(cuddling|cuddle|hugging|hug|snuggling|snuggle|affectionate|tender|loving|cradling|reading together)\b/i;
const juvenile =
  /\b(baby|newborn|nursery|calf|cub|chick|kitten|puppy|fawn|joey|owlet|eaglet|toddler)\b/i;
const cuteStyle = /\b(kawaii|chibi|cute|adorable)\b/i;
const face = /\b(face|eyes|eyed|character|mascot|arms|legs|hands|feet)\b/i;
const craftedObject =
  /\b(knit|knitted|knitting|crochet|crocheted|amigurumi|embroidery|embroidered|felt|origami|papercut|paper cut)\b/i;
const excludedTopics =
  /^(?:.*-flag|political-.*|red-and-blue-states|democrat-donkey|republican-elephant|tesla|electric-car|iphone|samsung|.*monster|godzilla.*|kaiju|gta.*|grand-theft-auto|hunger-games|sunrise-on-the-reaping)$/;

export function cuteConfidence(item: DiscoveryArtwork): number {
  if (!/^[a-z0-9-]+$/.test(item.id) || !/^[a-z0-9-]+$/.test(item.topic)) return 0;
  if (
    item.published === false ||
    item.indexable === false ||
    item.discovery?.exclude ||
    item.discovery?.cute === false
  )
    return 0;
  const tags = (Array.isArray(item.tags) ? item.tags : [])
    .filter((value) => typeof value === 'string')
    .join(' ');
  const text = `${item.id} ${item.title} ${item.alt ?? ''} ${tags}`
    .toLowerCase()
    .replace(/-/g, ' ');
  if (
    mono.test(`${item.style} ${text}`) ||
    unsuitable.test(text) ||
    excludedTopics.test(item.topic)
  )
    return 0;
  if (/\b(not cute|non cute|not smiling)\b/.test(text)) return 0;
  const animal = animalTopics.has(item.topic),
    family = familyTopics.has(item.topic);
  const animate = animal || family || item.topic === 'robot';
  // A medium is never evidence of a happy subject. In particular, textile food
  // and decorative objects do not become eligible because their material is soft.
  if (!animate && craftedObject.test(text)) return 0;
  if (animate) {
    if (item.discovery?.cute === true) return 100;
    if (affection.test(text)) return 96;
    if (emotion.test(text)) return 90;
    if ((animal || family) && juvenile.test(text)) return 86;
    if (cuteStyle.test(text) && (animal || face.test(text))) return 80;
    return 0;
  }
  // A cheerful anthropomorphic character can qualify; a still life, craft,
  // color, style label or generic "cute" tag on its own cannot.
  if (
    (playfulTopics.has(item.topic) || item.discovery?.cute === true) &&
    face.test(text) &&
    emotion.test(text)
  )
    return item.discovery?.cute === true ? 96 : 78;
  return 0;
}

function hash(value: string) {
  let n = 2166136261;
  for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619);
  n ^= n >>> 16;
  n = Math.imul(n, 0x85ebca6b);
  n ^= n >>> 13;
  return (n ^ (n >>> 16)) >>> 0;
}
type Ranked = CutePick & { priority: number };

/** Weighted streaming reservoir: O(N log K) processing, O(K) memory, no per-click scan. */
export function buildCuteIndex(
  items: Iterable<DiscoveryArtwork>,
  capacity = 512,
  seed = 'ultraclipart',
) {
  const limit = Math.max(1, Math.min(512, Math.floor(capacity) || 1));
  const heap: Ranked[] = [];
  const included = new Set<string>();
  const swap = (a: number, b: number) => {
    [heap[a], heap[b]] = [heap[b], heap[a]];
  };
  for (const item of items) {
    const score = cuteConfidence(item);
    if (!score || included.has(item.id)) continue;
    const priority = -Math.log((hash(`${seed}:${item.id}`) + 0.5) / 4294967296) / score;
    const candidate = { id: item.id, topic: item.topic, priority };
    if (heap.length < limit) {
      heap.push(candidate);
      included.add(item.id);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >>> 1;
        if (heap[p].priority >= heap[i].priority) break;
        swap(p, i);
        i = p;
      }
    } else if (priority < heap[0].priority) {
      included.delete(heap[0].id);
      heap[0] = candidate;
      included.add(item.id);
      let i = 0;
      while (true) {
        const l = i * 2 + 1,
          r = l + 1;
        let w = i;
        if (l < heap.length && heap[l].priority > heap[w].priority) w = l;
        if (r < heap.length && heap[r].priority > heap[w].priority) w = r;
        if (w === i) break;
        swap(i, w);
        i = w;
      }
    }
  }
  return heap
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .map(({ id, topic }) => ({ id, topic }));
}

export function validCuteIndex(value: unknown): CutePick[] {
  if (!Array.isArray(value) || value.length > 512) return [];
  const seen = new Set<string>();
  return value
    .filter((item): item is CutePick => {
      if (
        !item ||
        typeof item.id !== 'string' ||
        typeof item.topic !== 'string' ||
        !/^[a-z0-9-]+$/.test(item.id) ||
        !/^[a-z0-9-]+$/.test(item.topic) ||
        seen.has(item.id)
      )
        return false;
      seen.add(item.id);
      return true;
    })
    .map(({ id, topic }) => ({ id, topic }));
}

export function pickCute(
  items: readonly CutePick[],
  recent: readonly string[],
  current = '',
  random = Math.random,
) {
  const currentSafe = items.filter((x) => x.id !== current);
  let available = currentSafe.filter((x) => !recent.includes(x.id));
  if (!available.length) available = currentSafe.filter((x) => x.id !== recent[0]);
  if (!available.length) available = currentSafe;
  if (!available.length) return null;
  const lastTopic = items.find((x) => x.id === recent[0])?.topic;
  const recentTopics = new Set(
    recent.slice(0, 3).flatMap((id) => items.find((item) => item.id === id)?.topic ?? []),
  );
  const varied = available.filter((x) => !recentTopics.has(x.topic));
  const differentLast = available.filter((x) => x.topic !== lastTopic);
  if (varied.length) available = varied;
  else if (differentLast.length) available = differentLast;
  const groups = new Map<string, CutePick[]>();
  for (const item of available) {
    const group = groups.get(item.topic) ?? [];
    group.push(item);
    groups.set(item.topic, group);
  }
  const choose = <T>(pool: T[]) =>
    pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
  // Balance subjects rather than letting the number of fruit/material variants
  // dominate discovery. Warm family scenes and expressive animals get priority.
  const weighted = [...groups.entries()].map(([topic, picks]) => ({
    picks,
    weight: familyTopics.has(topic) ? 5 : animalTopics.has(topic) ? 4 : topic === 'robot' ? 2 : 1,
  }));
  let position =
    Math.max(0, Math.min(0.9999999999999999, random())) *
    weighted.reduce((total, group) => total + group.weight, 0);
  for (const group of weighted) {
    position -= group.weight;
    if (position < 0) return choose(group.picks);
  }
  return choose(weighted[weighted.length - 1].picks);
}
