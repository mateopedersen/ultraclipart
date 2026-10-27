import assert from 'node:assert/strict';

/** Local static previews lack the production origin's R2 CORS permission.
 * Preserve real upstream bytes and headers, adding only the loopback origin for
 * this explicitly enabled test fixture. Live tests always use the actual CORS.
 */
export async function bridgeLocalCdn(context, base) {
  if (process.env.LOCAL_CDN_BRIDGE !== '1') return false;
  const origin = new URL(base).origin;
  assert.match(origin, /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/);
  await context.route('https://assets.ultraclipart.com/**', async (route) => {
    assert.equal(route.request().method(), 'GET');
    try {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), 'access-control-allow-origin': origin },
      });
    } catch (error) {
      // Navigation and the editor's deliberate abort test can cancel an
      // in-flight request before the upstream reply. Real fetch failures fail.
      if (
        !/Route is already handled|Target page, context or browser has been closed/.test(
          String(error),
        )
      )
        throw error;
    }
  });
  return true;
}
