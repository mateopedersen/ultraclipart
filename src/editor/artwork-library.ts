import { rasterCatalog, type RasterAsset } from './raster';
interface LibraryAsset extends RasterAsset {
  title: string;
  topic: string;
  style: string;
  thumb: string;
  featured?: boolean;
  createdAt?: string;
  monochrome?: boolean;
}
export async function mountArtworkLibrary(root: HTMLElement, add: (id: string) => Promise<void>) {
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const search = q<HTMLInputElement>('[data-artwork-search]');
  const style = q<HTMLSelectElement>('[data-artwork-style]');
  const topic = q<HTMLSelectElement>('[data-artwork-topic]');
  const sort = q<HTMLSelectElement>('[data-artwork-sort]');
  const list = q<HTMLElement>('[data-artwork-grid]');
  const count = q<HTMLElement>('[data-artwork-count]');
  const next = q<HTMLButtonElement>('[data-artwork-more]');
  const previous = q<HTMLButtonElement>('[data-artwork-previous]');
  const position = q<HTMLElement>('[data-artwork-page]');
  const assets = (await rasterCatalog()) as LibraryAsset[];
  let page = 1,
    scope = 'featured',
    busy = false;
  const pageSize = 24;
  const featured = assets.filter((item) => item.featured);
  q('[data-featured-count]').textContent = featured.length.toLocaleString('en-US');
  const all = q<HTMLButtonElement>('[data-artwork-scope="all"]');
  all.textContent = `All Artwork (${assets.length.toLocaleString('en-US')})`;
  for (const slug of [...new Set(assets.map((a) => a.topic))].sort()) {
    topic.append(
      new Option(
        slug.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        slug,
      ),
    );
  }
  function render() {
    const words = search.value.trim().toLowerCase().split(/\s+/);
    const matched = (scope === 'featured' ? featured : assets).filter(
      (a) =>
        (!topic.value || topic.value === a.topic) &&
        (!style.value ||
          (style.value === 'realistic'
            ? a.id.includes('realistic')
            : style.value === 'Black & White'
              ? a.monochrome
              : a.style === style.value)) &&
        words.every((word) => `${a.title} ${a.topic} ${a.style}`.toLowerCase().includes(word)),
    );
    matched.sort((a, b) =>
      sort.value === 'title'
        ? a.title.localeCompare(b.title, 'en')
        : sort.value === 'newest'
          ? (b.createdAt || '').localeCompare(a.createdAt || '') ||
            a.title.localeCompare(b.title, 'en')
          : Number(!!b.featured) - Number(!!a.featured) || a.title.localeCompare(b.title, 'en'),
    );
    const pages = Math.max(1, Math.ceil(matched.length / pageSize));
    page = Math.min(page, pages);
    list.replaceChildren();
    for (const asset of matched.slice((page - 1) * pageSize, page * pageSize)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'uc-artwork-card';
      button.dataset.artwork = asset.id;
      button.disabled = busy;
      button.setAttribute('aria-label', `Add ${asset.title}`);
      const preview = document.createElement('span');
      preview.className = 'uc-artwork-preview';
      const img = document.createElement('img');
      img.src = asset.thumb;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 256;
      img.height = 200;
      preview.append(img);
      const name = document.createElement('strong');
      name.textContent = asset.title.replace(/ Clipart$/i, '');
      const detail = document.createElement('span');
      detail.className = 'uc-artwork-dimensions';
      detail.textContent = `${asset.width.toLocaleString()} × ${asset.height.toLocaleString()} px`;
      const action = document.createElement('span');
      action.className = 'uc-artwork-add';
      action.textContent = '+ Add to Canvas';
      button.append(preview, name, detail, action);
      button.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        for (const card of list.querySelectorAll<HTMLButtonElement>('button')) card.disabled = true;
        button.setAttribute('aria-busy', 'true');
        action.textContent = 'Adding…';
        count.textContent = `Adding ${asset.title}…`;
        try {
          await add(asset.id);
          count.textContent = `${asset.title} added to your canvas.`;
          action.textContent = '✓ Added · Add Again';
        } catch (error) {
          count.textContent =
            error instanceof Error ? error.message : 'This artwork could not be added. Try again.';
          action.textContent = '+ Add to Canvas';
        } finally {
          busy = false;
          button.removeAttribute('aria-busy');
          for (const card of list.querySelectorAll<HTMLButtonElement>('button'))
            card.disabled = false;
        }
      });
      list.append(button);
    }
    const first = matched.length ? (page - 1) * pageSize + 1 : 0;
    count.textContent = matched.length
      ? `${first}–${Math.min(page * pageSize, matched.length)} of ${matched.length.toLocaleString('en-US')} artworks`
      : 'No matching artwork. Clear filters or search the full catalog.';
    previous.disabled = page <= 1;
    next.disabled = page >= pages;
    next.hidden = false;
    position.textContent = `${page} / ${pages}`;
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-artwork-scope]'))
      button.setAttribute('aria-pressed', String(button.dataset.artworkScope === scope));
  }
  const reset = () => {
    page = 1;
    render();
  };
  const filter = () => {
    if (search.value.trim() || topic.value || style.value) scope = 'all';
    reset();
  };
  search.addEventListener('input', filter);
  style.addEventListener('change', filter);
  topic.addEventListener('change', filter);
  sort.addEventListener('change', reset);
  q('[data-artwork-clear]').addEventListener('click', () => {
    search.value = '';
    style.value = '';
    topic.value = '';
    sort.value = 'featured';
    scope = 'featured';
    reset();
  });
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-artwork-scope]'))
    button.addEventListener('click', () => {
      scope = button.dataset.artworkScope!;
      reset();
    });
  const turn = (delta: number) => {
    page += delta;
    render();
    list.scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  next.addEventListener('click', () => turn(1));
  previous.addEventListener('click', () => turn(-1));
  render();
}
