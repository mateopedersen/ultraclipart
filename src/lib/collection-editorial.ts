import summaries from '../../data/editorial/collections.json';

/** Source validity is checked in Astro config, including direct builds and local development. */
export function collectionIntroduction(slug: string): string {
  const record = (summaries.topics as Record<string, { intro: string }>)[slug];
  if (!record) throw new Error(`Missing topic-specific introduction: ${slug}`);
  return record.intro;
}
