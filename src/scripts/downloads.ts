const maxDownloadBytes = 16_000_000;
const pending = new WeakSet<HTMLAnchorElement>();

// Cross-origin links ignore the HTML download attribute. Fetch through the
// explicitly allowed CDN and save a local Blob, with bounded time and memory.
async function downloadFile(link: HTMLAnchorElement, status: HTMLElement) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  pending.add(link);
  link.setAttribute('aria-busy', 'true');
  status.hidden = false;
  status.textContent = 'Preparing your download…';
  try {
    // Ordinary image previews may have populated the HTTP cache without CORS
    // headers. Fetch readable bytes again rather than reuse that opaque entry.
    const response = await fetch(link.href, {
      signal: controller.signal,
      credentials: 'omit',
      mode: 'cors',
      cache: 'reload',
    });
    if (!response.ok || new URL(response.url).origin !== 'https://assets.ultraclipart.com')
      throw new Error('Unavailable download');
    const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    const extension = new URL(link.href).pathname.split('.').pop()?.toLowerCase() ?? '';
    const expectedTypes: Record<string, string> = {
      pdf: 'application/pdf',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };
    if (type !== expectedTypes[extension]) throw new Error('Invalid download type');
    const declaredLength = Number(response.headers.get('content-length'));
    if (declaredLength > maxDownloadBytes || !response.body)
      throw new Error('Invalid download size');
    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxDownloadBytes) {
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
    const url = URL.createObjectURL(new Blob(chunks, { type }));
    const save = document.createElement('a');
    save.href = url;
    save.download = new URL(link.href).pathname.split('/').pop()!;
    document.body.append(save);
    save.click();
    save.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    status.textContent = 'Your download is ready.';
    setTimeout(() => {
      if (status.textContent === 'Your download is ready.') status.hidden = true;
    }, 6000);
  } catch {
    status.textContent =
      'The download could not finish. Check your connection and select the download again.';
    status.hidden = false;
  } finally {
    clearTimeout(timeout);
    controller.abort();
    pending.delete(link);
    link.removeAttribute('aria-busy');
  }
}

document.addEventListener('click', (event) => {
  const link =
    event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[download]') : null;
  if (!link || new URL(link.href).origin !== 'https://assets.ultraclipart.com') return;
  event.preventDefault();
  if (pending.has(link)) return;
  const status = document.querySelector<HTMLElement>('#download-status');
  if (status) void downloadFile(link, status);
});
