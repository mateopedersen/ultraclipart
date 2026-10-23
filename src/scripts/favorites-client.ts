import { SearchRepository } from '../lib/search-remote';
import { LatestRequest } from '../lib/search-request';
import { renderCard } from './search-card';
const PAGE_SIZE = 8;
export function readFavoriteIds(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]');
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter(
              (id): id is string => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id),
            ),
          ),
        ].slice(0, 10000)
      : [];
  } catch {
    return [];
  }
}
export function initFavorites() {
  const element = document.querySelector<HTMLElement>('#favorites');
  if (!element) return;
  const gallery: HTMLElement = element;
  const count = document.querySelector<HTMLElement>('#favorites-count')!,
    empty = document.querySelector<HTMLElement>('#favorites-empty')!,
    error = document.querySelector<HTMLElement>('#favorites-error')!,
    missing = document.querySelector<HTMLElement>('#favorites-missing')!;
  const nav = document.querySelector<HTMLElement>('#favorites-pagination')!,
    previous = document.querySelector<HTMLButtonElement>('#favorites-previous')!,
    next = document.querySelector<HTMLButtonElement>('#favorites-next')!;
  const repository = new SearchRepository(),
    requests = new LatestRequest();
  let page = 1;
  function render() {
    let ids: string[] = [];
    try {
      ids = readFavoriteIds(localStorage.getItem('ultraclipart-favorites'));
    } catch {}
    const pages = Math.max(1, Math.ceil(ids.length / PAGE_SIZE));
    page = Math.min(pages, Math.max(1, page));
    const currentPage = page;
    requests.cancel();
    gallery.hidden = true;
    gallery.setAttribute('aria-busy', 'true');
    error.hidden = true;
    missing.hidden = true;
    empty.hidden = true;
    nav.hidden = true;
    if (!ids.length) {
      gallery.replaceChildren();
      gallery.setAttribute('aria-busy', 'false');
      count.textContent = 'No saved illustrations.';
      empty.hidden = false;
      return;
    }
    count.textContent = 'Opening your saved illustrations…';
    void requests.run(
      (signal) =>
        repository.favoriteItems(ids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), signal),
      (items) => {
        const cards = items.filter((item) => item !== null);
        gallery.replaceChildren(...cards.map(renderCard));
        gallery.hidden = false;
        gallery.setAttribute('aria-busy', 'false');
        count.textContent = `${ids.length} saved ${ids.length === 1 ? 'illustration' : 'illustrations'}`;
        missing.hidden = cards.length === items.length;
        nav.hidden = pages <= 1;
        previous.disabled = currentPage <= 1;
        next.disabled = currentPage >= pages;
        document.querySelector<HTMLElement>('#favorites-position')!.textContent =
          `Page ${currentPage} of ${pages}`;
      },
      () => {
        gallery.setAttribute('aria-busy', 'false');
        count.textContent = 'Your saved illustrations could not be loaded.';
        error.hidden = false;
      },
    );
  }
  previous.addEventListener('click', () => {
    page--;
    render();
  });
  next.addEventListener('click', () => {
    page++;
    render();
  });
  document.querySelector('#favorites-retry')!.addEventListener('click', () => {
    repository.clear();
    render();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === 'ultraclipart-favorites') render();
  });
  render();
}
