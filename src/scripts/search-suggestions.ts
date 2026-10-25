import { defaults } from '../lib/search';
import { SearchRepository } from '../lib/search-remote';
import { LatestRequest } from '../lib/search-request';
import { searchSiteEntries, searchKindLabels } from '../lib/site-search';
export function initSearchSuggestions() {
  for (const form of document.querySelectorAll<HTMLFormElement>('form[action="/search/"]')) {
    if (form.id === 'catalog-search' || form.dataset.suggestionsReady) continue;
    const found = form.querySelector<HTMLInputElement>('input[name="q"]');
    if (!found) continue;
    const input: HTMLInputElement = found;
    form.dataset.suggestionsReady = 'true';
    input.maxLength = 320;
    input.removeAttribute('list');
    const panel = document.createElement('div');
    panel.className = 'search-suggestions';
    panel.id = `suggestions-${crypto.randomUUID()}`;
    panel.hidden = true;
    panel.setAttribute('role', 'listbox');
    panel.setAttribute('aria-label', 'Search suggestions');
    form.append(panel);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-controls', panel.id);
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    const repository = new SearchRepository(),
      requests = new LatestRequest();
    let timer: ReturnType<typeof setTimeout> | undefined,
      active = -1,
      composing = false,
      refreshed = Date.now();
    const close = () => {
      clearTimeout(timer);
      requests.cancel();
      panel.hidden = true;
      active = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    };
    function suggest() {
      clearTimeout(timer);
      requests.cancel();
      panel.hidden = true;
      active = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      const query = input.value.trim();
      if (composing || query.length < 2) {
        close();
        return;
      }
      timer = setTimeout(() => {
        const loading = document.createElement('p');
        loading.textContent = 'Searching…';
        panel.replaceChildren(loading);
        panel.hidden = false;
        panel.setAttribute('aria-busy', 'true');
        input.setAttribute('aria-expanded', 'true');
        if (Date.now() - refreshed > 30000) {
          repository.clear();
          refreshed = Date.now();
        }
        void requests.run(
          async (signal) => {
            const manifest = await repository.manifest(signal);
            const [art, entries] = await Promise.all([
              repository.search({ ...defaults, q: query, size: 8 }, signal),
              repository.siteEntries(manifest, signal),
            ]);
            return { art, site: searchSiteEntries(entries, query) };
          },
          ({ art, site }) => {
            panel.setAttribute('aria-busy', 'false');
            const options: { title: string; href: string; kind: string; thumb?: string }[] = [
              ...art.items.slice(0, 4).map((item) => ({
                title: item.title,
                href: `/art/${item.id}/`,
                kind: 'Artwork',
                thumb: item.thumb,
              })),
              ...site.slice(0, 3).map(({ entry }) => ({
                title: entry.title,
                href: entry.href,
                kind: searchKindLabels[entry.kind],
              })),
              {
                title: `See all results for “${query}”`,
                href: `/search/?q=${encodeURIComponent(query)}`,
                kind: 'Search',
              },
            ];
            panel.replaceChildren(
              ...options.map((option, i) => {
                const link = document.createElement('a');
                link.id = `${panel.id}-${i}`;
                link.href = option.href;
                link.setAttribute('role', 'option');
                link.setAttribute('aria-selected', 'false');
                if (i === options.length - 1) link.className = 'search-suggestion-all';
                if (option.thumb) {
                  const image = document.createElement('img');
                  image.src = option.thumb;
                  image.alt = '';
                  image.width = image.height = 44;
                  link.append(image);
                }
                const text = document.createElement('span'),
                  label = document.createElement('span'),
                  kind = document.createElement('small');
                label.textContent = option.title;
                kind.textContent = option.kind;
                text.append(label, kind);
                link.append(text);
                return link;
              }),
            );
            active = -1;
            panel.hidden = false;
            input.setAttribute('aria-expanded', 'true');
            input.removeAttribute('aria-activedescendant');
          },
          () => {
            close();
          },
        );
      }, 240);
    }
    input.addEventListener('input', suggest);
    input.addEventListener('focus', suggest);
    input.addEventListener('compositionstart', () => {
      composing = true;
      close();
    });
    input.addEventListener('compositionend', () => {
      composing = false;
      suggest();
    });
    input.addEventListener('keydown', (event) => {
      if (panel.hidden) return;
      const links = [...panel.querySelectorAll<HTMLAnchorElement>('[role="option"]')];
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        if (!links.length) return;
        event.preventDefault();
        active =
          active < 0
            ? event.key === 'ArrowDown'
              ? 0
              : links.length - 1
            : (active + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
        links.forEach((link, i) => link.setAttribute('aria-selected', String(i === active)));
        input.setAttribute('aria-activedescendant', links[active].id);
        links[active].scrollIntoView({ block: 'nearest' });
      }
      if (event.key === 'Enter' && active >= 0) {
        event.preventDefault();
        location.assign(links[active].href);
      }
    });
    form.addEventListener('submit', close);
    form.addEventListener('focusout', (event) => {
      if (!form.contains(event.relatedTarget as Node)) close();
    });
    document.addEventListener('pointerdown', (event) => {
      if (!form.contains(event.target as Node)) close();
    });
    window.addEventListener('pageshow', close);
  }
}
