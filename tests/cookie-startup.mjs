import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { cookieStartupScript } from '../scripts/cookie-startup.mjs';
import { COOKIE_POLICY_VERSION } from '../src/lib/cookie-policy.ts';

function environment(cookie = '', response = false) {
  const calls = [];
  const window = { setTimeout, clearTimeout };
  const context = vm.createContext({
    window,
    document: { cookie },
    AbortController,
    Date,
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (response instanceof Error) throw response;
      return new Response(JSON.stringify({ showNotice: response }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  return { calls, window, run: () => vm.runInContext(cookieStartupScript, context) };
}
test('head bootstrap skips the regional request for a current valid choice', () => {
  const value = encodeURIComponent(
    JSON.stringify({ version: COOKIE_POLICY_VERSION, choice: 'necessary', at: Date.now() }),
  );
  const env = environment(`uc_cookie_choice=${value}`);
  env.run();
  assert.equal(env.calls.length, 0);
});
test('head bootstrap shares one bounded, credential-free regional request', async () => {
  const env = environment();
  env.run();
  env.run();
  assert.equal(await env.window.__ucCookieRegion, false);
  assert.equal(env.calls.length, 1);
  assert.equal(env.calls[0].url, '/api/cookie-region.json');
  assert.equal(env.calls[0].options.credentials, 'omit');
  assert.equal(env.calls[0].options.cache, 'no-store');
  assert.equal(env.calls[0].options.redirect, 'error');
  assert.ok(env.calls[0].options.signal instanceof AbortSignal);
});
test('malformed and expired choices retain the actual regional decision', async () => {
  for (const cookie of [
    'uc_cookie_choice=%',
    'uc_cookie_choice=' +
      encodeURIComponent(
        JSON.stringify({ version: COOKIE_POLICY_VERSION, choice: 'accepted', at: 1 }),
      ),
  ]) {
    const env = environment(cookie, true);
    env.run();
    assert.equal(await env.window.__ucCookieRegion, true);
    assert.equal(env.calls.length, 1);
  }
});
test('failed early requests resolve to the existing notice policy without unhandled rejection', async () => {
  const env = environment('', new Error('offline'));
  env.run();
  assert.equal(await env.window.__ucCookieRegion, true);
  assert.equal(env.calls.length, 1);
});
