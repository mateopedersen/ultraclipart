import { rasterCatalog, type RasterAsset } from './raster';
interface LibraryAsset extends RasterAsset {
  title: string;
  topic: string;
  style: string;
  thumb: string;
}
export async function mountArtworkLibrary(root: HTMLElement, add: (id: string) => Promise<void>) {
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const search = q<HTMLInputElement>('[data-artwork-search]'),
    style = q<HTMLSelectElement>('[data-artwork-style]'),
    topic = q<HTMLSelectElement>('[data-artwork-topic]'),
    list = q<HTMLElement>('[data-artwork-grid]'),
    count = q<HTMLElement>('[data-artwork-count]'),
    more = q<HTMLButtonElement>('[data-artwork-more]');
  const assets = (await rasterCatalog()) as LibraryAsset[];
  let limit = 24,
    busy = false;
  const topics = [...new Set(assets.map((a) => a.topic))].sort();
  for (const slug of topics) {
    const option = document.createElement('option');
    option.value = slug;
    option.textContent = slug.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    topic.append(option);
  }
  function render() {
    const words = search.value.trim().toLowerCase().split(/\s+/);
    const matched = assets.filter(
      (a) =>
        (!topic.value || topic.value === a.topic) &&
        (!style.value ||
          (style.value === 'realistic' ? a.id.includes('realistic') : a.style === style.value)) &&
        words.every((w) => `${a.title} ${a.topic}`.toLowerCase().includes(w)),
    );
    list.replaceChildren();
    for (const asset of matched.slice(0, limit)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'uc-artwork-card';
      button.dataset.artwork = asset.id;
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
      button.append(preview, name, detail);
      button.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        button.setAttribute('aria-busy', 'true');
        count.textContent = `Adding ${asset.title} at original resolution…`;
        try {
          await add(asset.id);
          count.textContent = `${asset.title} added. Select it on the canvas to edit.`;
        } catch (error) {
          count.textContent =
            error instanceof Error
              ? error.message
              : 'This artwork could not be added. Please retry.';
        } finally {
          busy = false;
          button.removeAttribute('aria-busy');
        }
      });
      list.append(button);
    }
    count.textContent = matched.length
      ? `${Math.min(limit, matched.length)} of ${matched.length.toLocaleString()} artworks`
      : 'No matches in this style. Choose All styles or another search.';
    more.hidden = limit >= matched.length;
  }
  const reset = () => {
    limit = 24;
    render();
  };
  search.addEventListener('input', reset);
  style.addEventListener('change', reset);
  topic.addEventListener('change', reset);
  more.addEventListener('click', () => {
    limit += 24;
    render();
  });
  render();
}
