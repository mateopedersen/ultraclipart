import { afterInitialPaint } from '../lib/initial-paint';
import { editorPreviewReady } from './preview-ready';
let loading: Promise<void> | undefined;
export function ensureEditors() {
  return (loading ??= (async () => {
    if (document.querySelector('[data-editor-preview]')) await editorPreviewReady();
    else await afterInitialPaint();
    const { initializeEditors } = await import('./editor');
    document.querySelector('[data-editor-load-retry]')?.remove();
    initializeEditors();
    const root = document.querySelector<HTMLElement>('.uc-editor');
    if (!root || root.getAttribute('aria-busy') !== 'true') return;
    await new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        if (root.getAttribute('aria-busy') !== 'true') {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(root, { attributes: true, attributeFilter: ['aria-busy'] });
    });
  })().catch((error) => {
    loading = undefined;
    const status = document.querySelector<HTMLElement>('.uc-editor [data-status]');
    if (status)
      status.textContent =
        'The editing tools could not load. Reconnect and try opening the Studio again. Your saved work is unchanged.';
    if (status && !document.querySelector('[data-editor-load-retry]')) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'uc-primary';
      retry.dataset.editorLoadRetry = '';
      retry.textContent = 'Retry loading tools';
      retry.addEventListener('click', () => {
        retry.disabled = true;
        void ensureEditors()
          .catch(() => {})
          .finally(() => {
            retry.disabled = false;
          });
      });
      status.after(retry);
    }
    throw error;
  }));
}
export function bootstrapEditors() {
  const root = document.querySelector<HTMLElement>('.uc-editor');
  if (!root) return;
  const start = () => {
    void ensureEditors().catch(() => {});
  };
  const params = new URLSearchParams(location.search);
  const direct = [
    'import',
    'workspace',
    'editor-tool',
    'starter',
    'scene-view',
    'vector',
    'text-style',
    'studio-tool',
  ].some((key) => params.has(key));
  if (root.dataset.creator !== 'true' || direct || !('IntersectionObserver' in window)) start();
  else {
    // The landing page can render before an offscreen Studio loads its tools.
    // Scrolling near the workspace prepares it before the controls are reached.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(root);
  }
  document.addEventListener(
    'click',
    (event) => {
      const target = (event.target as Element)?.closest<HTMLButtonElement>(
        '[data-creator-template], [data-studio-scene]',
      );
      if (!target || root.getAttribute('aria-busy') !== 'true') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void ensureEditors()
        .then(() => {
          if (!root.querySelector('.uc-workspace')?.hasAttribute('inert')) target.click();
        })
        .catch(() => {});
    },
    true,
  );
}
