export {};
const input = document.querySelector<HTMLInputElement>('#topic-filter')!;
const heroInput = document.querySelector<HTMLInputElement>('#hero-topic-query')!;
const group = document.querySelector<HTMLSelectElement>('#category-group')!;
const sort = document.querySelector<HTMLSelectElement>('#category-sort')!;
const grid = document.querySelector<HTMLUListElement>('#subject-grid')!;
const cards = [...grid.querySelectorAll<HTMLLIElement>('[data-topic]')];
const letters = [...document.querySelectorAll<HTMLButtonElement>('[data-letter]')];
const more = document.querySelector<HTMLElement>('#discovery-more')!;
const resultStatus = document.querySelector<HTMLElement>('#topic-result-count')!;
const reset = document.querySelector<HTMLButtonElement>('#reset-subjects')!;
const pageSize = 16;
let limit = pageSize;
let letter = '';
let previousSort = 'name';
const normalize = (text: string) => text.normalize('NFKC').trim().toLocaleLowerCase('en');

function filter(save = true) {
  const terms = normalize(input.value).split(/\s+/).filter(Boolean);
  const matches = cards
    .filter(
      (card) =>
        (!group.value || card.dataset.group === group.value) &&
        (!letter || card.dataset.letterValue === letter) &&
        terms.every((term) => card.dataset.keywords!.includes(term)),
    )
    .sort(
      (a, b) =>
        (sort.value === 'count' ? Number(b.dataset.count) - Number(a.dataset.count) : 0) ||
        a.dataset.name!.localeCompare(b.dataset.name!, 'en'),
    );
  const shown = new Set(matches.slice(0, limit));
  for (const card of cards) card.hidden = !shown.has(card);
  // Filtering changes visibility only. Avoid detaching lazy images on every keystroke.
  // Reorder existing nodes only when the selected sort order changes.
  if (sort.value !== previousSort) {
    const ordered = [...cards].sort(
      (a, b) =>
        (sort.value === 'count' ? Number(b.dataset.count) - Number(a.dataset.count) : 0) ||
        a.dataset.name!.localeCompare(b.dataset.name!, 'en'),
    );
    ordered.forEach((card, index) => {
      if (grid.children[index] !== card) grid.insertBefore(card, grid.children[index] ?? null);
    });
    previousSort = sort.value;
  }
  resultStatus.textContent = `${matches.length} subject${matches.length === 1 ? '' : 's'}${terms.length || group.value || letter ? ' found' : ' to explore'}`;
  reset.hidden = !(input.value || group.value || letter || sort.value !== 'name');
  document.querySelector<HTMLElement>('#no-topics')!.hidden = matches.length !== 0;
  more.hidden = matches.length <= limit;
  document.querySelector<HTMLElement>('#subject-progress')!.textContent =
    `Showing ${Math.min(limit, matches.length)} of ${matches.length} subjects`;
  for (const button of letters)
    button.setAttribute('aria-pressed', String(button.dataset.letter === letter));
  heroInput.value = input.value;
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
  group.value = [...group.options].some((option) => option.value === params.get('collection'))
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
function clear() {
  input.value = '';
  group.value = '';
  sort.value = 'name';
  letter = '';
  limit = pageSize;
  filter();
  input.focus();
}
input.addEventListener('input', () => {
  limit = pageSize;
  filter();
});
for (const control of [group, sort])
  control.addEventListener('change', () => {
    limit = pageSize;
    filter();
  });
for (const button of letters)
  button.addEventListener('click', () => {
    letter = button.dataset.letter!;
    limit = pageSize;
    filter();
  });
reset.addEventListener('click', clear);
document.querySelector('#clear-topic-filter')!.addEventListener('click', clear);
document.querySelector('#show-more-subjects')!.addEventListener('click', () => {
  limit += pageSize;
  filter();
  // Focus the first newly revealed topic, including after the final batch hides the button.
  const firstNew = [...grid.querySelectorAll<HTMLLIElement>('[data-topic]:not([hidden])')][
    limit - pageSize
  ];
  firstNew?.querySelector('a')?.focus({ preventScroll: true });
});
document.querySelector('#hero-topic-search')!.addEventListener('submit', (event) => {
  event.preventDefault();
  input.value = heroInput.value;
  group.value = '';
  letter = '';
  limit = pageSize;
  filter();
  document
    .querySelector('#topic-directory')!
    .scrollIntoView({ behavior: 'instant', block: 'start' });
  input.focus({ preventScroll: true });
});
window.addEventListener('popstate', readUrl);
readUrl();
document.querySelector<HTMLElement>('#discovery-controls')!.hidden = false;
