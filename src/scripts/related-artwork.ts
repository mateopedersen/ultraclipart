import { FAVORITES_KEY, parseFavoriteIds, toggleStoredFavorite } from '../lib/favorites-storage';
import type { Mode, RelatedCard, Snapshot } from '../lib/related/engine';
export function initRelatedArtwork() {
  const root = document.querySelector<HTMLElement>('[data-related-root]');
  if (!root || root.dataset.ready) return;
  const json = root.querySelector('[data-related-snapshot]');
  if (!json) return;
  let snapshot: Snapshot;
  try {
    snapshot = JSON.parse(json.textContent ?? '');
  } catch {
    return;
  }
  const sample = root.querySelector<HTMLElement>('.related-card')?.cloneNode(true) as
    HTMLElement | undefined;
  if (!sample) return;
  root.dataset.ready = 'true';
  const find = <T extends HTMLElement = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const status = find('[data-related-status]'),
    more = find<HTMLButtonElement>('[data-related-more]');
  const controls = find('[data-related-controls]'),
    results = find('[data-related-results]');
  const refresh = find<HTMLAnchorElement>('[data-related-refresh]');
  const sentinel = find('[data-related-sentinel]'),
    scrollHint = find('[data-related-scroll-hint]');
  let mode: Mode = 'best';
  function initialCount() {
    const mobile = matchMedia('(max-width: 900px)').matches;
    return mode === 'best'
      ? Math.min(snapshot.alternatives.length, mobile ? 4 : 8) +
          Math.min(snapshot.companions.length, mobile ? 2 : 4) +
          Math.min(
            snapshot.collection.length,
            Math.max(
              0,
              (mobile ? 6 : 12) -
                Math.min(snapshot.alternatives.length, mobile ? 4 : 8) -
                Math.min(snapshot.companions.length, mobile ? 2 : 4),
            ),
          )
      : mobile
        ? 6
        : 12;
  }
  let count = initialCount();
  let stale = false,
    request: Promise<boolean> | undefined;
  const displayed = new Set<string>(),
    failed = new Set<string>(),
    impressions = new Set<string>();
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  const emit = (event: string, extra: Record<string, unknown> = {}) => {
    // Integration hook only: no collector, cookie, fingerprint or third-party request.
    window.dispatchEvent(
      new CustomEvent('ultraclipart:related', {
        detail: {
          event,
          sourceId: snapshot.sourceId,
          mode,
          algorithm: snapshot.algorithm,
          ...extra,
        },
      }),
    );
  };
  const observer =
    typeof IntersectionObserver === 'undefined'
      ? undefined
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const target = entry.target as HTMLElement,
                id = target.dataset.relatedId!;
              if (
                entry.isIntersecting &&
                entry.intersectionRatio >= 0.5 &&
                !document.hidden &&
                !impressions.has(id) &&
                !timers.has(target)
              ) {
                timers.set(
                  target,
                  setTimeout(() => {
                    timers.delete(target);
                    if (
                      !target.isConnected ||
                      target.hidden ||
                      document.hidden ||
                      failed.has(id) ||
                      stale ||
                      impressions.has(id)
                    )
                      return;
                    impressions.add(id);
                    emit('impression', {
                      artworkId: id,
                      group: target.dataset.relatedGroup,
                      reason: target.dataset.relatedReason,
                    });
                  }, 1000),
                );
              } else {
                clearTimeout(timers.get(target));
                timers.delete(target);
              }
            }
          },
          { threshold: [0, 0.5, 1] },
        );
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    }
  });
  function syncFavorites() {
    let favorites: string[] = [];
    try {
      favorites = parseFavoriteIds(localStorage.getItem(FAVORITES_KEY));
    } catch {
      /* report on write; no storage permission required to browse */
    }
    root!.querySelectorAll<HTMLButtonElement>('[data-related-favorite]').forEach((button) => {
      const saved = favorites.includes(
        button.closest<HTMLElement>('[data-related-id]')!.dataset.relatedId!,
      );
      button.hidden = false;
      button.setAttribute('aria-pressed', String(saved));
      const title = button
        .closest('.related-card')!
        .querySelector('.related-card-title')!.textContent;
      button.setAttribute(
        'aria-label',
        `${saved ? 'Remove' : 'Save'} ${title} ${saved ? 'from' : 'to'} favorites`,
      );
    });
  }
  function imageError(card: HTMLElement) {
    failed.add(card.dataset.relatedId!);
    card.querySelector('img')!.hidden = true;
    card.querySelector<HTMLElement>('.related-image-error')!.hidden = false;
    card
      .querySelectorAll<HTMLElement>('[data-related-download]')
      .forEach((link) => (link.hidden = true));
    observer?.unobserve(card);
    emit('thumbnail_error', { artworkId: card.dataset.relatedId });
  }
  function watch(card: HTMLElement) {
    const img = card.querySelector('img')!;
    img.addEventListener('error', () => imageError(card), { once: true });
    if (img.complete && img.naturalWidth === 0) imageError(card);
    observer?.observe(card);
  }
  function createCard(data: RelatedCard) {
    const node = sample!.cloneNode(true) as HTMLElement;
    node.dataset.relatedId = data.id;
    node.dataset.relatedGroup = data.group;
    node.dataset.relatedReason = data.reasonCode;
    node
      .querySelectorAll<HTMLAnchorElement>('[data-related-detail]')
      .forEach((link) => (link.href = data.href));
    node.querySelector('.related-card-title')!.textContent = data.title;
    node.querySelector('.related-reason')!.textContent = data.reason;
    const image = node.querySelector('img')!;
    image.src = data.thumb;
    if (data.thumbSrcSet) image.srcset = data.thumbSrcSet;
    else image.removeAttribute('srcset');
    image.alt = data.alt;
    image.title = data.title;
    node.querySelectorAll<HTMLAnchorElement>('[data-related-download]').forEach((link) => {
      const format = link.dataset.relatedDownload as 'webp' | 'pdf',
        url = data[format];
      link.hidden = !url;
      if (url) link.href = url;
      else link.removeAttribute('href');
      link.download = `${data.id}.${format}`;
      link.dataset.downloadOpen = data.id;
      link.dataset.downloadFormat = format;
      link.setAttribute('aria-expanded', 'false');
      link.setAttribute(
        'aria-label',
        `Download ${format === 'webp' ? 'Image' : 'PDF'}: ${data.title}`,
      );
    });
    if (failed.has(data.id)) imageError(node);
    return node;
  }
  function list() {
    if (mode === 'collection') return snapshot.collection;
    if (mode === 'subject') return snapshot.alternatives;
    if (mode === 'companions') return snapshot.companions;
    if (mode === 'monochrome') return snapshot.alternatives.filter((card) => card.monochrome);
    const small = matchMedia('(max-width: 900px)').matches,
      a = small ? 4 : 8,
      c = small ? 2 : 4,
      collectionCount = Math.min(
        snapshot.collection.length,
        Math.max(
          0,
          (small ? 6 : 12) -
            Math.min(a, snapshot.alternatives.length) -
            Math.min(c, snapshot.companions.length),
        ),
      );
    return [
      ...snapshot.alternatives.slice(0, a),
      ...snapshot.companions.slice(0, c),
      ...snapshot.collection.slice(0, collectionCount),
      ...snapshot.alternatives.slice(a),
      ...snapshot.companions.slice(c),
      ...snapshot.collection.slice(collectionCount),
    ];
  }
  function render(append = false, focusNew = false) {
    if (stale) return;
    const all = list(),
      visible = all.slice(0, count);
    const groups = [
      find('[data-related-alternatives]'),
      find('[data-related-companions]'),
      find('[data-related-collection]'),
    ];
    if (!append) {
      observer?.disconnect();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      displayed.clear();
      for (const group of groups) group.querySelector('.related-grid')!.replaceChildren();
    }
    const newlyAdded: HTMLElement[] = [];
    for (const card of visible) {
      if (displayed.has(card.id)) continue;
      const node = createCard(card),
        group = groups[card.group === 'alternatives' ? 0 : card.group === 'companions' ? 1 : 2];
      group.querySelector('.related-grid')!.append(node);
      displayed.add(card.id);
      watch(node);
      newlyAdded.push(node);
    }
    groups.forEach((group) => {
      const amount = group.querySelectorAll('.related-card').length;
      group.hidden = !amount;
      group.dataset.count = String(amount);
    });
    more.hidden = visible.length >= all.length;
    scrollHint.hidden = more.hidden || !scrollObserver;
    status.textContent = `${visible.length} relevant ${visible.length === 1 ? 'design' : 'designs'} shown${mode === 'monochrome' ? ' · black & white' : ''}.`;
    syncFavorites();
    if (append && more.hidden && focusNew)
      newlyAdded[0]?.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true });
  }
  // The sentinel follows the cards, so discovery progresses with the reader.
  // A fresh downward scroll arms each batch; no runaway loading or focus theft.
  let autoArmed = false,
    lastScrollY = window.scrollY,
    scrollFrame = 0;
  const nearEnd = () => {
    const box = sentinel.getBoundingClientRect();
    return box.top <= window.innerHeight + 320 && box.bottom >= 0;
  };
  async function loadMore(automatic = false) {
    if (
      stale ||
      more.hidden ||
      results.hidden ||
      document.hidden ||
      root!.getAttribute('aria-busy') === 'true'
    )
      return;
    // Keep the manual control stable for keyboard users and pointer activation.
    // Automatic discovery resumes when the reader leaves that control.
    if (
      automatic &&
      (more === document.activeElement ||
        (matchMedia('(hover: hover)').matches && more.matches(':hover')))
    )
      return;
    if (automatic && (!autoArmed || !nearEnd())) return;
    autoArmed = false;
    root!.setAttribute('aria-busy', 'true');
    more.disabled = true;
    try {
      if (!(await ensureCurrent())) return;
      count += matchMedia('(max-width: 900px)').matches ? 4 : 8;
      render(true, !automatic);
      emit('show_more', { displayed: displayed.size, trigger: automatic ? 'scroll' : 'button' });
    } finally {
      more.disabled = false;
      root!.removeAttribute('aria-busy');
    }
  }
  const scrollObserver =
    typeof IntersectionObserver === 'undefined'
      ? undefined
      : new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) void loadMore(true);
          },
          { rootMargin: '0px 0px 320px 0px' },
        );
  scrollObserver?.observe(sentinel);
  if (scrollObserver)
    window.addEventListener(
      'scroll',
      () => {
        if (window.scrollY > lastScrollY) autoArmed = true;
        lastScrollY = window.scrollY;
        if (!scrollFrame)
          scrollFrame = requestAnimationFrame(() => {
            scrollFrame = 0;
            if (autoArmed && nearEnd()) void loadMore(true);
          });
      },
      { passive: true },
    );
  async function ensureCurrent(): Promise<boolean> {
    if (stale) return false;
    if (request) return request;
    request = (async () => {
      try {
        const response = await fetch('/related-release.json', {
          cache: 'no-store',
          credentials: 'omit',
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error('Unavailable');
        const data = await response.json();
        if (data.version !== snapshot.version) {
          stale = true;
          results.hidden = true;
          controls.hidden = true;
          more.hidden = true;
          refresh.hidden = false;
          observer?.disconnect();
          scrollObserver?.disconnect();
          scrollHint.hidden = true;
          status.textContent = 'The collection has changed. Refresh to see current artwork.';
          return false;
        }
        results.hidden = false;
        return true;
      } catch {
        results.hidden = true;
        scrollHint.hidden = true;
        more.hidden = true;
        observer?.disconnect();
        for (const timer of timers.values()) clearTimeout(timer);
        timers.clear();
        status.textContent =
          'Recommendations could not be refreshed. Check your connection and try again.';
        return false;
      } finally {
        request = undefined;
      }
    })();
    return request;
  }
  controls.hidden = false;
  render();
  // Revalidate once when opening an old tab, then before changing its result snapshot.
  void ensureCurrent();
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) void ensureCurrent();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === FAVORITES_KEY) syncFavorites();
  });
  root.addEventListener('click', async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const filter = target.closest<HTMLButtonElement>('[data-related-mode]');
    if (target.closest('[data-related-more]')) {
      event.preventDefault();
      await loadMore();
      return;
    }
    if (filter) {
      event.preventDefault();
      if (root.getAttribute('aria-busy') === 'true') return;
      root.setAttribute('aria-busy', 'true');
      const current = await ensureCurrent();
      root.removeAttribute('aria-busy');
      if (!current) return;
      if (filter) {
        mode = filter.dataset.relatedMode as Mode;
        count = initialCount();
        controls
          .querySelectorAll<HTMLButtonElement>('button')
          .forEach((b) => b.setAttribute('aria-pressed', String(b === filter)));
        render();
        emit('filter');
      }
      return;
    }
    const card = target.closest<HTMLElement>('[data-related-id]');
    if (!card) return;
    if (target.closest('[data-related-favorite]')) {
      try {
        const ids = toggleStoredFavorite(localStorage, card.dataset.relatedId!, {
          title: card.querySelector('.related-card-title')?.textContent?.trim(),
          thumb: card.querySelector('img')?.src,
        });
        syncFavorites();
        status.textContent = ids.includes(card.dataset.relatedId!)
          ? 'Saved to your favorites.'
          : 'Removed from your favorites.';
        emit('favorite', {
          artworkId: card.dataset.relatedId,
          saved: ids.includes(card.dataset.relatedId!),
        });
      } catch {
        status.textContent =
          'Favorites could not be saved in this browser. Your downloads still work.';
      }
    } else if (target.closest('[data-related-download]')) {
      emit('download_click', {
        artworkId: card.dataset.relatedId,
        format: target.closest<HTMLElement>('[data-related-download]')!.dataset.relatedDownload,
        group: card.dataset.relatedGroup,
      });
    } else if (target.closest('[data-related-detail]'))
      emit('artwork_click', {
        artworkId: card.dataset.relatedId,
        group: card.dataset.relatedGroup,
      });
  });
}
