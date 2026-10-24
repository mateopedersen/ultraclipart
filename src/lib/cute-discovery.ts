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
const unsuitable =
  /halloween|horror|spooky|scary|frighten|vampire|skeleton|zombie|witch|angry|aggressive|growling|roaring|fierce|fangs|weapon|skull|crying/i;
const signals: [RegExp, number][] = [
  [/\b(kawaii|chibi|cute|adorable)\b/, 96],
  [/\b(smiling|smile|cheerful|happy|joyful)\b/, 88],
  [/\b(baby|newborn|nursery|calf|cub|chick|kitten|puppy|fawn|joey|owlet|eaglet)\b/, 82],
  [/\b(plush|knitted|cuddling|hugging)\b/, 76],
];

export function cuteConfidence(item: DiscoveryArtwork): number {
  if (!/^[a-z0-9-]+$/.test(item.id) || !/^[a-z0-9-]+$/.test(item.topic)) return 0;
  if (
    item.published === false ||
    item.indexable === false ||
    item.discovery?.exclude ||
    item.discovery?.cute === false
  )
    return 0;
  const identity = `${item.id} ${item.title}`.toLowerCase().replace(/-/g, ' ');
  if (mono.test(`${item.style} ${item.id} ${item.title}`) || unsuitable.test(identity)) return 0;
  if (/\b(not cute|non cute|not smiling|unhappy)\b/.test(identity)) return 0;
  const tags = (Array.isArray(item.tags) ? item.tags : [])
    .filter((x) => typeof x === 'string')
    .join(' ');
  const primary = `${identity} ${tags}`.toLowerCase();
  const alt = (item.alt ?? '').toLowerCase().replace(/-/g, ' ');
  if (/\b(angry|aggressive|growling|fierce|fangs|crying)\b/.test(alt)) return 0;
  if (item.discovery?.cute === true) return 100;
  // A real, positive subject cue is required. Medium/color alone never implies cute.
  let score = 0;
  for (const [pattern, weight] of signals) {
    if (pattern.test(primary)) score = Math.max(score, weight);
    else if (pattern.test(alt)) score = Math.max(score, weight - 8);
  }
  return score >= 68 ? score : 0;
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
  const varied = available.filter((x) => x.topic !== lastTopic);
  if (varied.length) available = varied;
  const groups = new Map<string, CutePick[]>();
  for (const item of available) {
    const group = groups.get(item.topic) ?? [];
    group.push(item);
    groups.set(item.topic, group);
  }
  const choose = <T>(pool: T[]) =>
    pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
  return choose(choose([...groups.values()]));
}
