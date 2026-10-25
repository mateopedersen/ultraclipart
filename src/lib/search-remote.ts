import { oneEditAway, queryTerms, normalizeQuery, type SearchState } from './search.ts';
import { termVariants, relevanceScore, type TermMatch } from './search-language.ts';
import type { SiteSearchEntry } from './site-search.ts';
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
  relatedItems?: SearchCard[];
  relatedMissing?: Record<string, string[]>;
}
export class SearchRepository {
  private loader: JsonLoader;
  private cache = new Map<string, unknown>();
  private cards = new Map<string, SearchCard>();
  private siteCache = new Map<string, SiteSearchEntry[]>();
  private pending = new Map<string, { signal?: AbortSignal; value: Promise<unknown> }>();
  private generation = 0;
  constructor(loader: JsonLoader = browserLoader) {
    this.loader = loader;
  }
  seed(version: string, items: SearchCard[]) {
    for (const item of items) this.cards.set(`${version}/${item.id}`, item);
  }
  clear() {
    this.generation++;
    this.cache.clear();
    this.cards.clear();
    this.siteCache.clear();
    this.pending.clear();
  }
  private async json<T>(path: string, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    if (this.cache.has(path)) {
      const value = this.cache.get(path);
      this.cache.delete(path);
      this.cache.set(path, value);
      return value as T;
    }
    // Adjacent cards share a chunk. Coalesce only callers with the same
    // cancellation scope, so aborting an old search cannot cancel a new one.
    const pending = this.pending.get(path);
    if (pending && pending.signal === signal) return pending.value as Promise<T>;
    const generation = this.generation;
    const operation = (async () => {
      const value = await this.loader(path, signal);
      if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
      if (generation === this.generation) {
        this.cache.set(path, value);
        if (this.cache.size > 48) this.cache.delete(this.cache.keys().next().value!);
      }
      return value;
    })();
    this.pending.set(path, { signal, value: operation });
    try {
      return (await operation) as T;
    } finally {
      if (this.pending.get(path)?.value === operation) this.pending.delete(path);
    }
  }
  async manifest(signal?: AbortSignal): Promise<SearchManifest> {
    const result = await this.json<SearchManifest>('/search-data/manifest.json', signal);
    if (
      result.schema !== 1 ||
      !Number.isInteger(result.total) ||
      result.total < 0 ||
      (result.site !== undefined && result.site !== 'site') ||
      (result.ranking !== undefined && result.ranking !== 2) ||
      !/^[a-z0-9-]+$/.test(result.version) ||
      (result.cardChunk !== undefined &&
        (!Number.isInteger(result.cardChunk) || result.cardChunk < 1 || result.cardChunk > 32))
    )
      throw new Error('The catalog needs to be refreshed.');
    return result;
  }
  private path(manifest: SearchManifest, path: string) {
    return `/search-data/${manifest.version}/${path}.json`;
  }
  async item(
    id: string,
    manifest: SearchManifest,
    signal?: AbortSignal,
    ordinal?: number,
  ): Promise<SearchCard> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new SearchHttpError(404);
    const key = `${manifest.version}/${id}`;
    const cached = this.cards.get(key);
    if (cached) return cached;
    let item: SearchCard;
    if (manifest.cardChunk) {
      // Search already knows ordinals. Only arbitrary saved IDs need the small
      // hashed location table; the manifest never embeds the whole catalog.
      if (ordinal === undefined) {
        const locations = await this.json<Record<string, number>>(
          this.path(manifest, `locations/${tokenBucket(id)}`),
          signal,
        );
        ordinal = locations[id];
      }
      if (!Number.isInteger(ordinal) || ordinal! < 0 || ordinal! >= manifest.total)
        throw new SearchHttpError(404);
      const chunk = await this.json<SearchCard[]>(
        this.path(manifest, `items/${Math.floor(ordinal! / manifest.cardChunk)}`),
        signal,
      );
      if (!Array.isArray(chunk) || chunk.length > manifest.cardChunk)
        throw new Error('An illustration could not be read.');
      item = chunk[ordinal! % manifest.cardChunk];
    } else {
      item = await this.json<SearchCard>(this.path(manifest, `items/${id}`), signal);
    }
    if (item?.id !== id || typeof item.title !== 'string' || typeof item.thumb !== 'string')
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
  private async performSearch(
    state: SearchState,
    signal?: AbortSignal,
    scope: readonly string[] = [],
  ): Promise<RemoteResults> {
    const manifest = await this.manifest(signal),
      { tokens, excluded, wantsOutline, wantsMonochrome, wantsTransparent } = queryTerms(state.q);
    const facetNames = (['style', 'color', 'format', 'orientation', 'background'] as const)
      .filter((key) => state[key])
      .map((key) =>
        key === 'style' && state.style === 'black & white'
          ? 'print/monochrome'
          : key === 'style' && state.style === 'outline' && manifest.ranking === 2
            ? 'print/outline'
            : `${key}/${state[key]}`,
      );
    facetNames.push(...scope);
    if (wantsOutline) facetNames.push(manifest.ranking === 2 ? 'print/outline' : 'style/outline');
    if (wantsTransparent && !facetNames.includes('background/transparent'))
      facetNames.push('background/transparent');
    if (wantsMonochrome) facetNames.push('print/monochrome');
    const pagination = (total: number) => {
      const pages = Math.max(1, Math.ceil(total / state.size));
      return { total, pages, page: Math.min(pages, Math.max(1, state.page)) };
    };
    if (!tokens.length && !facetNames.length && !excluded.length) {
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
      const ordinals = chunks
        .flatMap((chunk) => chunk.ordinals)
        .slice(start % manifest.pageChunk, (start % manifest.pageChunk) + state.size);
      return {
        ...meta,
        items: await mapLimit(ids, (id, index) => this.item(id, manifest, signal, ordinals[index])),
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
    const loaded = new Map<string, Record<string, number[]>>();
    const loadWords = async (words: string[]) => {
      const keys = [...new Set(words.map(tokenBucket))].filter((key) => !loaded.has(key));
      const values = await mapLimit(keys, (key) =>
        this.json<Record<string, number[]>>(this.path(manifest, `tokens/${key}`), signal),
      );
      keys.forEach((key, i) => loaded.set(key, values[i]));
    };
    const variants = tokens.map(termVariants);
    const excludedWords = excluded.flatMap(termVariants);
    await loadWords([...variants.flat(), ...excludedWords]);
    const denied = new Set<number>();
    for (const word of excludedWords)
      for (const entry of loaded.get(tokenBucket(word))?.[word] || [])
        denied.add(Math.floor(entry / 8));
    const eligible = (id: number) => !denied.has(id) && allowedSets.every((set) => set.has(id));
    const mapsFor = (expansions: string[][], fuzzy = false) =>
      expansions.map((words, index) => {
        const matches = new Map<number, TermMatch>();
        for (const word of words) {
          const bucket = loaded.get(tokenBucket(word));
          const positions = new Map<number, number[]>();
          for (const entry of bucket?.['^' + word] || []) {
            const id = Math.floor(entry / 64);
            positions.set(id, [...(positions.get(id) || []), entry % 64]);
          }
          for (const entry of bucket?.[word] || []) {
            if (tokens.length > 1 && entry % 8 < 3) continue;
            const id = Math.floor(entry / 8);
            if (!eligible(id)) continue;
            const approximate = fuzzy && !variants[index].includes(word);
            const value: TermMatch = {
              weight: approximate
                ? Math.min(3, entry % 8)
                : (entry % 8) - (word === tokens[index] ? 0 : 0.5),
              fuzzy: approximate,
              positions: positions.get(id) || [],
            };
            const previous = matches.get(id);
            if (!previous) matches.set(id, value);
            else
              matches.set(id, {
                weight: Math.max(previous.weight, value.weight),
                fuzzy: previous.fuzzy && value.fuzzy,
                positions: [...new Set([...previous.positions, ...value.positions])],
              });
          }
        }
        return matches;
      });
    const rank = (maps: Map<number, TermMatch>[]) => {
      const candidates = maps.length
        ? [...maps.reduce((small, map) => (map.size < small.size ? map : small)).keys()]
        : allowedSets.length
          ? [...allowedSets.reduce((small, set) => (set.size < small.size ? set : small))]
          : Array.from({ length: manifest.total }, (_, i) => i);
      return candidates
        .filter((id) => eligible(id) && maps.every((map) => map.has(id)))
        .map((id) => {
          const matches = maps.map((map) => map.get(id)!);
          return {
            id,
            score: relevanceScore(matches),
            fuzzy: matches.some((match) => match.fuzzy),
          };
        });
    };
    let termMaps = mapsFor(variants),
      ranked = rank(termMaps);
    // An exact search does not pay for spelling dictionaries, nor mix in misspellings.
    if (!ranked.length && tokens.length) {
      const lengths = new Set(
        tokens
          .filter((token) => token.length >= 4)
          .flatMap((token) => [token.length - 1, token.length, token.length + 1]),
      );
      const dictionaries = await mapLimit(
        manifest.lexiconLengths.filter((length) => lengths.has(length)),
        (length) => this.json<string[]>(this.path(manifest, `lexicon/${length}`), signal),
      );
      const last = tokens[tokens.length - 1];
      const prefix =
        last.length >= 3 && manifest.lexiconInitials?.includes(last[0])
          ? await this.json<string[]>(this.path(manifest, `prefix/${last[0]}`), signal)
          : [];
      const vocabulary = [...new Set([...dictionaries.flat(), ...prefix])];
      const expanded = variants.map((words, i) => [
        ...words,
        ...vocabulary
          .filter(
            (word) =>
              !words.includes(word) &&
              (oneEditAway(tokens[i], word) ||
                (i === tokens.length - 1 && tokens[i].length >= 3 && word.startsWith(tokens[i]))),
          )
          .sort(
            (a, b) =>
              Math.abs(a.length - tokens[i].length) - Math.abs(b.length - tokens[i].length) ||
              a.localeCompare(b),
          )
          .slice(0, 16),
      ]);
      await loadWords(expanded.flat());
      termMaps = mapsFor(expanded, true);
      ranked = rank(termMaps);
    }
    let related: { id: number; score: number; missing: string[] }[] = [];
    if (!ranked.length && tokens.length >= 3) {
      const topicWords = new Set(manifest.topics.flatMap((topic) => normalizeQuery(topic.keyword)));
      const anchors = tokens.flatMap((token, i) => (topicWords.has(token) ? [i] : []));
      const candidates = new Set(termMaps.flatMap((map) => [...map.keys()]));
      related = [...candidates]
        .filter(eligible)
        .flatMap((id) => {
          const matches = termMaps.flatMap((map) => (map.has(id) ? [map.get(id)!] : []));
          if (
            matches.length < Math.max(2, Math.ceil(tokens.length * 0.65)) ||
            !anchors.every((i) => termMaps[i].has(id))
          )
            return [];
          return [
            {
              id,
              score: matches.length * 20 + relevanceScore(matches),
              missing: tokens.filter((_, i) => !termMaps[i].has(id)),
            },
          ];
        })
        .sort((a, b) => b.score - a.score || a.id - b.id)
        .slice(0, 8);
    }
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
    const resolve = async (ordinals: number[]) => {
      const chunks = [...new Set(ordinals.map((id) => Math.floor(id / manifest.pageChunk)))];
      const pages = await mapLimit(chunks, (index) =>
        this.json<string[]>(this.path(manifest, `ids/${index}`), signal),
      );
      const lookup = new Map(chunks.map((chunk, i) => [chunk, pages[i]]));
      return mapLimit(ordinals, (id) =>
        this.item(
          lookup.get(Math.floor(id / manifest.pageChunk))![id % manifest.pageChunk],
          manifest,
          signal,
          id,
        ),
      );
    };
    const items = await resolve(selected.map((item) => item.id));
    const relatedItems = await resolve(related.map((item) => item.id));
    return {
      ...meta,
      items,
      hasFuzzyMatches: selected.some((item) => item.fuzzy),
      manifest,
      relatedItems,
      relatedMissing: Object.fromEntries(
        relatedItems.map((item, i) => [item.id, related[i].missing]),
      ),
    };
  }
  async siteEntries(manifest: SearchManifest, signal?: AbortSignal): Promise<SiteSearchEntry[]> {
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    const cached = this.siteCache.get(manifest.version);
    if (cached) return cached;
    let current = manifest,
      entries: SiteSearchEntry[];
    try {
      entries = current.site
        ? await this.json<SiteSearchEntry[]>(this.path(current, current.site), signal)
        : [];
    } catch (error) {
      if (!(error instanceof SearchHttpError) || ![404, 410].includes(error.status)) throw error;
      this.clear();
      current = await this.manifest(signal);
      entries = current.site
        ? await this.json<SiteSearchEntry[]>(this.path(current, current.site), signal)
        : [];
    }
    if (
      !Array.isArray(entries) ||
      entries.some(
        (entry) =>
          !entry ||
          typeof entry.title !== 'string' ||
          typeof entry.text !== 'string' ||
          typeof entry.description !== 'string' ||
          !['topic', 'collection', 'guide', 'tool', 'page', 'studio'].includes(entry.kind) ||
          typeof entry.href !== 'string' ||
          !/^\/(?!\/)[^\s\\]*$/.test(entry.href),
      )
    )
      throw new Error('The page directory could not be read.');
    this.siteCache.set(current.version, entries);
    if (this.siteCache.size > 2) this.siteCache.delete(this.siteCache.keys().next().value!);
    return entries;
  }
  async search(
    state: SearchState,
    signal?: AbortSignal,
    scope: readonly string[] = [],
  ): Promise<RemoteResults> {
    try {
      return await this.performSearch(state, signal, scope);
    } catch (error) {
      if (
        error instanceof SearchHttpError &&
        [404, 410].includes(error.status) &&
        !signal?.aborted
      ) {
        this.clear();
        return this.performSearch(state, signal, scope);
      }
      throw error;
    }
  }
}
