import { studioElements, elementCategories, type StudioElement } from './elements';

/** Loaded only when the library is opened. Previews are paginated to bound DOM work. */
export function mountElementLibrary(root: HTMLElement, add: (element: StudioElement) => void) {
  const pane = root.querySelector<HTMLElement>('[data-pane=elements]')!;
  const search = pane.querySelector<HTMLInputElement>('[data-element-search]')!;
  const category = pane.querySelector<HTMLSelectElement>('[data-element-category]')!;
  const list = pane.querySelector<HTMLElement>('[data-element-grid]')!;
  const count = pane.querySelector<HTMLElement>('[data-element-count]')!;
  const more = pane.querySelector<HTMLButtonElement>('[data-element-more]')!;
  const favoriteFilter = pane.querySelector<HTMLButtonElement>('[data-element-favorites]')!;
  const key = 'ultraclipart:element-favorites:v1';
  let favorites = new Set<string>(),
    onlyFavorites = false,
    limit = 24;
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
  function render() {
    const words = search.value.toLowerCase().trim().split(/\s+/);
    const featured = [...studioElements].sort(
      (a, b) => Number(b.tags.includes('illustration')) - Number(a.tags.includes('illustration')),
    );
    const matched = featured.filter(
      (e) =>
        (!category.value || e.category === category.value) &&
        (!onlyFavorites || favorites.has(e.id)) &&
        words.every((w) => `${e.name} ${e.category} ${e.tags}`.toLowerCase().includes(w)),
    );
    list.replaceChildren();
    for (const element of matched.slice(0, limit)) {
      const card = document.createElement('div');
      card.className = 'uc-element-card';
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.element = element.id;
      button.setAttribute('aria-label', `Add ${element.name}`);
      // Markup comes exclusively from the bundled, tested original element catalogue.
      button.innerHTML = `<span class="uc-element-preview"><svg viewBox="0 0 256 256" width="104" height="104" aria-hidden="true">${element.markup}</svg></span>`;
      const name = document.createElement('span');
      name.textContent = element.name;
      name.className = 'uc-element-name';
      button.append(name);
      button.addEventListener('click', () => add(element));
      const favorite = document.createElement('button');
      favorite.type = 'button';
      favorite.className = 'uc-element-favorite';
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
      });
      card.append(button, favorite);
      list.append(card);
    }
    count.textContent = matched.length
      ? `${Math.min(limit, matched.length)} of ${matched.length} elements`
      : 'No matching elements. Try another word or collection.';
    more.hidden = limit >= matched.length;
    favoriteFilter.setAttribute('aria-pressed', String(onlyFavorites));
  }
  const reset = () => {
    limit = 24;
    render();
  };
  search.addEventListener('input', reset);
  category.addEventListener('change', reset);
  more.addEventListener('click', () => {
    limit += 24;
    render();
  });
  favoriteFilter.addEventListener('click', () => {
    onlyFavorites = !onlyFavorites;
    reset();
  });
  render();
}
