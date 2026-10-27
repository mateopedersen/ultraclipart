import { nextPaint } from '../lib/initial-paint';
let pending: Promise<void> | undefined;
/** Display the compact screen copy before competing for bandwidth with the
 * much larger editing original. A failed/slow preview never blocks recovery.
 */
export function editorPreviewReady() {
  return (pending ??= (async () => {
    const image = document.querySelector<SVGImageElement>('[data-editor-preview] image');
    const src = image?.getAttribute('href');
    if (src) {
      const probe = new Image();
      probe.src = src;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          probe.decode().catch(() => {}),
          new Promise<void>((resolve) => {
            timeout = setTimeout(resolve, 2500);
          }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
    }
    // The consent UI is real initial content too. Its shared, bounded startup
    // promise prevents a late font/notice repaint being held behind the original.
    await window.__ucCookieNoticeReady;
    await nextPaint();
  })());
}
