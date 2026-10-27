import { SearchRepository } from '../lib/search-remote';
import { FAVORITES_KEY, parseFavoriteIds } from '../lib/favorites-storage';
import {
  planFavoriteDownload,
  type FavoriteFormat,
  type FavoriteFile,
} from '../lib/favorite-download-plan';
import { readVerified } from '../editor/verified-fetch';
import { zipFiles } from '../editor/smart/zip';
export function mountFavoriteDownloads() {
  const dialog = document.querySelector<HTMLDialogElement>('#favorites-download-dialog')!;
  const q = <T extends HTMLElement = HTMLElement>(s: string) => dialog.querySelector<T>(s)!;
  const status = q('[data-batch-status]'),
    progress = q<HTMLProgressElement>('progress'),
    download = q<HTMLAnchorElement>('[data-batch-download]');
  const repository = new SearchRepository();
  let controller: AbortController | undefined,
    parts: FavoriteFile[][] = [],
    part = 0,
    format: FavoriteFormat = 'webp',
    prepared: { name: string; blob: Blob }[] = [],
    index = 0,
    url = '',
    total = 0,
    unavailable: string[] = [];
  let busy = false,
    generation = 0;
  const state = (value: string) => {
    status.textContent = value;
  };
  function revoke() {
    if (url) URL.revokeObjectURL(url);
    url = '';
    download.removeAttribute('href');
    download.hidden = true;
  }
  function buttons() {
    q<HTMLButtonElement>('[data-batch-next]').disabled = busy || part >= parts.length - 1;
    q('[data-batch-next]').hidden = !download.hasAttribute('href') || part >= parts.length - 1;
    q<HTMLButtonElement>('[data-batch-retry]').disabled = busy;
  }
  async function prepare() {
    if (busy || !parts[part]) return;
    busy = true;
    controller = new AbortController();
    const signal = controller.signal,
      token = generation;
    q('[data-batch-retry]').hidden = true;
    revoke();
    buttons();
    try {
      const files = parts[part];
      progress.max = files.length;
      progress.value = index;
      while (index < files.length) {
        const file = files[index];
        state(
          `Part ${part + 1} of ${parts.length} · Checking ${index + 1}/${files.length}: ${file.title}`,
        );
        const bytes = await readVerified(file, format, location.origin, signal);
        if (signal.aborted || token !== generation) return;
        prepared.push({
          name: file.name,
          blob: new Blob([bytes], { type: format === 'pdf' ? 'application/pdf' : 'image/webp' }),
        });
        index++;
        progress.value = index;
      }
      state('Building your ZIP from verified originals…');
      const manifest = {
        format,
        part: part + 1,
        parts: parts.length,
        totalAvailable: total,
        unavailable,
        files: files.map(({ id, name, bytes, sha256 }) => ({ id, name, bytes, sha256 })),
      };
      const archive = await zipFiles([
        ...prepared,
        {
          name: 'download-manifest.json',
          blob: new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }),
        },
      ]);
      if (signal.aborted || token !== generation) return;
      url = URL.createObjectURL(archive);
      download.href = url;
      download.download = `ultraclipart-favorites-${format}-part-${part + 1}-of-${parts.length}.zip`;
      download.textContent = `Download ZIP · ${files.length} ${format === 'pdf' ? 'PDFs' : 'Images'} · Part ${part + 1}/${parts.length}`;
      download.hidden = false;
      state(
        `${files.length} verified files are ready${unavailable.length ? `; ${unavailable.length} saved items are unavailable in this format` : ''}. ${parts.length > 1 ? 'Download this part, then prepare the next one to collect every file.' : 'Your complete available collection is in this ZIP.'}`,
      );
      prepared = [];
    } catch (error) {
      if (!signal.aborted && token === generation) {
        state(
          `Preparation stopped at file ${index + 1}. Completed files were retained for retry. ${error instanceof Error ? error.message : 'Try again.'}`,
        );
        q('[data-batch-retry]').hidden = false;
      }
    } finally {
      if (token === generation) {
        busy = false;
        buttons();
      }
    }
  }
  async function start(next: FavoriteFormat) {
    if (busy) return;
    generation++;
    revoke();
    q('[data-batch-restart]').hidden = true;
    format = next;
    part = 0;
    index = 0;
    prepared = [];
    parts = [];
    unavailable = [];
    q('[data-batch-next]').hidden = true;
    q('[data-batch-retry]').hidden = true;
    q('h2').textContent =
      next === 'pdf' ? 'Download All Favorite PDFs' : 'Download All Favorite Images';
    if (!dialog.open) dialog.showModal();
    const ids = parseFavoriteIds(localStorage.getItem(FAVORITES_KEY));
    if (!ids.length) {
      state('Save some artwork first. Your favorite files will appear here.');
      progress.value = 0;
      return;
    }
    busy = true;
    controller = new AbortController();
    const signal = controller.signal,
      token = generation;
    try {
      state(`Checking ${ids.length} saved designs…`);
      progress.max = ids.length;
      progress.value = 0;
      const items = [];
      for (let i = 0; i < ids.length; i += 128) {
        items.push(...(await repository.favoriteItems(ids.slice(i, i + 128), signal)));
        progress.value = Math.min(ids.length, i + 128);
      }
      if (signal.aborted || token !== generation) return;
      const plan = planFavoriteDownload(items, next, location.origin);
      parts = plan.parts;
      unavailable = plan.unavailable;
      total = plan.files.length;
      const list = q('[data-batch-unavailable]');
      list.replaceChildren();
      for (const name of unavailable) {
        const li = document.createElement('li');
        li.textContent = name;
        list.append(li);
      }
      q('[data-batch-missing]').hidden = !unavailable.length;
      busy = false;
      if (!parts.length) {
        state(
          'None of these saved items has an available verified file in this format. Your favorites were not changed.',
        );
        return;
      }
      await prepare();
    } catch (error) {
      if (!signal.aborted && token === generation) {
        state(error instanceof Error ? error.message : 'The catalog could not be loaded.');
        q('[data-batch-restart]').hidden = false;
      }
    } finally {
      if (token === generation) {
        busy = false;
        buttons();
      }
    }
  }
  document
    .querySelectorAll<HTMLButtonElement>('[data-favorites-download]')
    .forEach((button) =>
      button.addEventListener(
        'click',
        () => void start(button.dataset.favoritesDownload as FavoriteFormat),
      ),
    );
  q('[data-batch-next]').addEventListener('click', () => {
    if (!busy) {
      part++;
      index = 0;
      prepared = [];
      void prepare();
    }
  });
  q('[data-batch-retry]').addEventListener('click', () => void prepare());
  q('[data-batch-restart]').addEventListener('click', () => {
    q('[data-batch-restart]').hidden = true;
    void start(format);
  });
  q('[data-batch-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    generation++;
    controller?.abort();
    revoke();
    prepared = [];
    parts = [];
    busy = false;
  });
}
