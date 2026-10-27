import { downloadDetails } from './download-data';
import { publishedArt as art, topics, availableTopics, clustersForTopic, slugify } from './catalog';
import { monochromeDirectory } from './monochrome-library';
import { buildSearchIndex, type SearchBuild } from './search-index.ts';
import { assertPagesFileCount } from './pages-limits';
import { buildSiteSearch } from './site-search-build';
import { SEARCH_LANGUAGE_VERSION } from './search-language';
import { PUBLICATION_ORDER_VERSION } from './publication-order.ts';
let cached: Promise<SearchBuild> | undefined;
export function getSearchBuild(): Promise<SearchBuild> {
  if (cached) return cached;
  cached = (async () => {
    const topicsBySlug = new Map(topics.map((topic) => [topic.slug, topic]));
    const data = art.map((item) => {
      const topic = topicsBySlug.get(item.topic);
      return {
        ...item,
        download: downloadDetails(item),
        cluster: topic?.cluster ?? '',
        topicLabel: topic?.keyword || item.topic,
        keywords: topic ? [topic.keyword] : [],
        collections: topic ? clustersForTopic(topic).map(slugify) : [],
      };
    });
    const site = buildSiteSearch();
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(
        `search-${SEARCH_LANGUAGE_VERSION}-publication-${PUBLICATION_ORDER_VERSION}\n` +
          JSON.stringify({ data, topics, monochrome: monochromeDirectory, site }),
      ),
    );
    const version = Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, '0'),
    )
      .join('')
      .slice(0, 16);
    const build = buildSearchIndex(data, availableTopics, version);
    build.manifest.monochrome = monochromeDirectory;
    build.manifest.site = 'site';
    build.files.set(`${version}/site`, site);
    // Includes artwork/editor pages, all topics and 200 shell/runtime files.
    // Media must be served from R2 at scale, not duplicated in Pages output.
    assertPagesFileCount(build.files.size + data.length * 2 + topics.length + 200);
    return build;
  })();
  return cached;
}
