import { formatFileSize } from '../lib/artwork-details';
import { SearchRepository } from '../lib/search-remote';
import type { SearchCard } from '../lib/search-index';
import { verifiedSourceUrl } from '../editor/source-policy';
import { cancelDownloadsWithin } from './downloads';

type Format = 'webp' | 'pdf';
const template = document.querySelector<HTMLTemplateElement>('#download-panel-template');
const repository = new SearchRepository();
let panel: HTMLDialogElement | undefined;
let opener: HTMLAnchorElement | undefined;
let request: AbortController | undefined;
let current: SearchCard | undefined;
let selection: Format = 'webp';

const text = (root: HTMLElement, selector: string, value: string) => {
  root.querySelector<HTMLElement>(selector)!.textContent = value;
};

let scrollLock: { overflow: string; padding: string; x: number; y: number } | undefined;
function lockPage() {
  const root = document.documentElement;
  const gap = window.innerWidth - root.clientWidth;
  scrollLock = {
    overflow: root.style.overflow,
    padding: root.style.paddingRight,
    x: scrollX,
    y: scrollY,
  };
  const padding = parseFloat(getComputedStyle(root).paddingRight) || 0;
  root.style.overflow = 'hidden';
  if (gap > 0) root.style.paddingRight = `${padding + gap}px`;
}
function unlockPage() {
  if (!scrollLock) return;
  const saved = scrollLock;
  scrollLock = undefined;
  document.documentElement.style.overflow = saved.overflow;
  document.documentElement.style.paddingRight = saved.padding;
  window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
}
function close(restoreFocus = true) {
  request?.abort();
  const closing = panel;
  panel = undefined;
  current = undefined;
  if (closing) {
    cancelDownloadsWithin(closing);
    if (closing.open) closing.close();
    closing.remove();
  }
  unlockPage();
  opener?.setAttribute('aria-expanded', 'false');
  if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
}
function mount(root: HTMLDialogElement) {
  document.body.append(root);
  lockPage();
  root.showModal();
  root.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  root.addEventListener('close', () => {
    if (panel === root) close();
  });
  let pressedBackdrop = false;
  root.addEventListener('pointerdown', (event) => {
    pressedBackdrop = event.target === root;
  });
  root.addEventListener('click', (event) => {
    if (event.target === root && pressedBackdrop) close();
    pressedBackdrop = false;
  });
}

function select(format: Format) {
  if (!panel || !current?.download) return;
  const root = panel;
  const item = current;
  const details = item.download!;
  const file = details.files[format];
  const url = item[format];
  if (!file || !url) return;
  const final = root.querySelector<HTMLAnchorElement>('[data-download-save]')!;
  // A format change cancels the previous transfer instead of relabeling it.
  cancelDownloadsWithin(root);
  selection = format;
  root.dataset.downloadId = item.id;
  root.dataset.downloadFormat = format;
  root
    .querySelectorAll<HTMLButtonElement>('[data-download-select]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.downloadSelect === format)),
    );
  final.href = verifiedSourceUrl({ url, ...file }, format, location.origin).href;
  final.download = `${item.id}.${format}`;
  final.dataset.finalDownload = format;
  final.dataset.expectedBytes = String(file.bytes);
  final.dataset.expectedSha256 = file.sha256;
  const label = format === 'webp' ? 'Image' : 'PDF';
  text(root, '[data-download-label]', `Download ${label}`);
  text(
    root,
    '[data-download-description]',
    format === 'webp'
      ? `${details.alpha ? 'Transparent image' : 'Image'} for documents, presentations and compatible design apps.`
      : 'A separate PDF document for printing. Choose Actual size in your PDF reader.',
  );
  text(
    root,
    '[data-download-dimensions]',
    format === 'webp'
      ? `${details.width.toLocaleString('en-US')} × ${details.height.toLocaleString('en-US')} pixels`
      : `${details.pdfPage} · ${details.pdfColorSpace}`,
  );
  text(root, '[data-download-filename]', final.download);
  text(root, '[data-download-bytes]', `${file.bytes.toLocaleString('en-US')} bytes`);
  text(root, '[data-download-hash]', file.sha256);
  root.querySelector<HTMLElement>('[data-download-status]')!.hidden = true;
}

async function load(root: HTMLElement, id: string, format: Format) {
  request?.abort();
  const controller = new AbortController();
  request = controller;
  const timeout = setTimeout(() => controller.abort(), 15_000);
  root.setAttribute('aria-busy', 'true');
  root.querySelector<HTMLElement>('[data-download-loading]')!.hidden = false;
  root.querySelector<HTMLElement>('[data-download-error]')!.hidden = true;
  root.querySelector<HTMLElement>('[data-download-content]')!.hidden = true;
  try {
    const embedded = [
      ...document.querySelectorAll<HTMLScriptElement>('[data-download-record]'),
    ].find((record) => record.dataset.downloadId === id);
    const item: SearchCard | null = embedded
      ? JSON.parse(embedded.textContent || 'null')
      : (await repository.favoriteItems([id], controller.signal))[0];
    if (!item?.download || item.id !== id) throw new Error('File unavailable');
    const details = item.download;
    if (![details.width, details.height].every((n) => Number.isSafeInteger(n) && n > 0))
      throw new Error('Invalid file dimensions');
    for (const kind of ['webp', 'pdf'] as const) {
      const file = details.files[kind];
      if (file && item[kind])
        verifiedSourceUrl({ url: item[kind]!, ...file }, kind, location.origin);
    }
    if (!details.files[format] || !item[format]) throw new Error('Format unavailable');
    if (controller.signal.aborted || panel !== root) return;
    current = item;
    text(root, '[data-download-artwork]', item.title);
    // The preview uses the validated original image URL, not a query-supplied URL.
    const image = root.querySelector<HTMLImageElement>('[data-download-preview]')!;
    image.src = verifiedSourceUrl(
      { url: item.webp, ...details.files.webp },
      'webp',
      location.origin,
    ).href;
    image.alt = item.alt;
    image.title = item.title;
    image.addEventListener(
      'error',
      () => {
        image.parentElement!.hidden = true;
      },
      { once: true },
    );
    for (const kind of ['webp', 'pdf'] as const) {
      const file = details.files[kind];
      root.querySelector<HTMLButtonElement>(`[data-download-select="${kind}"]`)!.hidden =
        !file || !item[kind];
      if (file) text(root, `[data-download-size="${kind}"]`, formatFileSize(file.bytes));
    }
    select(format);
    root.querySelector<HTMLElement>('[data-download-content]')!.hidden = false;
  } catch {
    if (panel === root && request === controller) {
      repository.clear();
      root.querySelector<HTMLElement>('[data-download-error]')!.hidden = false;
    }
  } finally {
    clearTimeout(timeout);
    if (panel === root && request === controller) {
      root.setAttribute('aria-busy', 'false');
      root.querySelector<HTMLElement>('[data-download-loading]')!.hidden = true;
    }
  }
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest<HTMLAnchorElement>('a[data-download-open]');
  if (
    link &&
    template &&
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  ) {
    const id = link.dataset.downloadOpen || '';
    const format = link.dataset.downloadFormat;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || (format !== 'webp' && format !== 'pdf')) return;
    event.preventDefault();
    if (panel && current?.id === id) {
      opener?.setAttribute('aria-expanded', 'false');
      opener = link;
      link.setAttribute('aria-expanded', 'true');
      select(format);
    } else {
      close(false);
      opener = link;
      selection = format;
      panel = template.content.firstElementChild!.cloneNode(true) as HTMLDialogElement;
      mount(panel);
      link.setAttribute('aria-expanded', 'true');
      void load(panel, id, format);
    }
    return;
  }
  if (!panel || !target || !panel.contains(target)) return;
  if (target.closest('[data-download-close]')) close();
  const choice = target.closest<HTMLButtonElement>('[data-download-select]');
  if (
    choice &&
    (choice.dataset.downloadSelect === 'webp' || choice.dataset.downloadSelect === 'pdf')
  )
    select(choice.dataset.downloadSelect);
  if (target.closest('[data-download-retry]') && opener) {
    repository.clear();
    void load(panel, opener.dataset.downloadOpen!, selection);
  }
});
// Search, board and related filters can replace their cards while a request is
// pending. Remove the associated panel and cancel work when that happens.
new MutationObserver(() => {
  if (panel && (!panel.isConnected || !opener?.isConnected)) close(false);
}).observe(document.querySelector('main') ?? document.body, { childList: true, subtree: true });
