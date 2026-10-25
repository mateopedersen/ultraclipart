import { publishedArt } from './catalog';
export const FEATURED_ARTWORK_LIMIT = 500;
const subjects = new Map<string, typeof publishedArt>();
for (const item of publishedArt) {
  if (item.sourceType !== 'raster') continue;
  const group = subjects.get(item.topic) ?? [];
  group.push(item);
  subjects.set(item.topic, group);
}
for (const group of subjects.values())
  group.sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) ||
      Number(a.monochrome) - Number(b.monochrome) ||
      a.title.localeCompare(b.title, 'en'),
  );
const groups = [...subjects.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, items]) => items);
export const featuredStudioArt: typeof publishedArt = [];
for (
  let index = 0;
  featuredStudioArt.length < FEATURED_ARTWORK_LIMIT && groups.some((group) => group[index]);
  index++
) {
  for (const group of groups) {
    if (group[index]) featuredStudioArt.push(group[index]);
    if (featuredStudioArt.length === FEATURED_ARTWORK_LIMIT) break;
  }
}
export const featuredStudioIds = new Set(featuredStudioArt.map((item) => item.id));
