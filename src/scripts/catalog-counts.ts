import { catalogCountValue, formatCatalogCount, isCatalogCounts } from '../lib/catalog-counts';
import type { CatalogCountKind, CatalogCountUnit } from '../lib/catalog-counts';

const elements = [...document.querySelectorAll<HTMLElement>('[data-catalog-count]')];
if (elements.length) {
  let pending = false;
  let lastRequest = 0;
  let controller: AbortController | undefined;

  async function refresh() {
    if (pending || document.hidden || Date.now() - lastRequest < 5_000) return;
    pending = true;
    lastRequest = Date.now();
    controller = new AbortController();
    const active = controller;
    const timeout = window.setTimeout(() => active.abort(), 8_000);
    try {
      const response = await fetch('/catalog-stats.json', {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: active.signal,
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
        return;
      const counts: unknown = await response.json();
      if (!isCatalogCounts(counts) || active.signal.aborted) return;
      let changed = false;
      for (const element of elements) {
        if (!element.isConnected || element.dataset.catalogVersion === counts.version) continue;
        const kind = element.dataset.catalogCount as CatalogCountKind;
        const value = catalogCountValue(counts, kind, element.dataset.catalogKey);
        const unit = element.dataset.catalogUnit as CatalogCountUnit | undefined;
        const text = formatCatalogCount(value, unit);
        if (element.textContent !== text) {
          element.textContent = text;
          changed = true;
        }
        element.dataset.catalogVersion = counts.version;
        // Keep the directory's count-based sorting aligned with its visible labels.
        const subject = element.closest<HTMLElement>('.discovery-subject');
        if (kind === 'topic' && subject) subject.dataset.count = String(value);
      }
      if (changed)
        document.dispatchEvent(
          new CustomEvent('ultraclipart:catalog-counts', {
            detail: { version: counts.version },
          }),
        );
    } catch {
      // The complete build-time counts remain usable offline and without JavaScript.
    } finally {
      window.clearTimeout(timeout);
      if (controller === active) controller = undefined;
      pending = false;
    }
  }

  void refresh();
  // Recheck visible pages after a publication; hidden tabs send no polling requests.
  window.setInterval(() => void refresh(), 30_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void refresh();
  });
  window.addEventListener('focus', () => void refresh());
  window.addEventListener('pageshow', () => void refresh());
  window.addEventListener('pagehide', () => controller?.abort());
}
