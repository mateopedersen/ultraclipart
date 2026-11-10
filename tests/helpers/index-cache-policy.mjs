import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export function declaredIndexCacheControl(headers, pathname) {
  assert.match(pathname, /^\/[a-z0-9-]+\.json$/);
  let route = '';
  const values = [];
  for (const line of headers.split(/\r?\n/)) {
    if (/^\S/.test(line)) route = line.trim();
    else if (route === pathname) {
      const match = line.match(/^\s+Cache-Control:\s*(.+?)\s*$/i);
      if (match) values.push(match[1]);
      assert.ok(!/^\s*!\s*Cache-Control\s*$/i.test(line), 'Index cache policy must not be unset');
    }
  }
  assert.equal(values.length, 1, 'Require one explicit built index cache rule');
  assert.match(values[0], /^no-store$/i, 'The deployed index must remain no-store');
  return values[0];
}

export function verifyIndexCachePolicy({ base, pathname, cacheControl, builtHeaders }) {
  const target = new URL(base);
  assert.ok(['http:', 'https:'].includes(target.protocol));
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname);
  assert.equal(typeof cacheControl, 'string', 'Require an actual HTTP cache header');
  if (local) {
    // Astro serves prerendered JSON without applying Cloudflare's _headers.
    // Verify the actual built deployment rule, and separately reject a stale
    // cache lifetime in the local server. A live origin must send no-store.
    const deployed = declaredIndexCacheControl(builtHeaders, pathname);
    assert.match(cacheControl, /^(?:no-cache|no-store)$/i);
    return { server: 'local-static-preview', http: cacheControl, deployed };
  }
  assert.match(cacheControl, /(?:^|,)\s*no-store\s*(?:,|$)/i);
  return { server: 'live-origin', http: cacheControl };
}

export async function assertIndexCachePolicy(response, base, pathname) {
  const target = new URL(base);
  const actual = new URL(response.url());
  assert.equal(actual.origin, target.origin, 'Require the requested server origin');
  assert.equal(actual.pathname, pathname, 'Require the requested index path');
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname);
  return verifyIndexCachePolicy({
    base,
    pathname,
    cacheControl: response.headers()['cache-control'],
    builtHeaders: local ? await readFile('dist/_headers', 'utf8') : undefined,
  });
}
