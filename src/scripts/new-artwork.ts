import { defaults } from '../lib/search';
import { SearchRepository } from '../lib/search-remote';
import type { SearchCard } from '../lib/search-index';
import { renderCard } from './search-card';

const root = document.querySelector<HTMLElement>('[data-new-artwork]');
if (root) {
  const gallery = root.querySelector<HTMLElement>('.gallery')!;
  const more = root.querySelector<HTMLButtonElement>('[data-new-more]')!;
  const refreshButton = root.querySelector<HTMLButtonElement>('[data-new-refresh]')!;
  const status = root.querySelector<HTMLElement>('[data-new-status]')!;
  const seed = JSON.parse(root.querySelector('[data-new-seed]')!.textContent!) as {
    version: string;
    total: number;
    items: SearchCard[];
  };
  let repository = new SearchRepository();
  repository.seed(seed.version, seed.items);
  let version = seed.version,
    page = 1,
    total = seed.total,
    busy = false;
  let controller: AbortController | undefined;
  more.hidden = gallery.children.length >= total;
  refreshButton.hidden = false;
  root.dataset.ready = 'true';
  const state = (number: number) => ({
    ...defaults,
    type: 'artwork',
    sort: 'newest',
    size: 32,
    page: number,
  });
  function describe() {
    status.textContent = `Showing ${gallery.children.length.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} illustrations.`;
    more.hidden = gallery.children.length >= total;
  }
  async function update(append: boolean, explicit = false) {
    if (busy || (document.hidden && !explicit)) return;
    busy = true;
    more.disabled = refreshButton.disabled = true;
    controller = new AbortController();
    const timeout = window.setTimeout(() => controller?.abort(), 15000);
    try {
      if (!append) {
        const candidate = new SearchRepository();
        const manifest = await candidate.manifest(controller.signal);
        if (manifest.version === version) {
          if (explicit) describe();
          return;
        }
        const result = await candidate.search(state(1), controller.signal);
        gallery.replaceChildren(...result.items.map(renderCard));
        repository = candidate;
        version = result.manifest.version;
        total = result.total;
        page = 1;
      } else {
        const result = await repository.search(state(page + 1), controller.signal);
        if (result.manifest.version !== version) {
          repository.clear();
          const latest = await repository.search(state(1), controller.signal);
          gallery.replaceChildren(...latest.items.map(renderCard));
          version = latest.manifest.version;
          total = latest.total;
          page = 1;
        } else {
          const existing = new Set(
            [...gallery.children].map((node) => (node as HTMLElement).dataset.id),
          );
          gallery.append(...result.items.filter((item) => !existing.has(item.id)).map(renderCard));
          page = result.page;
          total = result.total;
        }
      }
      describe();
      root!.dataset.catalogVersion = version;
    } catch {
      status.textContent =
        'The latest clipart could not be refreshed. Your current results are still available. Try Refresh latest.';
    } finally {
      clearTimeout(timeout);
      busy = false;
      more.disabled = refreshButton.disabled = false;
    }
  }
  more.addEventListener('click', () => void update(true, true));
  refreshButton.addEventListener('click', () => void update(false, true));
  for (const event of ['focus', 'pageshow'])
    window.addEventListener(event, () => void update(false));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void update(false);
  });
  window.addEventListener('pagehide', () => controller?.abort());
  window.setInterval(() => void update(false), 30000);
  void update(false);
}
