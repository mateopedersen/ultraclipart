import { artworkUrl, caption, SITE, socialLinks, type ShareOptions } from './core';
import './dialog.css';

type OwnedShare = { id: string; title: string; url: string; deleteToken: string };
type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
const ownedKey = 'uc-public-shares-v1';
let activeClose: (() => void) | undefined;
const icon =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function validOwned(value: unknown): value is OwnedShare {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<OwnedShare>;
  return (
    typeof item.id === 'string' &&
    /^[a-f0-9]{32}$/.test(item.id) &&
    typeof item.deleteToken === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(item.deleteToken) &&
    typeof item.title === 'string' &&
    item.title.trim().length > 0 &&
    item.title.length <= 100 &&
    !/[\u0000-\u001f\u007f]/.test(item.title) &&
    item.url === `${SITE}/share/${item.id}/`
  );
}
function owned(): OwnedShare[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ownedKey) || '[]');
    return Array.isArray(value) ? value.filter(validOwned).slice(0, 1000) : [];
  } catch {
    return [];
  }
}
async function imageFile(options: ShareOptions, signal: AbortSignal): Promise<Blob> {
  if (options.blob) {
    if (
      !['image/png', 'image/webp', 'image/jpeg'].includes(options.blob.type) ||
      options.blob.size > 70_000_000
    )
      throw new Error('This image is too large to share. Export a smaller image first.');
    return options.blob;
  }
  const url = new URL(options.imageUrl || '', location.origin);
  if (![location.origin, SITE, 'https://assets.ultraclipart.com'].includes(url.origin))
    throw new Error('The image source is unavailable.');
  const response = await fetch(url, {
    signal,
    credentials: 'omit',
    mode: 'cors',
    cache: 'reload',
    redirect: 'error',
  });
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > 20_000_000)
    throw new Error('The image could not be prepared. The page link is still available.');
  const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!mime || !['image/png', 'image/webp', 'image/jpeg'].includes(mime))
    throw new Error('The artwork must be a PNG, WebP or JPEG image.');
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 20_000_000) {
      await reader.cancel();
      throw new Error('The image is too large to share here.');
    }
    chunks.push(value as Uint8Array<ArrayBuffer>);
  }
  return new Blob(chunks, {
    type: mime,
  });
}
async function canvasFor(blob: Blob, max = 2048): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width * bitmap.height > 40_000_000)
      throw new Error('Export an image smaller than 40 megapixels to share it.');
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close();
  }
}
const encode = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image preparation failed.'))),
      type,
      quality,
    ),
  );
async function publicImage(blob: Blob): Promise<string> {
  for (const size of [2048, 1536, 1024, 768]) {
    const canvas = await canvasFor(blob, size);
    for (const quality of [0.9, 0.78, 0.64]) {
      let image = await encode(canvas, 'image/webp', quality);
      if (image.type !== 'image/webp') {
        const { encodeWebp } = await import('../editor/webp-fallback');
        image = await encodeWebp(
          canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height),
          quality,
        );
      }
      if (image.size <= 384 * 1024) {
        const bytes = new Uint8Array(await image.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192)
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return btoa(binary);
      }
    }
  }
  throw new Error(
    'This detailed image cannot fit the free sharing limit. Download the PNG and share it with your app instead.',
  );
}
async function loadTurnstile(): Promise<Turnstile> {
  const service = () => (window as Window & { turnstile?: Turnstile }).turnstile;
  if (service()) return service()!;
  if (!document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/"]')) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    document.head.append(script);
  }
  for (let i = 0; i < 150; i++) {
    if (service()) return service()!;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Verification could not load. Check your connection and try again.');
}
function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function openShare(options: ShareOptions): Promise<void> {
  activeClose?.();
  const focus =
    options.trigger ||
    (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const abort = new AbortController();
  const dialog = document.createElement('dialog');
  dialog.className = 'uc-share';
  dialog.setAttribute('aria-labelledby', 'uc-share-heading');
  dialog.innerHTML = `<div class="uc-share-head"><div><span class="uc-share-kicker">A LITTLE ART. PASSED ALONG.</span><h2 id="uc-share-heading">Share your inspiration.</h2></div><button type="button" class="uc-share-close" aria-label="Close sharing">×</button></div>
  <div class="uc-share-body"><section class="uc-share-art"><div class="uc-share-preview"><img alt="Artwork preview" width="400" height="400"></div><h3 class="uc-share-art-title"></h3><p class="uc-share-origin"></p><button type="button" class="uc-share-native" disabled>${icon}<span>Share image to apps</span></button><button type="button" class="uc-share-download" disabled>Download PNG</button><p class="uc-share-file-note">Preparing a shareable image…</p></section>
  <section class="uc-share-options"><div class="uc-share-link-area"><label for="uc-share-link">A link back to the artwork</label><div class="uc-share-link-row"><input id="uc-share-link" readonly><button type="button" class="uc-share-copy-link">Copy link</button></div></div>
  <div class="uc-share-social" aria-label="Share on social media"></div><p class="uc-share-network-note">Choose where to share. You review the post before publishing.</p>
  <label for="uc-share-caption">Make the message your own</label><textarea id="uc-share-caption" rows="3" maxlength="500"></textarea><div class="uc-share-caption-actions"><button type="button" class="uc-share-copy-caption">Copy caption + link</button><a class="uc-share-email">Email</a></div>
  <div class="uc-share-apps"><span>Sharing to</span><button type="button" data-share-app="instagram"><img src="/social/instagram.svg" width="19" height="19" alt="">Instagram</button><button type="button" data-share-app="tiktok"><img src="/social/tiktok.svg" width="19" height="19" alt="">TikTok</button><button type="button" class="uc-share-more">More apps</button></div>
  <div class="uc-share-app-help" hidden><p></p><a target="_blank" rel="noopener noreferrer">Open app website ↗</a></div>
  <details class="uc-share-publish"><summary>Create a public artwork link</summary><p>Only this finished image and its title will be uploaded. Anyone with the link can view and download it. Your project, layers and prompt stay private.</p><label for="uc-share-title">Artwork title</label><input id="uc-share-title" maxlength="100"><label class="uc-share-consent"><input type="checkbox">I want to make this image public and have permission to share it.</label><button type="button" class="uc-share-publish-button" disabled>Create public link</button><div class="uc-share-verification"></div><p>Free limited storage. Keep this browser’s saved removal key to delete your link later.</p></details>
  <details class="uc-share-owned"><summary>Your shared links</summary><p>Removal keys control who can remove your links. Keep your backup private; restore it here when changing devices.</p><div class="uc-share-owned-tools"><button type="button" class="uc-share-backup">Save removal keys</button><button type="button" class="uc-share-restore">Restore keys</button><input type="file" class="uc-share-key-file" accept="application/json,.json" aria-label="Restore removal keys from a JSON file" hidden></div><div class="uc-share-owned-list"></div></details>
  </section></div><p class="uc-share-status" role="status" aria-live="polite"></p>`;
  document.body.append(dialog);
  const q = <T extends HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
  const status = (text: string) => {
    if (!closed) q('.uc-share-status').textContent = text;
  };
  let closed = false,
    widget: string | undefined,
    service: Turnstile | undefined;
  let file: File | undefined, original: Blob | undefined, previewUrl: string | undefined;
  let url = options.kind === 'catalog' && options.url ? artworkUrl(options.url) : '';
  let remoteImage = options.imageUrl;
  let pendingPublication: OwnedShare | undefined;
  const removedKeys = new Set<string>();
  const source = options.kind === 'catalog' ? SITE : `${SITE}/create/`;
  const title = options.title.trim().slice(0, 120) || 'My clipart';
  const text = q<HTMLTextAreaElement>('#uc-share-caption');
  text.value = caption(options.kind, title);
  q('.uc-share-art-title').textContent = title;
  q('.uc-share-origin').textContent =
    options.kind === 'catalog'
      ? 'Found on UltraClipart'
      : 'Made with UltraClipart · private until you publish';
  q<HTMLInputElement>('#uc-share-title').value = title.slice(0, 100);
  q<HTMLDetailsElement>('.uc-share-publish').hidden = options.kind !== 'creation';
  q<HTMLImageElement>('.uc-share-preview img').alt = title;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    abort.abort();
    if (widget) service?.remove(widget);
    widget = undefined;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (dialog.open) dialog.close();
    dialog.remove();
    focus?.focus();
    if (activeClose === cleanup) activeClose = undefined;
  };
  activeClose = cleanup;
  q('.uc-share-close').addEventListener('click', cleanup);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    cleanup();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      const mouse = event as MouseEvent;
      if (
        mouse.clientX < box.left ||
        mouse.clientX > box.right ||
        mouse.clientY < box.top ||
        mouse.clientY > box.bottom
      )
        cleanup();
    }
  });
  dialog.showModal();
  async function copy(
    value: string,
    success: string,
    field?: HTMLInputElement | HTMLTextAreaElement,
  ) {
    try {
      await navigator.clipboard.writeText(value);
      status(success);
    } catch {
      field?.focus();
      field?.select();
      status('Clipboard access is unavailable. Select and copy the text shown here.');
    }
  }
  function updateLinks() {
    q<HTMLElement>('.uc-share-link-area').hidden = !url;
    q<HTMLInputElement>('#uc-share-link').value = url;
    const grid = q('.uc-share-social');
    grid.replaceChildren();
    if (url)
      for (const network of socialLinks(url, text.value, remoteImage)) {
        const link = document.createElement('a');
        link.href = network.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'uc-share-network';
        link.setAttribute('aria-label', `Share on ${network.name}`);
        const badge = document.createElement('span');
        badge.style.background = network.color;
        const logo = document.createElement('img');
        logo.src = `/social/${network.id}.svg`;
        logo.width = 23;
        logo.height = 23;
        logo.alt = '';
        badge.append(logo);
        const label = document.createElement('span');
        label.textContent = network.name;
        link.append(badge, label);
        grid.append(link);
      }
    q('.uc-share-network-note').textContent = url
      ? 'Some platforms only attach the link. Copy your caption to paste it into the post.'
      : 'Share the image directly, or create a public link below to use social posting buttons.';
    q<HTMLAnchorElement>('.uc-share-email').href =
      `mailto:?${new URLSearchParams({ subject: title + ' — UltraClipart', body: `${text.value}\n${url || source}` }).toString().replace(/\+/g, '%20')}`;
    q<HTMLButtonElement>('.uc-share-more').hidden = !navigator.share || !url;
  }
  updateLinks();
  text.addEventListener('input', updateLinks);
  q('.uc-share-copy-link').addEventListener('click', () => {
    if (url) void copy(url, 'Artwork link copied.', q<HTMLInputElement>('#uc-share-link'));
  });
  q('.uc-share-copy-caption').addEventListener(
    'click',
    () =>
      void copy(`${text.value}\n${url || source}`, 'Caption and UltraClipart link copied.', text),
  );
  q('.uc-share-download').addEventListener('click', () => {
    if (file) {
      save(file, file.name);
      status('PNG download prepared. Your caption is ready to copy.');
    }
  });
  q('.uc-share-native').addEventListener('click', () => {
    if (!file || !navigator.canShare?.({ files: [file] })) {
      status(
        'This browser cannot share image files directly. Download the PNG and copy the caption instead.',
      );
      return;
    }
    void navigator
      .share({ files: [file], title, text: `${text.value}\n${url || source}` })
      .then(() => status('Image handed to your selected app.'))
      .catch((error) =>
        status(
          error.name === 'AbortError'
            ? 'Sharing cancelled. Your artwork is unchanged.'
            : 'The app could not receive the file. Download the PNG and copy the caption instead.',
        ),
      );
  });
  q('.uc-share-more').addEventListener('click', () => {
    if (url && navigator.share)
      void navigator
        .share({ title, text: text.value, url })
        .then(() => status('Link handed to your selected app.'))
        .catch((error) =>
          status(
            error.name === 'AbortError'
              ? 'Sharing cancelled.'
              : 'Use Copy link to share this artwork.',
          ),
        );
  });
  dialog.querySelectorAll<HTMLButtonElement>('[data-share-app]').forEach((button) =>
    button.addEventListener('click', () => {
      const instagram = button.dataset.shareApp === 'instagram';
      const help = q('.uc-share-app-help');
      help.hidden = false;
      help.querySelector('p')!.textContent =
        `For ${instagram ? 'Instagram' : 'TikTok'}, use “Share image to apps” if it is available on your device. Otherwise download the PNG, copy the caption, then create a post in the app. Upload and publication remain under your control.`;
      const link = help.querySelector('a')!;
      link.href = instagram ? 'https://www.instagram.com/' : 'https://www.tiktok.com/';
      link.textContent = `Open ${instagram ? 'Instagram' : 'TikTok'} ↗`;
    }),
  );
  function renderOwned() {
    const container = q('.uc-share-owned-list');
    container.replaceChildren();
    const records = owned().filter((record) => !removedKeys.has(record.id));
    q<HTMLButtonElement>('.uc-share-backup').disabled = !records.length;
    if (!records.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No saved public links on this device yet.';
      container.append(empty);
    }
    for (const record of records) {
      const row = document.createElement('div');
      row.className = 'uc-share-owned-row';
      const link = document.createElement('a');
      try {
        link.href = artworkUrl(record.url);
      } catch {
        continue;
      }
      link.textContent = record.title;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove shared link: ${record.title}`);
      remove.addEventListener('click', async () => {
        if (remove.dataset.confirm !== 'yes') {
          remove.dataset.confirm = 'yes';
          remove.textContent = 'Confirm removal';
          return;
        }
        remove.disabled = true;
        try {
          const response = await fetch(`/api/share/${encodeURIComponent(record.id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${record.deleteToken}` },
            signal: abort.signal,
          });
          if (!response.ok && response.status !== 404)
            throw new Error('Removal failed. Try again shortly.');
          removedKeys.add(record.id);
          if (pendingPublication?.id === record.id) pendingPublication = undefined;
          let clearedLocalKey = true;
          try {
            localStorage.setItem(
              ownedKey,
              JSON.stringify(owned().filter((item) => item.id !== record.id)),
            );
          } catch {
            clearedLocalKey = false;
          }
          if (closed) return;
          if (url === record.url) {
            url = '';
            updateLinks();
            q<HTMLDetailsElement>('.uc-share-publish').hidden = options.kind !== 'creation';
            consent.checked = false;
            consent.disabled = false;
            publishButton.disabled = true;
            remoteImage = undefined;
            q('.uc-share-origin').textContent =
              'Made with UltraClipart · private until you publish';
          }
          renderOwned();
          status(
            clearedLocalKey
              ? response.status === 404
                ? 'This public link was already removed. Its saved key was cleared.'
                : 'Public link removed. Previously saved copies in other apps cannot be recalled.'
              : 'Public link removed. This browser could not clear its old saved key; the public image is no longer available.',
          );
        } catch (error) {
          status(error instanceof Error ? error.message : 'Removal failed.');
          remove.disabled = false;
        }
      });
      row.append(link, remove);
      container.append(row);
    }
  }
  renderOwned();
  q('.uc-share-backup').addEventListener('click', () => {
    const records = owned();
    if (!records.length) return;
    save(
      new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' }),
      'ultraclipart-share-removal-keys.json',
    );
    status(
      'Removal keys saved. Keep this file private; restoring it does not publish or remove any artwork.',
    );
  });
  const keyFile = q<HTMLInputElement>('.uc-share-key-file');
  q('.uc-share-restore').addEventListener('click', () => keyFile.click());
  keyFile.addEventListener('change', async () => {
    const selected = keyFile.files?.[0];
    keyFile.value = '';
    if (!selected) return;
    try {
      if (selected.size > 1_000_000)
        throw new Error('Removal-key files must be smaller than 1 MB.');
      const parsed: unknown = JSON.parse(await selected.text());
      const records: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      if (!records.length || records.length > 1000 || !records.every(validOwned))
        throw new Error(
          'This is not a valid UltraClipart removal-key backup. Your saved keys are unchanged.',
        );
      const merged = new Map(owned().map((record) => [record.id, record]));
      for (const record of records as OwnedShare[]) merged.set(record.id, record);
      if (merged.size > 1000)
        throw new Error('This device already has too many saved removal keys.');
      localStorage.setItem(ownedKey, JSON.stringify([...merged.values()]));
      for (const record of records as OwnedShare[]) removedKeys.delete(record.id);
      if (closed) return;
      renderOwned();
      status(
        `${records.length} removal ${records.length === 1 ? 'key restored' : 'keys restored'}. No artwork was uploaded or removed.`,
      );
    } catch (error) {
      status(
        error instanceof Error
          ? error.message
          : 'The backup could not be restored. Keep your original key file.',
      );
    }
  });
  const publishButton = q<HTMLButtonElement>('.uc-share-publish-button');
  const consent = q<HTMLInputElement>('.uc-share-consent input');
  consent.addEventListener('change', () => {
    publishButton.disabled = !consent.checked || !original;
  });
  publishButton.addEventListener('click', async () => {
    if (!consent.checked || !original) return;
    publishButton.disabled = true;
    consent.disabled = true;
    status('Preparing your public image and verification…');
    try {
      const imageData = await publicImage(original);
      const response = await fetch('/api/share/session', {
        credentials: 'same-origin',
        signal: abort.signal,
      });
      const session = await response.json();
      if (
        !response.ok ||
        !session.enabled ||
        (!pendingPublication && (session.remaining < 1 || session.globalRemaining < 1))
      )
        throw new Error(
          'Public sharing capacity is unavailable right now. You can still download or share the image directly.',
        );
      service = await loadTurnstile();
      if (closed) return;
      if (widget) service.remove(widget);
      widget = service.render(q('.uc-share-verification'), {
        sitekey: session.sitekey,
        action: 'share',
        theme: 'light',
        callback: async (turnstileToken: string) => {
          if (closed) return;
          status('Creating your public artwork link…');
          try {
            if (!pendingPublication) {
              const id = crypto.randomUUID().replaceAll('-', '');
              const bytes = crypto.getRandomValues(new Uint8Array(32));
              const deleteToken = btoa(String.fromCharCode(...bytes))
                .replaceAll('+', '-')
                .replaceAll('/', '_')
                .replaceAll('=', '');
              pendingPublication = {
                id,
                deleteToken,
                title: q<HTMLInputElement>('#uc-share-title').value.trim() || title,
                url: `${SITE}/share/${id}/`,
              };
            }
            const record = pendingPublication;
            try {
              localStorage.setItem(
                ownedKey,
                JSON.stringify([record, ...owned().filter((item) => item.id !== record.id)]),
              );
            } catch {
              save(
                new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }),
                'ultraclipart-share-removal-key.json',
              );
            }
            renderOwned();
            const result = await fetch('/api/share/create', {
              method: 'POST',
              credentials: 'same-origin',
              // An explicitly authorized publish must retain its removal key even if the dialog closes.
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken },
              body: JSON.stringify({
                id: record.id,
                deleteToken: record.deleteToken,
                title: record.title,
                imageData,
                turnstileToken,
              }),
            });
            const body = await result.json();
            if (!result.ok)
              throw new Error(
                result.status === 429
                  ? 'The free sharing limit has been reached. Please try after the daily reset.'
                  : 'The public link could not be created. Please try again.',
              );
            if (
              body.id !== record.id ||
              body.deleteToken !== record.deleteToken ||
              body.url !== record.url
            )
              throw new Error(
                'The public-link response could not be verified. Your removal key is saved; check Your shared links before trying again.',
              );
            url = artworkUrl(body.url);
            remoteImage = body.imageUrl;
            if (closed) return;
            updateLinks();
            renderOwned();
            q<HTMLDetailsElement>('.uc-share-publish').hidden = true;
            q('.uc-share-origin').textContent = 'Made with UltraClipart · public share link';
            status(
              'Public link created. Copy it or choose a social app. Keep your saved removal key on this device.',
            );
          } catch (error) {
            status(
              error instanceof TypeError && pendingPublication
                ? 'The response was interrupted. Your removal key is saved under Your shared links. Retry safely or remove that link.'
                : error instanceof Error
                  ? error.message
                  : 'Public sharing failed.',
            );
            publishButton.disabled = false;
            consent.disabled = false;
          } finally {
            if (widget) {
              service?.remove(widget);
              widget = undefined;
            }
          }
        },
        'error-callback': () => {
          status('Verification failed. Try again or share the PNG directly.');
          publishButton.disabled = false;
          consent.disabled = false;
        },
        'expired-callback': () => {
          status('Verification expired. Please try again.');
          publishButton.disabled = false;
          consent.disabled = false;
        },
      });
    } catch (error) {
      status(error instanceof Error ? error.message : 'Public sharing is unavailable.');
      publishButton.disabled = false;
      consent.disabled = false;
    }
  });
  try {
    original = await imageFile(options, abort.signal);
    if (closed) return;
    const canvas = await canvasFor(original);
    file = new File(
      [await encode(canvas, 'image/png')],
      'ultraclipart-' +
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 60) +
        '.png',
      { type: 'image/png' },
    );
    if (closed) return;
    previewUrl = URL.createObjectURL(file);
    q<HTMLImageElement>('.uc-share-preview img').src = previewUrl;
    q<HTMLButtonElement>('.uc-share-download').disabled = false;
    const canShare = !!navigator.canShare?.({ files: [file] });
    q<HTMLButtonElement>('.uc-share-native').disabled = !canShare;
    q('.uc-share-file-note').textContent =
      `${canvas.width} × ${canvas.height} PNG · ${canShare ? 'Ready for your apps' : 'Download and post in your favorite app'}`;
    publishButton.disabled = !consent.checked;
  } catch (error) {
    q('.uc-share-file-note').textContent = 'Image preparation unavailable';
    status(error instanceof Error ? error.message : 'Could not prepare the image.');
  }
}
