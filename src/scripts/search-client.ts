import { defaults, normalizeQuery, parseState, stateParams, type SearchState } from '../lib/search';
import { SearchRepository, type RemoteResults } from '../lib/search-remote';
import { LatestRequest } from '../lib/search-request';
import { searchSiteEntries, searchKindLabels, type SiteSearchEntry } from '../lib/site-search';
import type { SearchCard } from '../lib/search-index';
import { renderCard } from './search-card';
export function initSearch() {
  const form = document.querySelector<HTMLFormElement>('#catalog-search');
  if (!form) return;
  const q = <T extends HTMLElement = HTMLElement>(selector: string) =>
    document.querySelector<T>(selector)!;
  const query = q<HTMLInputElement>('#search-query'),
    gallery = q('#search-results');
  const filters = [...document.querySelectorAll<HTMLSelectElement>('[data-filter]')];
  const sort = q<HTMLSelectElement>('#search-sort'),
    size = q<HTMLSelectElement>('#search-size');
  const previous = q<HTMLButtonElement>('#previous-page'),
    next = q<HTMLButtonElement>('#next-page');
  const count = q('#result-count'),
    empty = q('#search-empty'),
    error = q('#search-error'),
    pagination = q('#search-pagination');
  const siteSection = q('#site-search-section'),
    siteList = q('#site-search-results'),
    relatedSection = q('#search-related'),
    relatedList = q('#search-related-results');
  const repository = new SearchRepository(),
    requests = new LatestRequest();
  const seed = q('#search-seed');
  if (seed?.textContent)
    try {
      const value = JSON.parse(seed.textContent) as { version: string; items: SearchCard[] };
      repository.seed(value.version, value.items);
    } catch {}
  let state: SearchState = parseState(new URLSearchParams(location.search)),
    timer: ReturnType<typeof setTimeout> | undefined,
    composing = false;
  let renderedArtwork: RemoteResults | undefined;
  let siteLimit = 8,
    siteMatches: ReturnType<typeof searchSiteEntries> = [];
  function historyUrl(mode: 'push' | 'replace' | 'none') {
    if (mode === 'none') return;
    const params = stateParams(state).toString();
    history[mode === 'push' ? 'pushState' : 'replaceState'](
      {},
      '',
      `/search/${params ? `?${params}` : ''}`,
    );
  }
  function siteRows(entries: SiteSearchEntry[]) {
    siteList.replaceChildren(
      ...entries.map((entry) => {
        const link = document.createElement('a');
        link.href = entry.href;
        link.className = 'site-search-result';
        const kind = document.createElement('span');
        kind.className = 'site-search-kind';
        kind.textContent = searchKindLabels[entry.kind];
        const title = document.createElement('strong');
        title.textContent = entry.title;
        const description = document.createElement('p');
        description.textContent = entry.description;
        link.append(kind, title, description);
        return link;
      }),
    );
  }
  function render(mode: 'push' | 'replace' | 'none' = 'none') {
    clearTimeout(timer);
    timer = undefined;
    if (Date.now() - refreshed >= 30000) {
      refreshed = Date.now();
      repository.clear();
    }
    const requested = { ...state },
      artMode = ['all', 'artwork'].includes(state.type);
    historyUrl(mode);
    query.value = state.q;
    filters.forEach(
      (filter) => (filter.value = String(state[filter.dataset.filter as keyof SearchState])),
    );
    sort.value = state.sort;
    size.value = String(state.size);
    q('#search-layout').toggleAttribute('data-content-only', !artMode);
    q('#artwork-filters').hidden = !artMode;
    sort.closest<HTMLElement>('.sort-control')!.hidden = !artMode;
    document
      .querySelectorAll<HTMLButtonElement>('[data-search-kind]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.searchKind === state.type)),
      );
    gallery.setAttribute('aria-busy', 'true');
    gallery.hidden = true;
    empty.hidden = true;
    error.hidden = true;
    pagination.hidden = true;
    siteSection.hidden = true;
    relatedSection.hidden = true;
    q('#close-matches').hidden = true;
    q('#topic-suggestions').hidden = true;
    q('#no-exact-artwork').hidden = true;
    count.textContent = 'Searching UltraClipart…';
    document.documentElement.setAttribute('data-search-pending', '');
    siteLimit = 8;
    void requests.run<{
      result: RemoteResults;
      entries: SiteSearchEntry[] | null;
      sitePending: boolean;
      siteError: boolean;
    }>(
      async (signal, emit) => {
        const loadSite = () =>
          (async () => {
            if (!requested.q && ['all', 'artwork'].includes(requested.type)) return null;
            const manifest = await repository.manifest(signal);
            return repository.siteEntries(manifest, signal);
          })().then(
            (entries) => ({ entries, siteError: false }),
            () => ({ entries: null, siteError: true }),
          );
        const sitePromise = artMode ? undefined : loadSite();
        const result = await repository.search(requested, signal);
        // Artwork does not wait for the separate page/Studio directory. Both
        // stages use the same cancellation guard, including cached responses.
        if (artMode) emit({ result, entries: null, sitePending: !!requested.q, siteError: false });
        const { entries, siteError } = await (sitePromise || loadSite());
        return { result, entries, sitePending: false, siteError };
      },
      ({ result, entries, sitePending, siteError }) => {
        document.documentElement.removeAttribute('data-search-pending');
        const allSite = entries ? searchSiteEntries(entries, requested.q) : [];
        siteMatches = allSite.filter(
          (match) => requested.type === 'all' || match.entry.kind === requested.type,
        );
        const activeTotal = artMode ? result.total : siteMatches.length;
        const pages = artMode ? result.pages : Math.max(1, Math.ceil(activeTotal / requested.size));
        const page = artMode ? result.page : Math.min(pages, Math.max(1, requested.page));
        state.page = page;
        if (page !== requested.page) historyUrl('replace');
        if (renderedArtwork !== result) {
          gallery.replaceChildren(...(artMode ? result.items.map(renderCard) : []));
          renderedArtwork = result;
        }
        gallery.hidden = !artMode || !result.items.length;
        gallery.setAttribute('aria-busy', 'false');
        siteRows(
          (requested.type === 'all'
            ? siteMatches.slice(0, siteLimit)
            : siteMatches.slice((page - 1) * requested.size, page * requested.size)
          ).map((match) => match.entry),
        );
        siteSection.hidden =
          requested.type === 'artwork' || (!siteMatches.length && !sitePending && !siteError);
        const directoryStatus = q('#site-search-status');
        directoryStatus.textContent = sitePending
          ? 'Finding pages, tools and Studio elements…'
          : siteError
            ? 'Pages and tools could not load. Your artwork results are still available.'
            : '';
        directoryStatus.hidden = !sitePending && !siteError;
        q('#site-search-retry').hidden = !siteError;
        q('#site-search-title').textContent =
          requested.type === 'all'
            ? 'Pages, Tools & Studio Elements'
            : searchKindLabels[requested.type];
        q<HTMLButtonElement>('#site-search-more').hidden =
          requested.type !== 'all' || siteMatches.length <= siteLimit;
        for (const button of document.querySelectorAll<HTMLButtonElement>('[data-search-kind]')) {
          const kind = button.dataset.searchKind!,
            badge = button.querySelector<HTMLElement>('span')!;
          const total =
            kind === 'artwork'
              ? result.total
              : kind === 'all'
                ? result.total + allSite.length
                : allSite.filter((match) => match.entry.kind === kind).length;
          badge.textContent =
            entries || kind === 'artwork' || kind === 'all' ? total.toLocaleString('en-US') : '';
        }
        const suffix = requested.q ? ` for “${requested.q}”` : '';
        count.textContent =
          requested.type === 'all'
            ? `${result.total.toLocaleString('en-US')} artworks${allSite.length ? ` · ${allSite.length.toLocaleString('en-US')} pages, tools & Studio elements` : ''}${suffix}`
            : `${activeTotal.toLocaleString('en-US')} ${requested.type === 'artwork' ? 'artworks' : searchKindLabels[requested.type].toLowerCase()}${suffix}`;
        empty.hidden =
          sitePending ||
          siteError ||
          (requested.type === 'all' ? result.total + siteMatches.length > 0 : activeTotal > 0);
        q('#empty-description').textContent = requested.q
          ? 'No complete match for this description. Try fewer details, another word, or clear the filters.'
          : 'Choose another result type or clear the filters.';
        q('#close-matches').hidden = artMode
          ? !result.hasFuzzyMatches
          : !siteMatches.some((match) => match.fuzzy);
        pagination.hidden = pages <= 1;
        q('#page-position').textContent = `Page ${page} of ${pages}`;
        previous.disabled = page <= 1;
        next.disabled = page >= pages;
        if (artMode && requested.q && result.total === 0) {
          q('#no-exact-artwork').hidden = false;
          const related = result.relatedItems || [];
          relatedSection.hidden = !related.length;
          relatedList.replaceChildren(
            ...related.map((item) => {
              const wrapper = document.createElement('div');
              wrapper.className = 'search-related-item';
              wrapper.append(renderCard(item));
              const note = document.createElement('p');
              note.className = 'search-missing';
              const originalWords = requested.q.match(/[\p{L}\p{N}-]+/gu) || [];
              const missing = (result.relatedMissing?.[item.id] || []).map(
                (term) => originalWords.find((word) => normalizeQuery(word).includes(term)) || term,
              );
              note.textContent = `Unmatched details: ${missing.join(', ')}`;
              wrapper.append(note);
              return wrapper;
            }),
          );
        }
        const tokens = normalizeQuery(requested.q),
          relatedTopics = tokens.length
            ? result.manifest.topics
                .filter((topic) =>
                  tokens.some((token) => normalizeQuery(topic.keyword).includes(token)),
                )
                .slice(0, 8)
            : [];
        q('#topic-suggestion-links').replaceChildren(
          ...relatedTopics.map((topic) => {
            const link = document.createElement('a');
            link.href = `/clipart/${topic.slug}/`;
            link.textContent = topic.keyword;
            return link;
          }),
        );
        q('#topic-suggestions').hidden = !relatedTopics.length;
      },
      () => {
        document.documentElement.removeAttribute('data-search-pending');
        gallery.setAttribute('aria-busy', 'false');
        count.textContent = 'Search could not load. Your query and filters are kept.';
        error.hidden = false;
      },
    );
  }
  const submit = (mode: 'push' | 'replace') => {
    clearTimeout(timer);
    timer = undefined;
    state.q = query.value.trim().slice(0, 320);
    state.page = 1;
    render(mode);
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit('push');
  });
  query.addEventListener('compositionstart', () => {
    composing = true;
    clearTimeout(timer);
    requests.cancel();
  });
  const schedule = () => {
    requests.cancel();
    clearTimeout(timer);
    if (!composing) timer = setTimeout(() => submit('replace'), 350);
  };
  query.addEventListener('input', schedule);
  query.addEventListener('compositionend', () => {
    composing = false;
    schedule();
  });
  filters.forEach((filter) =>
    filter.addEventListener('change', () => {
      clearTimeout(timer);
      const params = stateParams({ ...state, q: query.value });
      params.set(filter.dataset.filter!, filter.value);
      state = parseState(params);
      state.page = 1;
      render('push');
    }),
  );
  sort.addEventListener('change', () => {
    clearTimeout(timer);
    timer = undefined;
    state.q = query.value.trim().slice(0, 320);
    state.sort = sort.value;
    state.page = 1;
    render('push');
  });
  size.addEventListener('change', () => {
    clearTimeout(timer);
    timer = undefined;
    state.q = query.value.trim().slice(0, 320);
    state.size = Number(size.value);
    state.page = 1;
    render('push');
  });
  document.querySelectorAll<HTMLButtonElement>('[data-search-kind]').forEach((button) =>
    button.addEventListener('click', () => {
      clearTimeout(timer);
      state.type = button.dataset.searchKind!;
      state.q = query.value.trim().slice(0, 320);
      state.page = 1;
      render('push');
    }),
  );
  previous.addEventListener('click', () => {
    if (query.value.trim() !== state.q) {
      state.q = query.value.trim().slice(0, 320);
      state.page = 1;
    } else state.page--;
    render('push');
    count.scrollIntoView({ block: 'nearest' });
  });
  next.addEventListener('click', () => {
    if (query.value.trim() !== state.q) {
      state.q = query.value.trim().slice(0, 320);
      state.page = 1;
    } else state.page++;
    render('push');
    count.scrollIntoView({ block: 'nearest' });
  });
  q('#site-search-more').addEventListener('click', () => {
    siteLimit += 8;
    siteRows(siteMatches.slice(0, siteLimit).map((match) => match.entry));
    q<HTMLButtonElement>('#site-search-more').hidden = siteLimit >= siteMatches.length;
  });
  q('#clear-filters').addEventListener('click', () => {
    clearTimeout(timer);
    timer = undefined;
    state = { ...defaults, q: query.value.trim() };
    render('push');
  });
  q('#show-all').addEventListener('click', () => {
    clearTimeout(timer);
    timer = undefined;
    state = { ...defaults };
    render('push');
    query.focus();
  });
  const retrySearch = () => {
    repository.clear();
    render();
  };
  q('#search-retry').addEventListener('click', retrySearch);
  q('#site-search-retry').addEventListener('click', retrySearch);
  window.addEventListener('popstate', () => {
    clearTimeout(timer);
    timer = undefined;
    state = parseState(new URLSearchParams(location.search));
    render();
  });
  let refreshed = Date.now();
  const refresh = () => {
    if (
      document.visibilityState !== 'visible' ||
      document.activeElement === query ||
      timer !== undefined ||
      composing ||
      Date.now() - refreshed < 30000
    )
      return;
    refreshed = Date.now();
    repository.clear();
    render();
  };
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  window.setInterval(refresh, 30000);
  render('replace');
}
