import { art, topics, availableTopics } from './catalog';
import { buildSearchIndex, type SearchBuild } from './search-index.ts';
import { assertPagesFileCount } from './pages-limits';
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
      new TextEncoder().encode('search-schema-2-chunk256\n' + JSON.stringify({ data, topics })),
    );
    const version = Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, '0'),
    )
      .join('')
      .slice(0, 16);
    const build = buildSearchIndex(data, availableTopics, version);
    // Includes artwork/editor pages, all topics and 200 shell/runtime files.
    // Media must be served from R2 at scale, not duplicated in Pages output.
    assertPagesFileCount(build.files.size + data.length * 2 + topics.length + 200);
    return build;
  })();
  return cached;
}
