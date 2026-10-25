import { verifiedSourceUrl } from '../editor/source-policy';

const maxDownloadBytes = 16_000_000;
const pending = new WeakSet<HTMLAnchorElement>();
const transfers = new WeakMap<
  HTMLAnchorElement,
  { controller: AbortController; cancelled: boolean }
>();

export function cancelDownloadsWithin(root: HTMLElement) {
  root.querySelectorAll<HTMLAnchorElement>('a[download]').forEach((link) => {
    const transfer = transfers.get(link);
    if (!transfer) return;
    transfer.cancelled = true;
    transfer.controller.abort();
    transfers.delete(link);
    pending.delete(link);
    link.removeAttribute('aria-busy');
    const status = document.querySelector<HTMLElement>('#download-status');
    if (status?.textContent === 'Preparing your download…') status.hidden = true;
  });
}

// Cross-origin links ignore the HTML download attribute. Fetch through the
// explicitly allowed CDN and save a local Blob, with bounded time and memory.
async function downloadFile(link: HTMLAnchorElement, status: HTMLElement) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const transfer = { controller, cancelled: false };
  transfers.set(link, transfer);
  // Keep the selection immutable during the request, even when a panel closes.
  const source = link.href;
  const filename = link.download;
  const kind = link.dataset.finalDownload;
  const expectedBytes = Number(link.dataset.expectedBytes);
  const expectedHash = link.dataset.expectedSha256;
  const station = link.hasAttribute('data-final-download');
  const localStatus = station
    ? link.parentElement?.querySelector<HTMLElement>('[data-download-status]')
    : null;
  const label = link.querySelector<HTMLElement>('[data-download-label]');
  const originalLabel = label?.textContent || '';
  const updateLocal = (message: string) => {
    if (localStatus && !transfer.cancelled && link.isConnected) {
      localStatus.hidden = false;
      localStatus.textContent = message;
    }
  };
  pending.add(link);
  link.setAttribute('aria-busy', 'true');
  status.hidden = false;
  status.textContent = 'Preparing your download…';
  updateLocal('Preparing and checking your original file…');
  if (label) label.textContent = 'Preparing download…';
  try {
    if (station) {
      if (
        (kind !== 'webp' && kind !== 'pdf') ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*\.(webp|pdf)$/.test(filename) ||
        !filename.endsWith(`.${kind}`)
      )
        throw new Error('Invalid download selection');
      verifiedSourceUrl(
        {
          url: source,
          bytes: expectedBytes,
          sha256: expectedHash || '',
        },
        kind,
        location.origin,
      );
    }
    const byteLimit = station ? expectedBytes : maxDownloadBytes;
    // Ordinary image previews may have populated the HTTP cache without CORS
    // headers. Fetch readable bytes again rather than reuse that opaque entry.
    const response = await fetch(source, {
      signal: controller.signal,
      credentials: 'omit',
      mode: 'cors',
      cache: 'reload',
    });
    if (
      !response.ok ||
      new URL(response.url).origin !==
        (station ? new URL(source).origin : 'https://assets.ultraclipart.com')
    )
      throw new Error('Unavailable download');
    const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    const extension = new URL(source).pathname.split('.').pop()?.toLowerCase() ?? '';
    const expectedTypes: Record<string, string> = {
      pdf: 'application/pdf',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };
    if (type !== expectedTypes[extension]) throw new Error('Invalid download type');
    const declaredLength = Number(response.headers.get('content-length'));
    if (declaredLength > byteLimit || !response.body) throw new Error('Invalid download size');
    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > byteLimit) {
        await reader.cancel();
        throw new Error('Invalid download size');
      }
      chunks.push(value as Uint8Array<ArrayBuffer>);
    }
    if (!length) throw new Error('Empty download');
    // An upstream error page can have an incorrect success/MIME header. Do not
    // save HTML as a PDF or WebP merely because that header says it is one.
    const prefix = new Uint8Array(Math.min(length, 12));
    let prefixLength = 0;
    for (const chunk of chunks) {
      const part = chunk.subarray(0, prefix.length - prefixLength);
      prefix.set(part, prefixLength);
      prefixLength += part.length;
      if (prefixLength === prefix.length) break;
    }
    const signature = String.fromCharCode(...prefix);
    if (
      (type === 'application/pdf' && !signature.startsWith('%PDF-')) ||
      (type === 'image/webp' && !(signature.startsWith('RIFF') && signature.slice(8) === 'WEBP'))
    )
      throw new Error('Invalid download contents');
    const blob = new Blob(chunks, { type });
    if (expectedBytes && length !== expectedBytes) throw new Error('File size changed');
    if (expectedHash) {
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const actual = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      if (actual !== expectedHash) throw new Error('File checksum changed');
    }
    if (controller.signal.aborted) throw new Error('Download cancelled');
    const url = URL.createObjectURL(blob);
    const save = document.createElement('a');
    save.href = url;
    save.download = filename || new URL(source).pathname.split('/').pop()!;
    document.body.append(save);
    save.click();
    save.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    status.textContent = 'Your download is ready.';
    updateLocal('Original file verified. Your download has started.');
    setTimeout(() => {
      if (status.textContent === 'Your download is ready.') status.hidden = true;
    }, 6000);
  } catch {
    if (transfer.cancelled) return;
    status.textContent =
      'The download could not finish. Check your connection and select the download again.';
    status.hidden = false;
    updateLocal('We couldn’t verify this download. Refresh the page or try again.');
  } finally {
    clearTimeout(timeout);
    controller.abort();
    if (transfers.get(link) === transfer) {
      transfers.delete(link);
      pending.delete(link);
      link.removeAttribute('aria-busy');
      if (label) label.textContent = originalLabel;
    }
  }
}

document.addEventListener('click', (event) => {
  const link =
    event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[download]') : null;
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !link ||
    link.hasAttribute('data-download-open') ||
    (!link.hasAttribute('data-final-download') &&
      new URL(link.href).origin !== 'https://assets.ultraclipart.com')
  )
    return;
  event.preventDefault();
  if (pending.has(link)) return;
  const status = document.querySelector<HTMLElement>('#download-status');
  if (status) void downloadFile(link, status);
});
