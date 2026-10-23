import { art, topics } from './catalog';
import { buildSearchIndex, type SearchBuild } from './search-index.ts';
let cached: Promise<SearchBuild> | undefined;
export function getSearchBuild(): Promise<SearchBuild> {
  if (cached) return cached;
  cached = (async () => {
    const data = art.map((item) => ({
      ...item,
      cluster: topics.find((topic) => topic.slug === item.topic)?.cluster ?? '',
    }));
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('search-schema-1\n' + JSON.stringify({ data, topics })),
    );
    const version = Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, '0'),
    )
      .join('')
      .slice(0, 16);
    const build = buildSearchIndex(data, topics, version);
    // Includes artwork/editor pages, all topics and 200 shell/runtime files.
    // Media must be served from R2 at scale, not duplicated in Pages output.
    if (build.files.size + data.length * 2 + topics.length + 200 > 20000)
      throw new Error(
        'Projected Pages output exceeds the 20,000-file free-plan limit. Consolidate search shards before publishing.',
      );
    return build;
  })();
  return cached;
}
