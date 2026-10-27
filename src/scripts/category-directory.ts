const input = document.querySelector<HTMLInputElement>('#topic-filter')!;
const group = document.querySelector<HTMLInputElement>('#category-group')!;
const sort = document.querySelector<HTMLSelectElement>('#category-sort')!;
const grid = document.querySelector<HTMLUListElement>('#subject-grid')!;
const cards = [...grid.querySelectorAll<HTMLLIElement>('[data-topic]')];
const letters = [...document.querySelectorAll<HTMLButtonElement>('[data-letter]')];
const collections = [...document.querySelectorAll<HTMLInputElement>('[name="collection-filter"]')];
const controls = document.querySelector<HTMLDetailsElement>('#discovery-controls')!;
const directory = document.querySelector<HTMLElement>('#topic-directory')!;
const more = document.querySelector<HTMLElement>('#discovery-more')!;
const resultStatus = document.querySelector<HTMLElement>('#topic-result-count')!;
const activeFilters = document.querySelector<HTMLElement>('#active-topic-filters')!;
const reset = document.querySelector<HTMLButtonElement>('#reset-subjects')!;
const pageSize = 12;
let limit = pageSize;
let letter = '';
let previousSort = 'name:';
let matchedCount = cards.length;
function columnsForCount(count: number) {
  const width = grid.getBoundingClientRect().width;
  const preferred = width < 300 ? 1 : width < 640 ? 2 : 3;
  let columns = preferred;
  if (count > 1 && count <= preferred) columns = count;
  else if (count > preferred) {
    const divisors = Array.from({ length: preferred - 1 }, (_, i) => i + 2).filter(
      (n) => count % n === 0,
    );
    columns =
      divisors.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred))[0] ?? preferred;
  }
  return columns;
}
function updateColumns() {
  const columns = columnsForCount(matchedCount);
  if (grid.style.getPropertyValue('--subject-columns') !== String(columns))
    grid.style.setProperty('--subject-columns', String(columns));
}
function primeImages(targets: HTMLLIElement[], priority: 'high' | 'low', maximum = 3) {
  const columns = columnsForCount(Math.min(pageSize, targets.length));
  const width = Math.max(
    64,
    Math.ceil((grid.getBoundingClientRect().width - (columns - 1) * 18) / columns) - 20,
  );
  for (const card of targets.slice(0, maximum)) {
    const image = card.querySelector<HTMLImageElement>('.subject-art img');
    if (!image) continue;
    image.sizes = `${width}px`;
    image.loading = 'eager';
    image.fetchPriority = priority;
  }
}
let worker: Worker | undefined;
let requestId = 0;
let filterRevision = 0;
const pending = new Map<
  number,
  { resolve: (scores: Map<string, number>) => void; reject: () => void }
>();
function searchWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/category-search.ts', import.meta.url), {
    type: 'module',
  });
  worker.addEventListener('message', ({ data }) => {
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    if (data.type === 'result') request.resolve(new Map(data.scores));
    else request.reject();
  });
  worker.addEventListener('error', () => {
    for (const request of pending.values()) request.reject();
    pending.clear();
    worker?.terminate();
    worker = undefined;
  });
  worker.postMessage({ type: 'init', url: grid.dataset.searchIndex });
  return worker;
}
function searchScores(query: string) {
  return new Promise<Map<string, number>>((resolve, reject) => {
    const id = ++requestId;
    const target = searchWorker();
    pending.set(id, { resolve, reject });
    target.postMessage({ type: 'search', id, query });
  });
}
input.addEventListener('focus', () => {
  try {
    searchWorker();
  } catch {}
});

async function filter(save = true) {
  const revision = ++filterRevision;
  const query = input.value.trim();
  let found: Map<string, number> | undefined;
  if (query) {
    resultStatus.textContent = 'Searching subjects…';
    try {
      found = await searchScores(query);
    } catch {
      if (revision === filterRevision)
        resultStatus.textContent = 'Subject search could not load. Try your search again.';
      return;
    }
    if (revision !== filterRevision) return;
  }
  const scores = new Map(
    cards.map((card) => [card, query ? (found!.get(card.dataset.slug!) ?? 0) : 1]),
  );
  const compare = (a: HTMLLIElement, b: HTMLLIElement) =>
    (sort.value === 'count'
      ? Number(b.dataset.count) - Number(a.dataset.count)
      : input.value.trim()
        ? scores.get(b)! - scores.get(a)!
        : 0) || a.dataset.name!.localeCompare(b.dataset.name!, 'en');
  const orderKey = `${sort.value}:${input.value.trim()}`;
  const matches = cards
    .filter(
      (card) =>
        (!group.value ||
          (card.dataset.groups ?? card.dataset.group ?? '').split(' ').includes(group.value)) &&
        (!letter || card.dataset.letterValue === letter) &&
        scores.get(card)! > 0,
    )
    .sort(compare);
  matchedCount = Math.min(limit, matches.length);
  updateColumns();
  const shown = new Set(matches.slice(0, limit));
  if (save) primeImages(matches.slice(0, limit), 'high');
  for (const card of cards) card.hidden = !shown.has(card);
  if (orderKey !== previousSort) {
    const ordered = [...cards].sort(compare);
    ordered.forEach((card, index) => {
      if (grid.children[index] !== card) grid.insertBefore(card, grid.children[index] ?? null);
    });
    previousSort = orderKey;
  }
  for (const choice of collections) choice.checked = choice.value === group.value;
  const collection = collections
    .find((choice) => choice.checked && choice.value)
    ?.parentElement?.querySelector('.collection-filter-title')?.textContent;
  const filters = [
    input.value.trim() ? `“${input.value.trim()}”` : '',
    collection,
    letter ? `Starts with ${letter}` : '',
    sort.value === 'count' ? 'Most artwork first' : '',
  ].filter(Boolean);
  const hasFilters = filters.length > 0;
  sort.options[0].textContent = input.value.trim() ? 'Best match' : 'Name: A–Z';
  document.querySelector('#topic-directory-heading')!.textContent = input.value.trim()
    ? `Results for “${input.value.trim()}”`
    : collection
      ? `${collection} Clipart`
      : letter
        ? `Clipart Beginning With ${letter}`
        : 'Explore Clipart';
  resultStatus.textContent = `Showing ${Math.min(limit, matches.length)} of ${matches.length} Subject${matches.length === 1 ? '' : 's'}`;
  activeFilters.hidden = !hasFilters;
  document.querySelector('#active-topic-summary')!.textContent = filters.join(' · ');
  document.querySelector<HTMLElement>('#no-topics')!.hidden = matches.length !== 0;
  more.hidden = matches.length <= limit;
  document.querySelector<HTMLElement>('#subject-progress')!.textContent =
    `Showing ${Math.min(limit, matches.length)} of ${matches.length} Subjects`;
  for (const button of letters)
    button.setAttribute('aria-pressed', String(button.dataset.letter === letter));
  if (save) {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries({
      q: input.value.trim(),
      collection: group.value,
      letter,
      sort: sort.value === 'name' ? '' : sort.value,
    })) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    history.replaceState(history.state, '', url);
  }
}
function readUrl() {
  const params = new URLSearchParams(location.search);
  input.value = (params.get('q') ?? '').slice(0, 160);
  group.value = collections.some((option) => option.value === params.get('collection'))
    ? params.get('collection')!
    : '';
  sort.value = params.get('sort') === 'count' ? 'count' : 'name';
  letter = letters.some((button) => button.dataset.letter === params.get('letter'))
    ? params.get('letter')!
    : '';
  if (letter) document.querySelector<HTMLDetailsElement>('.discovery-alphabet')!.open = true;
  limit = pageSize;
  filter(false);
}
document.addEventListener('ultraclipart:catalog-counts', () => {
  if (sort.value === 'count') {
    previousSort = '';
    filter(false);
  }
});
function clear() {
  input.value = '';
  group.value = '';
  sort.value = 'name';
  letter = '';
  limit = pageSize;
  filter();
  controls.open = true;
  input.focus({ preventScroll: true });
}
input.addEventListener('input', () => {
  limit = pageSize;
  filter();
});
sort.addEventListener('change', () => {
  limit = pageSize;
  filter();
});
for (const choice of collections) {
  const warmChoice = () =>
    primeImages(
      cards.filter(
        (card) => !choice.value || (card.dataset.groups ?? '').split(' ').includes(choice.value),
      ),
      'high',
    );
  choice.parentElement!.addEventListener('pointerenter', () =>
    primeImages(
      cards.filter(
        (card) => !choice.value || (card.dataset.groups ?? '').split(' ').includes(choice.value),
      ),
      'low',
      2,
    ),
  );
  choice.parentElement!.addEventListener('pointerdown', warmChoice, { passive: true });
  choice.addEventListener('focus', warmChoice);
  choice.addEventListener('change', () => {
    if (!choice.checked) return;
    group.value = choice.value;
    limit = pageSize;
    filter();
  });
}
for (const button of letters)
  button.addEventListener('click', () => {
    letter = button.dataset.letter!;
    limit = pageSize;
    filter();
  });
reset.addEventListener('click', clear);
document.querySelector('#clear-topic-filter')!.addEventListener('click', clear);
document.querySelector('#show-more-subjects')!.addEventListener('click', () => {
  const previousLimit = limit;
  limit += pageSize;
  filter();
  const firstNew = [...grid.querySelectorAll<HTMLLIElement>('[data-topic]:not([hidden])')][
    previousLimit
  ];
  firstNew?.querySelector('a')?.focus({ preventScroll: true });
});
document.querySelector('#hero-topic-search')!.addEventListener('submit', (event) => {
  event.preventDefault();
  limit = pageSize;
  filter();
  if (!desktop.matches) controls.open = false;
  directory.scrollIntoView({ behavior: 'instant', block: 'start' });
  directory.focus({ preventScroll: true });
});
const desktop = matchMedia('(min-width: 980px)');
const syncPanel = () => {
  controls.open = desktop.matches;
};
desktop.addEventListener('change', syncPanel);
controls.querySelector('summary')!.addEventListener('click', (event) => {
  if (desktop.matches) event.preventDefault();
});
window.addEventListener('popstate', readUrl);
readUrl();
syncPanel();
let resizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(updateColumns);
});
document.querySelector<HTMLElement>('#category-filters')!.hidden = false;
document.querySelector<HTMLElement>('[data-directory-tools]')!.hidden = false;
controls.dataset.ready = 'true';

// Warm on pointer/focus intent above; background prefetching every visible menu
// option competes with the initial heading and fetches art the visitor may never open.
