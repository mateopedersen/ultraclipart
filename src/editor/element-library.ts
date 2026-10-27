import { studioElements, elementCategories, type StudioElement } from './elements';

/** Loaded only when the library is opened. Previews are paginated to bound DOM work. */
export function mountElementLibrary(root: HTMLElement, add: (element: StudioElement) => void) {
  const pane = root.querySelector<HTMLElement>('[data-pane=elements]')!;
  const search = pane.querySelector<HTMLInputElement>('[data-element-search]')!;
  const category = pane.querySelector<HTMLSelectElement>('[data-element-category]')!;
  const list = pane.querySelector<HTMLElement>('[data-element-grid]')!;
  const count = pane.querySelector<HTMLElement>('[data-element-count]')!;
  const more = pane.querySelector<HTMLButtonElement>('[data-element-more]')!;
  const previous = pane.querySelector<HTMLButtonElement>('[data-element-previous]')!;
  const position = pane.querySelector<HTMLElement>('[data-element-page]')!;
  const sort = pane.querySelector<HTMLSelectElement>('[data-element-sort]')!;
  const favoriteFilter = pane.querySelector<HTMLButtonElement>('[data-element-favorites]')!;
  const key = 'ultraclipart:element-favorites:v1';
  const pageSize = window.innerHeight < 800 ? 4 : 6;
  let favorites = new Set<string>(),
    onlyFavorites = false,
    page = 1;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(saved))
      favorites = new Set(saved.filter((id) => studioElements.some((e) => e.id === id)));
  } catch {}
  for (const name of elementCategories) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    category.append(option);
  }
  const fromSearch =
    root.dataset.creator === 'true'
      ? studioElements.find(
          (element) => element.id === new URLSearchParams(location.search).get('vector'),
        )
      : undefined;
  if (fromSearch) search.value = fromSearch.name;
  function render() {
    const words = search.value.toLowerCase().trim().split(/\s+/);
    const originals = studioElements
      .filter((e) => !e.id.startsWith('tabler-'))
      .sort(
        (a, b) => Number(b.tags.includes('illustration')) - Number(a.tags.includes('illustration')),
      );
    const icons = studioElements.filter((e) => e.id.startsWith('tabler-'));
    const featured = Array.from({ length: Math.max(originals.length, icons.length) }, (_, i) => [
      originals[i],
      icons[i],
    ])
      .flat()
      .filter(Boolean) as StudioElement[];
    const matched = featured.filter(
      (e) =>
        (!category.value || e.category === category.value) &&
        (!onlyFavorites || favorites.has(e.id)) &&
        words.every((w) => `${e.name} ${e.category} ${e.tags}`.toLowerCase().includes(w)),
    );
    if (sort.value === 'title') matched.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    if (fromSearch)
      matched.sort((a, b) => Number(b.id === fromSearch.id) - Number(a.id === fromSearch.id));
    const pages = Math.max(1, Math.ceil(matched.length / pageSize));
    page = Math.min(page, pages);
    list.replaceChildren();
    for (const element of matched.slice((page - 1) * pageSize, page * pageSize)) {
      const card = document.createElement('div');
      card.className = 'uc-element-card';
      if (element.id === fromSearch?.id) card.dataset.searchTarget = 'true';
      const button = document.createElement('button');
      button.type = 'button';
      button.title = element.name;
      button.dataset.element = element.id;
      button.setAttribute('aria-label', `Add ${element.name}`);
      // Markup comes exclusively from the bundled, reviewed element catalogue.
      button.innerHTML = `<span class="uc-element-preview"><svg viewBox="0 0 256 256" width="104" height="104" aria-hidden="true">${element.markup}</svg></span>`;
      const name = document.createElement('span');
      name.textContent = element.name;
      name.className = 'uc-element-name';
      button.append(name);
      button.addEventListener('click', () => add(element));
      const favorite = document.createElement('button');
      favorite.type = 'button';
      favorite.className = 'uc-element-favorite';
      favorite.dataset.elementFavorite = element.id;
      favorite.setAttribute('aria-label', `Favorite ${element.name}`);
      favorite.setAttribute('aria-pressed', String(favorites.has(element.id)));
      favorite.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20 3.8 12C-1 7.2 6.7.4 12 6c5.3-5.6 13 1.2 8.2 6Z" fill="currentColor" stroke="currentColor" stroke-width="1.5"/></svg>';
      favorite.addEventListener('click', () => {
        if (favorites.has(element.id)) favorites.delete(element.id);
        else favorites.add(element.id);
        try {
          localStorage.setItem(key, JSON.stringify([...favorites]));
        } catch {}
        render();
        pane
          .querySelector<HTMLButtonElement>(`[data-element-favorite="${element.id}"]`)
          ?.focus({ preventScroll: true });
      });
      card.append(button, favorite);
      list.append(card);
    }
    count.textContent = matched.length
      ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, matched.length)} of ${matched.length.toLocaleString('en-US')} elements`
      : 'No matching elements. Try another word or collection.';
    more.hidden = false;
    more.disabled = page >= pages;
    previous.disabled = page <= 1;
    position.textContent = `Page ${page} of ${pages}`;
    const jump = pane.querySelector<HTMLInputElement>('[data-element-jump]')!;
    jump.max = String(pages);
    jump.value = String(page);
    favoriteFilter.setAttribute('aria-pressed', String(onlyFavorites));
  }
  const reset = () => {
    page = 1;
    render();
  };
  search.addEventListener('input', reset);
  category.addEventListener('change', reset);
  pane
    .querySelector<HTMLInputElement>('[data-element-jump]')!
    .addEventListener('change', (event) => {
      const requested = Number((event.target as HTMLInputElement).value);
      if (Number.isInteger(requested) && requested >= 1) {
        page = requested;
        render();
        list.scrollTop = 0;
      }
    });
  more.addEventListener('click', () => {
    page++;
    render();
    list.scrollTop = 0;
  });
  previous.addEventListener('click', () => {
    if (page > 1) {
      page--;
      render();
      list.scrollTop = 0;
    }
  });
  sort.addEventListener('change', reset);
  pane.querySelector('[data-element-clear]')!.addEventListener('click', () => {
    search.value = '';
    category.value = '';
    sort.value = 'featured';
    onlyFavorites = false;
    reset();
  });
  favoriteFilter.addEventListener('click', () => {
    onlyFavorites = !onlyFavorites;
    reset();
  });
  render();
}
