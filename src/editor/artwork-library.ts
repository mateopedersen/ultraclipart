import { rasterCatalog, featuredRasterCatalog, type RasterAsset } from './raster';
interface LibraryAsset extends RasterAsset {
  title: string;
  alt?: string;
  topic: string;
  style: string;
  thumb: string;
  thumbSrcSet?: string;
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
  const initial = await featuredRasterCatalog();
  let assets = initial.items as LibraryAsset[];
  let fullLoaded = false;
  let filterRevision = 0;
  let loadingFull: Promise<void> | undefined;
  const ensureFull = () => {
    if (fullLoaded) return Promise.resolve();
    return (loadingFull ??= (async () => {
      count.textContent = 'Loading the full artwork library…';
      list.setAttribute('aria-busy', 'true');
      try {
        assets = (await rasterCatalog()) as LibraryAsset[];
        fullLoaded = true;
      } finally {
        list.removeAttribute('aria-busy');
        loadingFull = undefined;
      }
    })());
  };
  let browseMode: 'categories' | 'topics' | 'artwork' = initial.categories?.length
    ? 'categories'
    : 'artwork';
  let categoryId = '';
  const directory = initial.categories || [];
  let page = 1,
    scope = 'featured',
    busy = false;
  const pageSize = window.innerHeight < 800 ? 4 : 6;
  const featured = assets.filter((item) => item.featured);
  q('[data-featured-count]').textContent = featured.length.toLocaleString('en-US');
  const all = q<HTMLButtonElement>('[data-artwork-scope="all"]');
  all.textContent = `All Artwork (${initial.total.toLocaleString('en-US')})`;
  for (const slug of initial.topics) {
    topic.append(
      new Option(
        slug.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        slug,
      ),
    );
  }
  function renderDirectory() {
    const category = directory.find((item) => item.id === categoryId);
    const entries =
      browseMode === 'categories'
        ? directory.map((item) => ({
            id: item.id,
            title: item.title,
            thumb: item.thumb,
            detail: `${item.topics.length} ${item.topics.length === 1 ? 'subject' : 'subjects'}`,
          }))
        : (category?.topics || []).map((item) => ({
            ...item,
            detail: `${item.count} ${item.count === 1 ? 'illustration' : 'illustrations'}`,
          }));
    const pages = Math.max(1, Math.ceil(entries.length / pageSize));
    page = Math.max(1, Math.min(page, pages));
    list.replaceChildren();
    for (const entry of entries.slice((page - 1) * pageSize, page * pageSize)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wb-category-tile';
      button.title = entry.title;
      const image = document.createElement('img');
      image.src = entry.thumb;
      image.alt = '';
      image.loading = 'lazy';
      image.width = 96;
      image.height = 72;
      const title = document.createElement('strong');
      title.textContent = entry.title;
      const detail = document.createElement('small');
      detail.textContent = entry.detail;
      button.append(image, title, detail);
      button.addEventListener('click', () => {
        void (async () => {
          const revision = ++filterRevision;
          page = 1;
          if (browseMode === 'categories') {
            categoryId = entry.id;
            browseMode = 'topics';
            render();
          } else {
            topic.value = entry.id;
            browseMode = 'artwork';
            scope = 'all';
            await ensureFull();
            if (revision === filterRevision) render();
          }
        })().catch(() => {
          count.textContent = 'This category could not load. Select it again to retry.';
        });
      });
      list.append(button);
    }
    count.textContent =
      browseMode === 'categories'
        ? `${entries.length} categories — choose one to see its subjects`
        : `${entries.length} ${entries.length === 1 ? 'subject' : 'subjects'} in ${category?.title || 'this category'}`;
    previous.disabled = page <= 1;
    next.disabled = page >= pages;
    next.hidden = false;
    position.textContent = `Page ${page} of ${pages}`;
    const jump = q<HTMLInputElement>('[data-artwork-jump]');
    jump.max = String(pages);
    jump.value = String(page);
  }
  function render() {
    root.dataset.libraryBrowse = browseMode;
    if (browseMode !== 'artwork')
      for (const button of root.querySelectorAll('[data-artwork-scope]'))
        button.setAttribute('aria-pressed', 'false');
    const category = directory.find((item) => item.id === categoryId);
    const parent = q<HTMLButtonElement>('[data-library-parent]');
    parent.hidden = !category;
    parent.textContent = category?.title || '';
    q('[data-library-current]').textContent = topic.value
      ? topic.selectedOptions[0]?.textContent || ''
      : browseMode === 'categories'
        ? 'Choose a Category'
        : browseMode === 'topics'
          ? 'Choose a Subject'
          : '';
    if (browseMode !== 'artwork' && !search.value.trim()) {
      renderDirectory();
      return;
    }
    const words = search.value.trim().toLowerCase().split(/\s+/);
    const matched = (scope === 'featured' ? featured : assets).filter(
      (a) =>
        (!topic.value || topic.value === a.topic) &&
        (!category || category.topics.some((subject) => subject.id === a.topic)) &&
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
      button.title = asset.title;
      button.setAttribute('aria-label', `Add ${asset.title}`);
      const preview = document.createElement('span');
      preview.className = 'uc-artwork-preview';
      const img = document.createElement('img');
      img.src = asset.thumb;
      if (asset.thumbSrcSet) {
        img.srcset = asset.thumbSrcSet;
        img.sizes = '160px';
      }
      img.alt = asset.alt || asset.title;
      img.title = asset.title;
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
    position.textContent = `Page ${page} of ${pages}`;
    const jump = q<HTMLInputElement>('[data-artwork-jump]');
    jump.max = String(pages);
    jump.value = String(page);
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-artwork-scope]'))
      button.setAttribute('aria-pressed', String(button.dataset.artworkScope === scope));
  }
  const reset = () => {
    page = 1;
    render();
  };
  const filter = async () => {
    const revision = ++filterRevision;
    try {
      if (search.value.trim() || topic.value || style.value) await ensureFull();
      if (revision !== filterRevision) return;
      if (search.value.trim() || topic.value || style.value) {
        scope = 'all';
        browseMode = 'artwork';
      }
      reset();
    } catch {
      if (revision !== filterRevision) return;
      count.textContent = 'The full library could not load. Change a filter to retry.';
    }
  };
  search.addEventListener('input', filter);
  style.addEventListener('change', filter);
  topic.addEventListener('change', filter);
  sort.addEventListener('change', reset);
  q('[data-artwork-clear]').addEventListener('click', () => {
    filterRevision++;
    search.value = '';
    style.value = '';
    topic.value = '';
    sort.value = 'featured';
    scope = 'featured';
    browseMode = 'categories';
    categoryId = '';
    reset();
  });
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-artwork-scope]'))
    button.addEventListener('click', async () => {
      const revision = ++filterRevision;
      try {
        if (button.dataset.artworkScope === 'all') await ensureFull();
        if (revision !== filterRevision) return;
        scope = button.dataset.artworkScope!;
        browseMode = 'artwork';
        categoryId = '';
        topic.value = '';
        reset();
      } catch {
        if (revision !== filterRevision) return;
        count.textContent = 'The full library could not load. Select All Artwork to retry.';
      }
    });
  q('[data-library-home]').addEventListener('click', () => {
    filterRevision++;
    browseMode = 'categories';
    categoryId = '';
    topic.value = '';
    search.value = '';
    page = 1;
    render();
  });
  q('[data-library-parent]').addEventListener('click', () => {
    filterRevision++;
    browseMode = 'topics';
    topic.value = '';
    search.value = '';
    page = 1;
    render();
  });
  const turn = (delta: number) => {
    page += delta;
    render();
    list.scrollTop = 0;
  };
  q<HTMLInputElement>('[data-artwork-jump]').addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    const requested = Number(target.value);
    if (Number.isInteger(requested) && requested >= 1) {
      page = requested;
      render();
      list.scrollTop = 0;
    }
  });
  next.addEventListener('click', () => turn(1));
  previous.addEventListener('click', () => turn(-1));
  render();
}
