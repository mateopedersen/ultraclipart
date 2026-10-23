import { oneEditAway, queryTerms, type SearchState } from './search.ts';
import {
  tokenBucket,
  type RankedPage,
  type SearchCard,
  type SearchManifest,
} from './search-index.ts';

export class SearchHttpError extends Error {
  status: number;
  constructor(status: number) {
    super('The catalog could not be loaded.');
    this.status = status;
  }
}
export type JsonLoader = (path: string, signal?: AbortSignal) => Promise<unknown>;
const browserLoader: JsonLoader = async (path, signal) => {
  const response = await fetch(path, {
    signal,
    cache: path.endsWith('/manifest.json') ? 'no-cache' : 'default',
  });
  if (!response.ok) throw new SearchHttpError(response.status);
  return response.json();
};
export async function mapLimit<T, R>(
  values: T[],
  map: (value: T, index: number) => Promise<R>,
  limit = 8,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (next < values.length) {
        const index = next++;
        results[index] = await map(values[index], index);
      }
    }),
  );
  return results;
}
export interface RemoteResults {
  items: SearchCard[];
  total: number;
  pages: number;
  page: number;
  hasFuzzyMatches: boolean;
  manifest: SearchManifest;
}
export class SearchRepository {
  private loader: JsonLoader;
  private cache = new Map<string, unknown>();
  private cards = new Map<string, SearchCard>();
  constructor(loader: JsonLoader = browserLoader) {
    this.loader = loader;
  }
  seed(version: string, items: SearchCard[]) {
    for (const item of items) this.cards.set(`${version}/${item.id}`, item);
  }
  clear() {
    this.cache.clear();
    this.cards.clear();
  }
  private async json<T>(path: string, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    if (this.cache.has(path)) {
      const value = this.cache.get(path);
      this.cache.delete(path);
      this.cache.set(path, value);
      return value as T;
    }
    const value = await this.loader(path, signal);
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    this.cache.set(path, value);
    if (this.cache.size > 48) this.cache.delete(this.cache.keys().next().value!);
    return value as T;
  }
  async manifest(signal?: AbortSignal): Promise<SearchManifest> {
    const result = await this.json<SearchManifest>('/search-data/manifest.json', signal);
    if (
      result.schema !== 1 ||
      !Number.isInteger(result.total) ||
      result.total < 0 ||
      !/^[a-z0-9-]+$/.test(result.version)
    )
      throw new Error('The catalog needs to be refreshed.');
    return result;
  }
  private path(manifest: SearchManifest, path: string) {
    return `/search-data/${manifest.version}/${path}.json`;
  }
  async item(id: string, manifest: SearchManifest, signal?: AbortSignal): Promise<SearchCard> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new SearchHttpError(404);
    const key = `${manifest.version}/${id}`;
    const cached = this.cards.get(key);
    if (cached) return cached;
    const item = await this.json<SearchCard>(this.path(manifest, `items/${id}`), signal);
    if (item.id !== id || typeof item.title !== 'string' || typeof item.thumb !== 'string')
      throw new Error('An illustration could not be read.');
    this.cards.set(key, item);
    if (this.cards.size > 128) this.cards.delete(this.cards.keys().next().value!);
    return item;
  }
  async favoriteItems(ids: string[], signal?: AbortSignal) {
    const manifest = await this.manifest(signal);
    const load = async (current: SearchManifest) => {
      const items = await mapLimit(ids, async (id) => {
        try {
          return await this.item(id, current, signal);
        } catch (error) {
          if (error instanceof SearchHttpError && error.status === 404) return null;
          throw error;
        }
      });
      if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
      return items;
    };
    const items = await load(manifest);
    if (!items.some((item) => item === null)) return items;
    // A Pages deployment removes the old generation's shards. Confirm that the
    // generation is still current before presenting a 404 as removed artwork.
    this.cache.delete('/search-data/manifest.json');
    const current = await this.manifest(signal);
    return current.version === manifest.version ? items : load(current);
  }
  async search(state: SearchState, signal?: AbortSignal): Promise<RemoteResults> {
    const manifest = await this.manifest(signal),
      { tokens, wantsOutline } = queryTerms(state.q);
    const facetNames = (['style', 'color', 'format', 'orientation', 'background'] as const)
      .filter((key) => state[key])
      .map((key) => `${key}/${state[key]}`);
    if (wantsOutline && !facetNames.includes('style/outline')) facetNames.push('style/outline');
    const pagination = (total: number) => {
      const pages = Math.max(1, Math.ceil(total / state.size));
      return { total, pages, page: Math.min(pages, Math.max(1, state.page)) };
    };
    if (!tokens.length && !facetNames.length) {
      const meta = pagination(manifest.total),
        start = (meta.page - 1) * state.size,
        end = Math.min(start + state.size, manifest.total);
      const chunkIds = [];
      for (
        let chunk = Math.floor(start / manifest.pageChunk);
        chunk <= Math.floor(Math.max(start, end - 1) / manifest.pageChunk);
        chunk++
      )
        chunkIds.push(chunk);
      const chunks = await mapLimit(chunkIds, (chunk) =>
        this.json<RankedPage>(
          this.path(manifest, `ranked/${state.sort === 'newest' ? 'newest' : 'title'}/${chunk}`),
          signal,
        ),
      );
      const ids = chunks
        .flatMap((chunk) => chunk.ids)
        .slice(start % manifest.pageChunk, (start % manifest.pageChunk) + state.size);
      return {
        ...meta,
        items: await mapLimit(ids, (id) => this.item(id, manifest, signal)),
        hasFuzzyMatches: false,
        manifest,
      };
    }
    const allowedSets = await mapLimit(
      facetNames,
      async (name) =>
        new Set(
          manifest.facets.includes(name)
            ? await this.json<number[]>(this.path(manifest, `facets/${name}`), signal)
            : [],
        ),
    );
    if (allowedSets.some((set) => set.size === 0))
      return { ...pagination(0), items: [], hasFuzzyMatches: false, manifest };
    const lengths = new Set(
      tokens
        .filter((token) => token.length >= 5)
        .flatMap((token) => [token.length - 1, token.length, token.length + 1]),
    );
    const dictionaries = await mapLimit(
      manifest.lexiconLengths.filter((length) => lengths.has(length)),
      (length) => this.json<string[]>(this.path(manifest, `lexicon/${length}`), signal),
    );
    const vocabulary = dictionaries.flat();
    const expansions = tokens.map((token) => ({
      token,
      words: [token, ...vocabulary.filter((word) => word !== token && oneEditAway(token, word))],
    }));
    const bucketNames = [
      ...new Set(expansions.flatMap((expansion) => expansion.words.map(tokenBucket))),
    ];
    const fetched = await mapLimit(bucketNames, (key) =>
      this.json<Record<string, number[]>>(this.path(manifest, `tokens/${key}`), signal),
    );
    const buckets = new Map(bucketNames.map((name, index) => [name, fetched[index]]));
    const termMaps = expansions.map(({ token, words }) => {
      const matches = new Map<number, number>();
      for (const word of words)
        for (const entry of buckets.get(tokenBucket(word))?.[word] ?? []) {
          const ordinal = Math.floor(entry / 8),
            score = word === token ? entry % 8 : 1;
          matches.set(ordinal, Math.max(matches.get(ordinal) ?? 0, score));
        }
      return matches;
    });
    let candidates: number[];
    if (termMaps.length)
      candidates = [
        ...termMaps.reduce((small, set) => (set.size < small.size ? set : small)).keys(),
      ];
    else
      candidates = allowedSets.length
        ? [...allowedSets.reduce((small, set) => (set.size < small.size ? set : small))]
        : [];
    const ranked = candidates
      .filter(
        (id) => allowedSets.every((set) => set.has(id)) && termMaps.every((map) => map.has(id)),
      )
      .map((id) => ({
        id,
        score: termMaps.reduce((sum, map) => sum + map.get(id)!, 0),
        fuzzy: termMaps.some((map) => map.get(id) === 1),
      }));
    let newestRank: Map<number, number> | undefined;
    if (state.sort === 'newest') {
      const order = await this.json<number[]>(this.path(manifest, 'order/newest'), signal);
      newestRank = new Map(order.map((id, rank) => [id, rank]));
    }
    ranked.sort((a, b) =>
      state.sort === 'newest'
        ? newestRank!.get(a.id)! - newestRank!.get(b.id)!
        : state.sort === 'title'
          ? a.id - b.id
          : b.score - a.score || a.id - b.id,
    );
    const meta = pagination(ranked.length),
      selected = ranked.slice((meta.page - 1) * state.size, meta.page * state.size);
    const idChunks = [...new Set(selected.map((item) => Math.floor(item.id / manifest.pageChunk)))];
    const idPages = await mapLimit(idChunks, (index) =>
      this.json<string[]>(this.path(manifest, `ids/${index}`), signal),
    );
    const lookup = new Map(idChunks.map((chunk, index) => [chunk, idPages[index]]));
    const ids = selected.map(
      (item) => lookup.get(Math.floor(item.id / manifest.pageChunk))![item.id % manifest.pageChunk],
    );
    return {
      ...meta,
      items: await mapLimit(ids, (id) => this.item(id, manifest, signal)),
      hasFuzzyMatches: selected.some((item) => item.fuzzy),
      manifest,
    };
  }
}
