import { art, topics } from '../lib/catalog';
import { defaults, normalizeQuery, parseState, searchArtwork, stateParams, type SearchState } from '../lib/search';

export function initSearch() {
  const form = document.querySelector<HTMLFormElement>('#catalog-search');
  if (!form) return;
  const query = document.querySelector<HTMLInputElement>('#search-query')!;
  const gallery = document.querySelector<HTMLElement>('#search-results')!;
  const cards = new Map([...gallery.querySelectorAll<HTMLElement>('[data-id]')].map(card => [card.dataset.id!, card]));
  const filters = [...document.querySelectorAll<HTMLSelectElement>('[data-filter]')];
  const sort = document.querySelector<HTMLSelectElement>('#search-sort')!;
  const size = document.querySelector<HTMLSelectElement>('#search-size')!;
  const previous = document.querySelector<HTMLButtonElement>('#previous-page')!;
  const next = document.querySelector<HTMLButtonElement>('#next-page')!;
  const data = art.map(item => ({...item, cluster:topics.find(topic=>topic.slug===item.topic)?.cluster ?? ''}));
  let state: SearchState = parseState(new URLSearchParams(location.search));
  function render(historyMode: 'push' | 'replace' | 'none' = 'none') {
    const result = searchArtwork(data, state);
    state.page = result.page;
    query.value = state.q;
    filters.forEach(filter => { filter.value = String(state[filter.dataset.filter as keyof SearchState]); });
    sort.value = state.sort; size.value = String(state.size);
    for (const card of cards.values()) card.hidden = true;
    for (const item of result.items) { const card = cards.get(item.id); if(card) {card.hidden = false;gallery.append(card);} }
    const noun = result.total === 1 ? 'illustration' : 'illustrations';
    const suffix = state.q ? ` for “${state.q}”` : '';
    document.querySelector<HTMLElement>('#result-count')!.textContent = `${result.total} pilot ${noun}${suffix}`;
    document.querySelector<HTMLElement>('#search-empty')!.hidden = result.total > 0;
    document.querySelector<HTMLElement>('#close-matches')!.hidden = !result.hasFuzzyMatches;
    document.querySelector<HTMLElement>('#search-pagination')!.hidden = result.pages <= 1;
    document.querySelector<HTMLElement>('#page-position')!.textContent = `Page ${result.page} of ${result.pages}`;
    previous.disabled = result.page <= 1; next.disabled = result.page >= result.pages;
    const tokens = normalizeQuery(state.q);
    const related = tokens.length ? topics.filter(topic => tokens.some(token => normalizeQuery(topic.keyword).includes(token))).slice(0,8) : [];
    const links = document.querySelector<HTMLElement>('#topic-suggestion-links')!;
    links.replaceChildren();
    for(const topic of related) { const link = document.createElement('a');link.href=`/clipart/${topic.slug}/`;link.textContent=topic.keyword;links.append(link); }
    document.querySelector<HTMLElement>('#topic-suggestions')!.hidden = related.length === 0;
    if (historyMode !== 'none') { const params = stateParams(state).toString();history[historyMode === 'push' ? 'pushState' : 'replaceState']({}, '', `/search/${params ? `?${params}` : ''}`); }
  }
  form.addEventListener('submit', event => {event.preventDefault();state.q=query.value.trim().slice(0,160);state.page=1;render('push');});
  filters.forEach(filter => filter.addEventListener('change',()=>{const params=stateParams(state);params.set(filter.dataset.filter!,filter.value);state=parseState(params);state.page=1;render('push');}));
  sort.addEventListener('change',()=>{state.sort=sort.value;state.page=1;render('push');});
  size.addEventListener('change',()=>{state.size=Number(size.value);state.page=1;render('push');});
  previous.addEventListener('click',()=>{state.page--;render('push');document.querySelector<HTMLElement>('#result-count')?.scrollIntoView({block:'nearest'});});
  next.addEventListener('click',()=>{state.page++;render('push');document.querySelector<HTMLElement>('#result-count')?.scrollIntoView({block:'nearest'});});
  document.querySelector('#clear-filters')!.addEventListener('click',()=>{state={...defaults,q:state.q};render('push');});
  document.querySelector('#show-all')!.addEventListener('click',()=>{state={...defaults};render('push');query.focus();});
  window.addEventListener('popstate',()=>{state=parseState(new URLSearchParams(location.search));render();});
  render('replace');
}
