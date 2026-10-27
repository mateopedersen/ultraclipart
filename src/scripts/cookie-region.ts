declare global {
  interface Window {
    __ucCookieRegion?: Promise<boolean>;
    __ucCookieNoticeReady?: Promise<void>;
  }
}
/** One page-owned request, shared by the small head bootstrap and the notice UI.
 * Unknown or failed region checks retain the existing conservative notice policy.
 */
export function cookieRegion(): Promise<boolean> {
  return (window.__ucCookieRegion ??= (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch('/api/cookie-region.json', {
        priority: 'high',
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
        throw new Error('Region unavailable');
      const result: unknown = await response.json();
      return (
        !result ||
        typeof result !== 'object' ||
        (result as { showNotice?: unknown }).showNotice !== false
      );
    } catch {
      return true;
    } finally {
      window.clearTimeout(timer);
    }
  })());
}
