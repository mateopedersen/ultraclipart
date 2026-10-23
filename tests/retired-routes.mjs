import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { retirementPolicy, createRetiredHandler } from '../scripts/retired-routes.mjs';
const topics = JSON.parse(readFileSync(new URL('../data/topics.json', import.meta.url))).topics;
const art = JSON.parse(readFileSync(new URL('../data/art.json', import.meta.url)));
test('only unavailable subjects get an edge policy within the Pages Free route limit', () => {
  for (let count = 0; count <= topics.length; count++) {
    const available = topics.slice(0, count).map((topic) => ({ topic: topic.slug }));
    const policy = retirementPolicy(topics, available);
    if (count === topics.length) assert.equal(policy, null);
    else {
      assert.ok(policy.routes.include.length + policy.routes.exclude.length <= 100);
      assert.ok(policy.retired.includes(`/clipart/${topics[count].slug}/`));
      for (const topic of topics.slice(0, count))
        assert.ok(!policy.retired.includes(`/clipart/${topic.slug}/`));
    }
  }
});
test('retired routes ignore stale cached content and return real 404 with current page and headers', async () => {
  const policy = retirementPolicy(topics, art);
  const retired = policy.retired.find((route) => route.startsWith('/clipart/')).replace(/\/$/, '');
  const handler = createRetiredHandler(policy.retired, {
    'Content-Security-Policy': "default-src 'self'",
  });
  const urls = [];
  const env = {
    ASSETS: {
      async fetch(request) {
        urls.push(request.url);
        return new Response(
          new URL(request.url).pathname === '/404.html'
            ? 'current missing page'
            : 'old cached subject',
          { status: 200 },
        );
      },
    },
  };
  for (const suffix of ['/', '/?q=retired', '']) {
    const response = await handler.fetch(
      new Request(`https://ultraclipart.com${retired}${suffix}`),
      env,
    );
    assert.equal(response.status, 404);
    assert.equal(await response.text(), 'current missing page');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
    assert.equal(response.headers.get('Content-Security-Policy'), "default-src 'self'");
  }
  assert.ok(urls.every((url) => url === 'https://ultraclipart.com/404.html'));
  const head = await handler.fetch(
    new Request(`https://ultraclipart.com${retired}/`, { method: 'HEAD' }),
    env,
  );
  assert.equal(head.status, 404);
  assert.equal(await head.text(), '');
  const post = await handler.fetch(
    new Request(`https://ultraclipart.com${retired}/`, { method: 'POST' }),
    env,
  );
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('Allow'), 'GET, HEAD');
  const active = await handler.fetch(new Request('https://ultraclipart.com/clipart/pumpkin/'), env);
  assert.equal(active.status, 200);
  const unavailable = await handler.fetch(new Request(`https://ultraclipart.com${retired}/`), {
    ASSETS: {
      fetch: () => {
        throw Error('offline');
      },
    },
  });
  assert.equal(unavailable.status, 503);
});
