import { SearchRepository } from '../lib/search-remote';
import { defaults } from '../lib/search';
import type { SearchCard, SearchManifest } from '../lib/search-index';
import type { MonochromeDirectory } from '../lib/monochrome';
import { renderCard } from './search-card';

const root = document.querySelector<HTMLElement>('[data-bw-library]');
if (root) {
  const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const form = element<HTMLFormElement>('bw-form');
  const query = element<HTMLInputElement>('bw-query');
  const collection = element<HTMLSelectElement>('bw-collection');
  const topic = element<HTMLSelectElement>('bw-topic');
  const kind = element<HTMLSelectElement>('bw-kind');
  const sort = element<HTMLSelectElement>('bw-sort');
  const results = element<HTMLElement>('bw-results');
  const count = element<HTMLElement>('bw-result-count');
  const heading = element<HTMLElement>('bw-results-heading');
  const title = element<HTMLElement>('bw-results-title');
  const loading = element<HTMLElement>('bw-loading');
  const error = element<HTMLElement>('bw-error');
  const empty = element<HTMLElement>('bw-empty');
  const pagination = element<HTMLElement>('bw-pagination');
  const previous = element<HTMLButtonElement>('bw-previous');
  const next = element<HTMLButtonElement>('bw-next');
  const page = element<HTMLInputElement>('bw-page');
  const pageTotal = element<HTMLElement>('bw-page-total');
  const seed = JSON.parse(element<HTMLScriptElement>('bw-seed').textContent || '{}') as {
    version: string;
    directory: MonochromeDirectory;
    items: SearchCard[];
  };
  const repository = new SearchRepository();
  repository.seed(seed.version, seed.items);
  let directory = seed.directory;
  let version = seed.version;
  let request: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let refreshing = false;
  let pages = Math.max(1, Math.ceil(directory.total / 24));
  const number = (value: number) => value.toLocaleString('en-US');
  type State = {
    q: string;
    collection: string;
    topic: string;
    kind: string;
    sort: string;
    page: number;
  };
  const readState = (): State => {
    const params = new URLSearchParams(location.search);
    return {
      q: (params.get('q') || '').trim().slice(0, 160),
      collection: params.get('collection') || '',
      topic: params.get('topic') || '',
      kind: params.get('kind') || '',
      sort: ['title', 'relevance'].includes(params.get('sort') || '')
        ? params.get('sort')!
        : 'newest',
      page: Math.min(10000, Math.max(1, Math.floor(Number(params.get('page')) || 1))),
    };
  };
  let state = readState();
  const options = (
    select: HTMLSelectElement,
    all: string,
    items: { slug: string; label: string; count: number }[],
    value: string,
  ) => {
    const choices = [
      new Option(all, ''),
      ...items.map((item) => new Option(`${item.label} (${number(item.count)})`, item.slug)),
    ];
    select.replaceChildren(...choices);
    select.value = value;
  };
  function syncControls() {
    if (!directory.collections.some((item) => item.slug === state.collection))
      state.collection = '';
    const subjects = directory.topics.filter(
      (item) => !state.collection || item.collections.includes(state.collection),
    );
    if (!subjects.some((item) => item.slug === state.topic)) state.topic = '';
    if (!directory.kinds.some((item) => item.slug === state.kind)) state.kind = '';
    options(collection, 'All Categories', directory.collections, state.collection);
    options(topic, 'All Subjects', subjects, state.topic);
    options(kind, 'All Types', directory.kinds, state.kind);
    query.value = state.q;
    sort.value = state.sort;
  }
  function remember(mode: 'push' | 'replace' | 'none') {
    if (mode === 'none') return;
    const params = new URLSearchParams();
    for (const key of ['q', 'collection', 'topic', 'kind'] as const)
      if (state[key]) params.set(key, state[key]);
    if (state.sort !== 'newest') params.set('sort', state.sort);
    if (state.page > 1) params.set('page', String(state.page));
    const url = `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`;
    if (url !== location.pathname + location.search + location.hash)
      history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', url);
  }
  function useManifest(manifest: SearchManifest) {
    if (!manifest.monochrome) throw new Error('The black-and-white catalog needs to be refreshed.');
    directory = manifest.monochrome;
    version = manifest.version;
    syncControls();
  }
  async function run(mode: 'push' | 'replace' | 'none' = 'push', move = false) {
    clearTimeout(timer);
    timer = undefined;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20000);
    loading.hidden = false;
    error.hidden = true;
    element<HTMLElement>('bw-close-matches').hidden = true;
    results.setAttribute('aria-busy', 'true');
    results.inert = true;
    pagination.hidden = true;
    empty.hidden = true;
    try {
      useManifest(await repository.manifest(controller.signal));
      const scope = ['print/monochrome'];
      if (state.collection) scope.push(`collection/${state.collection}`);
      if (state.topic) scope.push(`topic/${state.topic}`);
      if (state.kind) scope.push(`monochrome-kind/${state.kind}`);
      const found = await repository.search(
        { ...defaults, q: state.q, sort: state.sort, page: state.page, size: 24 },
        controller.signal,
        scope,
      );
      if (controller.signal.aborted || request !== controller) return;
      state.page = found.page;
      pages = found.pages;
      results.replaceChildren(...found.items.map(renderCard));
      const first = found.total ? (found.page - 1) * 24 + 1 : 0;
      const last = Math.min(found.page * 24, found.total);
      count.textContent = found.total
        ? `${number(first)}–${number(last)} of ${number(found.total)} illustrations`
        : '0 illustrations';
      title.textContent =
        directory.topics.find((item) => item.slug === state.topic)?.label ||
        directory.collections.find((item) => item.slug === state.collection)?.label ||
        'All Black & White Clipart';
      element<HTMLElement>('bw-close-matches').hidden = !found.hasFuzzyMatches;
      previous.disabled = found.page <= 1;
      next.disabled = found.page >= found.pages;
      page.value = String(found.page);
      page.max = String(found.pages);
      pageTotal.textContent = `of ${number(found.pages)}`;
      pagination.hidden = !found.total || found.pages <= 1;
      empty.hidden = found.total > 0;
      remember(mode);
      if (move) {
        heading.focus({ preventScroll: true });
        heading.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    } catch {
      if (request !== controller || (controller.signal.aborted && !timedOut)) return;
      repository.clear();
      error.hidden = false;
      // Old results must not appear to match newly chosen filters.
      results.hidden = true;
      count.textContent = 'Results unavailable. Please try again.';
    } finally {
      clearTimeout(timeout);
      if (request === controller) {
        request = undefined;
        loading.hidden = true;
        results.inert = false;
        results.setAttribute('aria-busy', 'false');
        if (error.hidden) results.hidden = false;
      }
    }
  }
  function clear() {
    state = { q: '', collection: '', topic: '', kind: '', sort: 'newest', page: 1 };
    syncControls();
    void run();
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    state.q = query.value.trim().slice(0, 160);
    state.page = 1;
    void run();
  });
  query.addEventListener('input', () => {
    clearTimeout(timer);
    request?.abort();
    state.q = query.value.trim().slice(0, 160);
    state.page = 1;
    timer = setTimeout(() => {
      timer = undefined;
      void run('replace');
    }, 350);
  });
  for (const [select, key] of [
    [collection, 'collection'],
    [topic, 'topic'],
    [kind, 'kind'],
    [sort, 'sort'],
  ] as const)
    select.addEventListener('change', () => {
      state[key] = select.value;
      state.q = query.value.trim().slice(0, 160);
      state.page = 1;
      syncControls();
      void run();
    });
  element('bw-reset').addEventListener('click', clear);
  element('bw-show-all').addEventListener('click', clear);
  element('bw-retry').addEventListener('click', () => void run('replace'));
  previous.addEventListener('click', () => {
    if (state.page > 1) {
      state.page--;
      void run('push', true);
    }
  });
  next.addEventListener('click', () => {
    if (state.page < pages) {
      state.page++;
      void run('push', true);
    }
  });
  page.addEventListener('change', () => {
    state.page = Math.min(pages, Math.max(1, Math.floor(Number(page.value) || 1)));
    void run('push', true);
  });
  window.addEventListener('popstate', () => {
    state = readState();
    syncControls();
    void run('none');
  });
  async function refresh() {
    if (document.hidden || request || refreshing || timer) return;
    refreshing = true;
    try {
      repository.clear();
      const manifest = await repository.manifest(AbortSignal.timeout(15000));
      if (request || timer) return;
      if (manifest.version !== version) {
        useManifest(manifest);
        void run('replace');
      }
    } catch {
      /* Keep the last complete collection during an offline refresh. */
    } finally {
      refreshing = false;
    }
  }
  window.addEventListener('focus', () => void refresh());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void refresh();
  });
  window.setInterval(() => void refresh(), 30000);
  window.addEventListener('pagehide', () => {
    request?.abort();
    clearTimeout(timer);
  });
  syncControls();
  void run('replace');
}
