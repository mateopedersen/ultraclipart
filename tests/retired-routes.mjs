import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { retirementPolicy, createRetiredHandler } from '../scripts/retired-routes.mjs';
const topics = [
  ...JSON.parse(readFileSync(new URL('../data/topics.json', import.meta.url))).topics,
  ...JSON.parse(readFileSync(new URL('../data/extra-topics.json', import.meta.url))),
];
const art = JSON.parse(readFileSync(new URL('../data/art.json', import.meta.url)));
const matches = (pattern, path) =>
  new RegExp(
    '^' +
      pattern
        .split('*')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      '$',
  ).test(path);
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
  const active = await handler.fetch(new Request('https://ultraclipart.com/clipart/winter/'), env);
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

test('withdrawn artwork and media cannot reappear through cached public routes', async () => {
  const withdrawn = JSON.parse(
    readFileSync(new URL('../data/retired-artwork.json', import.meta.url)),
  );
  const ids = new Set(art.map((item) => item.id));
  assert.ok(withdrawn.artworkIds.every((id) => !ids.has(id)));
  const policy = retirementPolicy(topics, art, withdrawn);
  assert.ok(policy.routes.include.length + policy.routes.exclude.length <= 100);
  const handler = createRetiredHandler(policy.retired);
  for (const path of [
    ...withdrawn.artworkIds.flatMap((id) => [`/art/${id}/`, `/edit/${id}/`]),
    ...withdrawn.assetPaths,
  ]) {
    assert.ok(
      policy.routes.include.some((pattern) => matches(pattern, path)),
      path,
    );
    assert.ok(!policy.routes.exclude.some((pattern) => matches(pattern, path)), path);
    for (const suffix of ['', '?cached=1']) {
      const response = await handler.fetch(
        new Request(`https://ultraclipart.com${path}${suffix}`),
        { ASSETS: { fetch: async () => new Response('Current missing-page body') } },
      );
      assert.equal(response.status, 404, path);
    }
  }
  const republished = retirementPolicy(
    topics,
    [...art, { id: withdrawn.artworkIds[0], topic: 'winter' }],
    withdrawn,
  );
  assert.ok(!republished.retired.includes(`/art/${withdrawn.artworkIds[0]}/`));
});

test('every current artwork, editor and media URL remains static while withdrawals stay blocked', () => {
  const withdrawn = JSON.parse(
    readFileSync(new URL('../data/retired-artwork.json', import.meta.url)),
  );
  const guides = [
    '/guides/make-a-classroom-label/',
    '/guides/turn-clipart-into-a-coloring-activity/',
  ];
  const policy = retirementPolicy(topics, art, withdrawn, guides);
  const invokes = (path) =>
    policy.routes.include.some((pattern) => matches(pattern, path)) &&
    !policy.routes.exclude.some((pattern) => matches(pattern, path));
  assert.ok(policy.routes.include.length + policy.routes.exclude.length <= 100);
  for (const item of art)
    for (const path of [
      `/art/${item.id}/`,
      `/edit/${item.id}/`,
      item.pdf,
      item.webp,
      item.thumb,
    ].filter(Boolean))
      assert.equal(invokes(path), false, path);
  for (const path of guides) assert.equal(invokes(path), false, path);
  for (const id of withdrawn.artworkIds)
    for (const route of ['art', 'edit'])
      for (const suffix of ['', '/']) assert.equal(invokes(`/${route}/${id}${suffix}`), true);
});

test('adding subjects keeps withdrawals protected without routing current pages through Functions', () => {
  const withdrawn = JSON.parse(
      readFileSync(new URL('../data/retired-artwork.json', import.meta.url)),
    ),
    missing = topics.filter((topic) => !art.some((item) => item.topic === topic.slug));
  // These intermediate growth states exceeded 100 rules with separate folder
  // covers. Safe artwork patterns must protect the same static/withdrawn paths.
  for (const count of [6, 20, 38, 65, missing.length]) {
    const future = missing.slice(0, count).map((topic) => ({
      id: `${topic.slug}-future-artwork`,
      topic: topic.slug,
    }));
    const policy = retirementPolicy(topics, [...art, ...future], withdrawn);
    assert.ok(policy.routes.include.length + policy.routes.exclude.length <= 100);
    const invokes = (path) =>
      policy.routes.include.some((pattern) => matches(pattern, path)) &&
      !policy.routes.exclude.some((pattern) => matches(pattern, path));
    for (const item of [...art, ...future])
      for (const path of [`/clipart/${item.topic}/`, `/art/${item.id}/`, `/edit/${item.id}/`])
        assert.equal(invokes(path), false, path);
    for (const path of policy.retired) assert.equal(invokes(path), true, path);
  }
});

test('retirement rules reserve space for AI and public-sharing endpoints', () => {
  const withdrawn = JSON.parse(
    readFileSync(new URL('../data/retired-artwork.json', import.meta.url)),
  );
  const staticPaths = art.flatMap((item) => [
    `/art/${item.id}/index.html`,
    `/edit/${item.id}/index.html`,
    `/clipart/${item.topic}/index.html`,
  ]);
  const policy = retirementPolicy(topics, art, withdrawn, staticPaths, 98);
  assert.ok(policy.routes.include.length + policy.routes.exclude.length <= 98);
  const invokes = (path) =>
    policy.routes.include.some((pattern) => matches(pattern, path)) &&
    !policy.routes.exclude.some((pattern) => matches(pattern, path));
  for (const item of art) {
    assert.equal(invokes(`/art/${item.id}/`), false);
    assert.equal(invokes(`/edit/${item.id}/`), false);
  }
  for (const path of policy.retired) assert.equal(invokes(path), true, path);
});
