import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { assertCatalogPolicy } from './catalog-policy.mjs';
export function checkSourceCatalog(root = new URL('../../', import.meta.url)) {
  const json = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
  return assertCatalogPolicy({
    artwork: json('data/art.json'),
    topics: [...json('data/topics.json').topics, ...json('data/extra-topics.json')],
    relations: json('data/topic-relations.json'),
    browseGroups: json('data/browse-groups.json'),
    primaryCategories: json('data/primary-topic-categories.json'),
    metadataReviews: json('data/image-metadata-reviews.json').artwork,
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(checkSourceCatalog(), null, 2));
