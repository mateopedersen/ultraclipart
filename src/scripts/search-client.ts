import { defaults, normalizeQuery, parseState, stateParams, type SearchState } from '../lib/search';
import { SearchRepository } from '../lib/search-remote';
import { LatestRequest } from '../lib/search-request';
import type { SearchCard } from '../lib/search-index';
import { renderCard } from './search-card';

export function initSearch() {
  const form = document.querySelector<HTMLFormElement>('#catalog-search');
  if (!form) return;
  const query = document.querySelector<HTMLInputElement>('#search-query')!,
    gallery = document.querySelector<HTMLElement>('#search-results')!;
  const filters = [...document.querySelectorAll<HTMLSelectElement>('[data-filter]')],
    sort = document.querySelector<HTMLSelectElement>('#search-sort')!,
    size = document.querySelector<HTMLSelectElement>('#search-size')!;
  const previous = document.querySelector<HTMLButtonElement>('#previous-page')!,
    next = document.querySelector<HTMLButtonElement>('#next-page')!;
  const count = document.querySelector<HTMLElement>('#result-count')!,
    empty = document.querySelector<HTMLElement>('#search-empty')!,
    error = document.querySelector<HTMLElement>('#search-error')!,
    pagination = document.querySelector<HTMLElement>('#search-pagination')!;
  const repository = new SearchRepository(),
    requests = new LatestRequest();
  const seed = document.querySelector('#search-seed');
  if (seed?.textContent) {
    try {
      const value = JSON.parse(seed.textContent) as { version: string; items: SearchCard[] };
      repository.seed(value.version, value.items);
    } catch {
      /* A malformed optional seed is recovered from the static index. */
    }
  }
  let state: SearchState = parseState(new URLSearchParams(location.search));
  function historyUrl(mode: 'push' | 'replace' | 'none') {
    if (mode === 'none') return;
    const params = stateParams(state).toString();
    history[mode === 'push' ? 'pushState' : 'replaceState'](
      {},
      '',
      `/search/${params ? `?${params}` : ''}`,
    );
  }
  function render(mode: 'push' | 'replace' | 'none' = 'none') {
    const requested = { ...state };
    historyUrl(mode);
    query.value = state.q;
    filters.forEach((filter) => {
      filter.value = String(state[filter.dataset.filter as keyof SearchState]);
    });
    sort.value = state.sort;
    size.value = String(state.size);
    gallery.setAttribute('aria-busy', 'true');
    gallery.hidden = true;
    empty.hidden = true;
    error.hidden = true;
    pagination.hidden = true;
    document.querySelector<HTMLElement>('#close-matches')!.hidden = true;
    document.querySelector<HTMLElement>('#topic-suggestions')!.hidden = true;
    count.textContent = 'Finding illustrations…';
    document.documentElement.setAttribute('data-search-pending', '');
    void requests.run(
      (signal) => repository.search(requested, signal),
      (result) => {
        document.documentElement.removeAttribute('data-search-pending');
        state.page = result.page;
        if (result.page !== requested.page) historyUrl('replace');
        gallery.replaceChildren(...result.items.map(renderCard));
        gallery.hidden = false;
        gallery.setAttribute('aria-busy', 'false');
        count.textContent = `${result.total} ${result.total === 1 ? 'illustration' : 'illustrations'}${requested.q ? ` for “${requested.q}”` : ''}`;
        empty.hidden = result.total > 0;
        document.querySelector<HTMLElement>('#close-matches')!.hidden = !result.hasFuzzyMatches;
        pagination.hidden = result.pages <= 1;
        document.querySelector<HTMLElement>('#page-position')!.textContent =
          `Page ${result.page} of ${result.pages}`;
        previous.disabled = result.page <= 1;
        next.disabled = result.page >= result.pages;
        const tokens = normalizeQuery(requested.q),
          related = tokens.length
            ? result.manifest.topics
                .filter((topic) =>
                  tokens.some((token) => normalizeQuery(topic.keyword).includes(token)),
                )
                .slice(0, 8)
            : [];
        const links = document.querySelector<HTMLElement>('#topic-suggestion-links')!;
        links.replaceChildren();
        for (const topic of related) {
          const link = document.createElement('a');
          link.href = `/clipart/${topic.slug}/`;
          link.textContent = topic.keyword;
          links.append(link);
        }
        document.querySelector<HTMLElement>('#topic-suggestions')!.hidden = related.length === 0;
      },
      () => {
        document.documentElement.removeAttribute('data-search-pending');
        gallery.setAttribute('aria-busy', 'false');
        count.textContent = 'Search is temporarily unavailable.';
        error.hidden = false;
      },
    );
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    state.q = query.value.trim().slice(0, 160);
    state.page = 1;
    render('push');
  });
  filters.forEach((filter) =>
    filter.addEventListener('change', () => {
      const params = stateParams(state);
      params.set(filter.dataset.filter!, filter.value);
      state = parseState(params);
      state.page = 1;
      render('push');
    }),
  );
  sort.addEventListener('change', () => {
    state.sort = sort.value;
    state.page = 1;
    render('push');
  });
  size.addEventListener('change', () => {
    state.size = Number(size.value);
    state.page = 1;
    render('push');
  });
  previous.addEventListener('click', () => {
    state.page--;
    render('push');
    count.scrollIntoView({ block: 'nearest' });
  });
  next.addEventListener('click', () => {
    state.page++;
    render('push');
    count.scrollIntoView({ block: 'nearest' });
  });
  document.querySelector('#clear-filters')!.addEventListener('click', () => {
    state = { ...defaults, q: state.q };
    render('push');
  });
  document.querySelector('#show-all')!.addEventListener('click', () => {
    state = { ...defaults };
    render('push');
    query.focus();
  });
  document.querySelector('#search-retry')!.addEventListener('click', () => {
    repository.clear();
    render();
  });
  window.addEventListener('popstate', () => {
    state = parseState(new URLSearchParams(location.search));
    render();
  });
  render('replace');
}
