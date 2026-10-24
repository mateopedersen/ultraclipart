import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import {
  handleShare,
  validateShare,
  validateWebP,
  insertShare,
  SHARE_LIMITS,
} from '../server/share/handler.mjs';

const origin = 'https://ultraclipart.com';
const image = await sharp({
  create: { width: 96, height: 80, channels: 4, background: '#27a5ddaa' },
})
  .webp()
  .toBuffer();
const input = {
  title: 'A little fox — Küçük tilki 🦊',
  imageData: image.toString('base64'),
  turnstileToken: 'verified',
};
function database() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(readFileSync('migrations/0003_public_shares.sql', 'utf8'));
  const prepare = (sql, values = []) => ({
    bind(...next) {
      return prepare(
        sql,
        next.map((value) => (value instanceof ArrayBuffer ? Buffer.from(value) : value)),
      );
    },
    async first() {
      return raw.prepare(sql).get(...values);
    },
    async run() {
      const result = raw.prepare(sql).run(...values);
      return { meta: { changes: Number(result.changes) } };
    },
  });
  return { raw, prepare };
}
async function setup(extra = {}) {
  const db = database();
  const env = {
    AI_DB: db,
    SHARE_ENABLED: 'true',
    AI_FREE_PLAN_CONFIRMED: 'true',
    AI_SESSION_SECRET: 's'.repeat(64),
    TURNSTILE_SECRET: 'secret-never-output',
    TURNSTILE_SITEKEY: 'sitekey',
    ...extra,
  };
  const response = await handleShare(
    new Request(origin + '/api/share/session', { headers: { 'CF-Connecting-IP': '192.0.2.50' } }),
    env,
  );
  const session = await response.json();
  const cookie = response.headers.get('set-cookie')?.split(';')[0] || '';
  const create = (value = input, overrides = {}) =>
    new Request(origin + '/api/share/create', {
      method: 'POST',
      headers: {
        Origin: origin,
        Cookie: cookie,
        'X-CSRF-Token': session.csrfToken || '',
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.0.2.50',
        ...overrides,
      },
      body: JSON.stringify(value),
    });
  return { env, db, session, cookie, response, create };
}
async function verified(
  callback,
  payload = { success: true, hostname: 'ultraclipart.com', action: 'share' },
) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(JSON.parse(options.body).secret, 'secret-never-output');
    return Response.json(payload);
  };
  try {
    return await callback();
  } finally {
    globalThis.fetch = original;
  }
}
const count = (db, where = '') =>
  db.raw.prepare(`SELECT COUNT(*) n FROM public_shares ${where}`).get().n;

test('session is same-origin, signed, private, HttpOnly and exposes immutable free limits only', async () => {
  const h = await setup({ MAX_PUBLIC_SHARES: '99999999', SHARE_MAX_BYTES: '9999999999' });
  assert.equal(h.response.status, 200);
  assert.match(
    h.response.headers.get('set-cookie'),
    /__Host-uc_share=.*Path=\/; Secure; HttpOnly; SameSite=Strict/,
  );
  assert.equal(h.session.remaining, 3);
  assert.equal(h.session.globalRemaining, 100);
  assert.equal(h.session.capacityRemainingBytes, 128 * 1024 * 1024);
  assert.deepEqual(h.session.limits, SHARE_LIMITS);
  assert.match(h.session.csrfToken, /^[a-f0-9]{64}$/);
  assert.match(h.response.headers.get('cache-control'), /no-store/);
  assert.equal(JSON.stringify(h.session).includes('secret-never-output'), false);
  assert.equal(
    (
      await handleShare(
        new Request(origin + '/api/share/session', {
          headers: { Origin: 'https://evil.example', 'CF-Connecting-IP': '192.0.2.50' },
        }),
        h.env,
      )
    ).status,
    403,
  );
  for (const missing of ['AI_DB', 'AI_SESSION_SECRET', 'TURNSTILE_SECRET', 'TURNSTILE_SITEKEY']) {
    const response = await handleShare(new Request(origin + '/api/share/session'), {
      ...h.env,
      [missing]: undefined,
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).enabled, false);
  }
  assert.equal((await setup({ AI_FREE_PLAN_CONFIRMED: 'false' })).response.status, 503);
  assert.equal((await setup({ SHARE_ENABLED: 'false' })).response.status, 503);
});

test('real browser-compatible lossy, alpha and lossless WebP pass; malformed, metadata and oversized inputs fail', async () => {
  assert.deepEqual(validateWebP(image), { width: 96, height: 80 });
  for (const webp of [
    await sharp({ create: { width: 24, height: 28, channels: 3, background: '#aaaaff' } })
      .webp()
      .toBuffer(),
    await sharp({ create: { width: 24, height: 28, channels: 4, background: '#aaaaffaa' } })
      .webp({ lossless: true })
      .toBuffer(),
  ])
    assert.deepEqual(validateWebP(webp), { width: 24, height: 28 });
  assert.equal(validateShare(input).title, input.title);
  const animatedFlag = Buffer.from(image);
  animatedFlag[20] |= 2;
  const badSize = Buffer.from(image);
  badSize.writeUInt32LE(0, 4);
  const impossibleDimensions = await sharp({
    create: { width: 2049, height: 1, channels: 3, background: '#ff0000' },
  })
    .webp()
    .toBuffer();
  const metadata = await sharp(image).withMetadata().webp().toBuffer();
  for (const bytes of [
    image.subarray(0, image.length - 3),
    badSize,
    animatedFlag,
    impossibleDimensions,
    metadata,
    Buffer.from('<svg onload="alert(1)"></svg>'),
  ])
    assert.throws(() => validateWebP(bytes));
  for (const bad of [
    { ...input, private: true },
    { ...input, title: '' },
    { ...input, title: 'x'.repeat(101) },
    { ...input, title: '\ud800' },
    { ...input, title: 'hello\u0000world' },
    { ...input, turnstileToken: '' },
    { ...input, imageData: 'data:image/webp;base64,' + input.imageData },
    { ...input, imageData: 'not base64' },
    { ...input, imageData: 'A'.repeat(524292) },
  ])
    assert.throws(() => validateShare(bad));
});

test('create requires origin, signed visitor, CSRF and action/hostname-verified Turnstile before writing', async () => {
  const h = await setup();
  for (const overrides of [
    { Origin: 'https://evil.example' },
    { Origin: '' },
    { Cookie: '' },
    { Cookie: h.cookie.slice(0, -1) + 'z' },
    { 'X-CSRF-Token': '' },
    { 'Sec-Fetch-Site': 'cross-site' },
  ])
    assert.equal((await handleShare(h.create(input, overrides), h.env)).status, 403);
  for (const bad of [
    { success: false },
    { success: true, hostname: 'evil.example', action: 'share' },
    { success: true, hostname: 'ultraclipart.com', action: 'clipart' },
  ])
    await verified(
      async () => assert.equal((await handleShare(h.create(), h.env)).status, 403),
      bad,
    );
  assert.equal(count(h.db), 0);
  await verified(async () => {
    const response = await handleShare(h.create(), h.env);
    assert.equal(response.status, 201);
    const value = await response.json();
    assert.match(value.id, /^[a-f0-9]{32}$/);
    assert.match(value.deleteToken, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(value.url, `${origin}/share/${value.id}/`);
    assert.equal(value.imageUrl, `${value.url}image.webp`);
    const row = h.db.raw.prepare('SELECT * FROM public_shares WHERE id=?').get(value.id);
    assert.equal(row.image_bytes, image.length);
    assert.equal(row.delete_hash.includes(value.deleteToken), false);
    assert.match(row.delete_hash, /^[a-f0-9]{64}$/);
    assert.match(row.visitor, /^[a-f0-9]{64}$/);
    assert.match(row.network, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(row).includes('192.0.2.50'), false);
  });
});

test('public HTML escapes titles and supplies actual OG image; image bytes match and all responses avoid retained caches', async () => {
  const h = await setup();
  const published = await verified(async () =>
    (
      await handleShare(h.create({ ...input, title: '<script>alert("x")</script> & title' }), h.env)
    ).json(),
  );
  const response = await handleShare(new Request(published.url), h.env);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; title'));
  assert.ok(html.includes(`<meta property="og:image" content="${published.imageUrl}">`));
  assert.ok(html.includes('summary_large_image'));
  const shareLinks = [...html.matchAll(/<a class="share-network" href="([^"]+)"/g)].map(
    (match) => new URL(match[1].replaceAll('&amp;', '&')),
  );
  assert.equal(shareLinks.length, 9);
  const pinterest = shareLinks.find((link) => link.hostname === 'www.pinterest.com');
  assert.equal(pinterest.searchParams.get('url'), published.url);
  assert.equal(pinterest.searchParams.get('media'), published.imageUrl);
  assert.equal(
    pinterest.searchParams.get('description'),
    'Made with UltraClipart — <script>alert("x")</script> & title',
  );
  assert.ok(
    html.includes(`id="shared-artwork-link" class="share-link" readonly value="${published.url}"`),
  );
  assert.equal(
    [...html.matchAll(/class="share-network"[^>]+rel="noopener noreferrer"/g)].length,
    9,
  );
  const imageSources = [...html.matchAll(/<img\b[^>]+src="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(imageSources.length, 11);
  for (const src of imageSources)
    assert.ok(
      src === '/logo.svg' || /^\/social\/[a-z-]+\.svg$/.test(src) || src === published.imageUrl,
    );
  assert.ok(html.includes('name="robots" content="noindex,follow"'));
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
  const media = await handleShare(new Request(published.imageUrl), h.env);
  assert.equal(media.headers.get('content-type'), 'image/webp');
  assert.equal(media.headers.get('x-content-type-options'), 'nosniff');
  assert.match(media.headers.get('cache-control'), /no-store/);
  assert.deepEqual(Buffer.from(await media.arrayBuffer()), image);
  for (const representation of ['array', 'arraybuffer']) {
    const adapted = {
      ...h.env,
      AI_DB: {
        prepare(sql) {
          return {
            bind(...values) {
              return {
                async first() {
                  const row = await h.db
                    .prepare(sql)
                    .bind(...values)
                    .first();
                  if (row.image)
                    row.image =
                      representation === 'array'
                        ? [...row.image]
                        : row.image.buffer.slice(
                            row.image.byteOffset,
                            row.image.byteOffset + row.image.byteLength,
                          );
                  return row;
                },
              };
            },
          };
        },
      },
    };
    const portable = await handleShare(new Request(published.imageUrl), adapted);
    assert.equal(portable.status, 200);
    assert.deepEqual(Buffer.from(await portable.arrayBuffer()), image);
  }
  const head = await handleShare(new Request(published.imageUrl, { method: 'HEAD' }), h.env);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(
    (await handleShare(new Request(published.url, { method: 'POST' }), h.env)).status,
    405,
  );
});

test('deletion uses a private capability, immediately removes image/title, preserves quota, and works with new publishing disabled', async () => {
  const h = await setup();
  const published = await verified(async () => (await handleShare(h.create(), h.env)).json());
  const request = (token = published.deleteToken, originHeader = origin) =>
    new Request(`${origin}/api/share/${published.id}`, {
      method: 'DELETE',
      headers: { Origin: originHeader, Authorization: `Bearer ${token}` },
    });
  assert.equal(
    (await handleShare(request(published.deleteToken, 'https://evil.example'), h.env)).status,
    403,
  );
  assert.equal((await handleShare(request('invalid'), h.env)).status, 403);
  assert.equal((await handleShare(request('a'.repeat(43)), h.env)).status, 404);
  const deleted = await handleShare(request(), {
    ...h.env,
    SHARE_ENABLED: 'false',
    TURNSTILE_SECRET: undefined,
  });
  assert.equal(deleted.status, 200);
  const row = h.db.raw.prepare('SELECT * FROM public_shares').get();
  assert.equal(row.image, null);
  assert.equal(row.title, '');
  assert.equal(row.image_bytes, 0);
  assert.equal(row.delete_hash, null);
  assert.equal(count(h.db), 1);
  for (const url of [published.url, published.imageUrl])
    assert.equal((await handleShare(new Request(url), h.env)).status, 404);
  assert.equal((await handleShare(request(), h.env)).status, 404);
  const quota = await handleShare(
    new Request(`${origin}/api/share/session`, {
      headers: { Cookie: h.cookie, 'CF-Connecting-IP': '192.0.2.50' },
    }),
    h.env,
  );
  assert.equal((await quota.json()).remaining, 2);
});

test('ten concurrent signed create requests cannot exceed three visitor publications', async () => {
  const h = await setup();
  await verified(async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => handleShare(h.create(), h.env)),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 3);
    assert.equal(results.filter((r) => r.status === 429).length, 7);
  });
  assert.equal(count(h.db), 3);
});

test('pre-saved publication capability recovers a lost response without new verification or quota use', async () => {
  const h = await setup();
  const publication = { ...input, id: 'c'.repeat(32), deleteToken: 'd'.repeat(43) };
  for (const invalid of [
    { ...input, id: publication.id },
    { ...input, deleteToken: publication.deleteToken },
    { ...publication, id: 'C'.repeat(32) },
    { ...publication, deleteToken: 'd'.repeat(42) },
  ])
    assert.throws(() => validateShare(invalid));
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ success: true, hostname: 'ultraclipart.com', action: 'share' });
  };
  try {
    const initial = await handleShare(h.create(publication), h.env);
    assert.equal(initial.status, 201);
    const expected = await initial.json();
    const retry = await handleShare(
      h.create({
        ...publication,
        title: 'A different title',
        turnstileToken: 'already-used-token',
      }),
      h.env,
    );
    assert.equal(retry.status, 201);
    assert.deepEqual(await retry.json(), expected);
    assert.equal(calls, 1);
    assert.equal(count(h.db), 1);
    assert.equal(h.db.raw.prepare('SELECT title FROM public_shares').get().title, input.title);
    assert.equal(
      (await handleShare(h.create(publication, { 'X-CSRF-Token': '' }), h.env)).status,
      403,
    );
    const collision = await handleShare(
      h.create({ ...publication, deleteToken: 'e'.repeat(43) }),
      h.env,
    );
    assert.equal(collision.status, 409);
    assert.deepEqual(await collision.json(), { error: 'publication_conflict' });
    assert.equal(calls, 1);
    await handleShare(
      new Request(`${origin}/api/share/${publication.id}`, {
        method: 'DELETE',
        headers: { Origin: origin, Authorization: `Bearer ${publication.deleteToken}` },
      }),
      h.env,
    );
    assert.equal((await handleShare(h.create(publication), h.env)).status, 409);
    assert.equal(calls, 1);
    assert.equal(count(h.db, 'WHERE deleted_at IS NULL'), 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('concurrent retries of one publication create one row; a colliding capability cannot claim it', async () => {
  const h = await setup();
  const publication = { ...input, id: 'c'.repeat(32), deleteToken: 'd'.repeat(43) };
  await verified(async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => handleShare(h.create(publication), h.env)),
    );
    assert.equal(results.filter((response) => response.status === 201).length, 10);
    assert.equal(count(h.db), 1);
  });
  const separate = await setup();
  await verified(async () => {
    const results = await Promise.all(
      [publication, { ...publication, deleteToken: 'e'.repeat(43) }].map((value) =>
        handleShare(separate.create(value), separate.env),
      ),
    );
    assert.deepEqual(results.map((response) => response.status).sort(), [201, 409]);
    assert.equal(count(separate.db), 1);
  });
});

function seed(
  db,
  { count: amount, bytes = 1, day = '2020-01-01', visitor = 'old', network = 'old' },
) {
  const statement = db.raw.prepare(
    `INSERT INTO public_shares(id,title,image,image_bytes,width,height,created,day,visitor,network,delete_hash) VALUES(?,'seed',zeroblob(?),?,1,1,0,?,?,?,?)`,
  );
  for (let i = 0; i < amount; i++)
    statement.run(
      i.toString(16).padStart(32, '0'),
      bytes,
      bytes,
      day,
      visitor,
      network,
      'a'.repeat(64),
    );
}
const who = { day: '2026-10-24', visitor: 'current', network: 'current' };
test('atomic insert hard-clamps network/day/global/storage caps, including races at the last slot', async () => {
  const valid = validateShare(input);
  for (const scenario of [
    { seed: { count: 10, day: who.day, network: who.network }, name: 'network' },
    { seed: { count: 100, day: who.day }, name: 'daily' },
    { seed: { count: 1000 }, name: 'global count' },
    {
      seed: { count: 341, bytes: SHARE_LIMITS.maxImageBytes },
      input: { ...valid, image: new Uint8Array(200 * 1024) },
      name: 'storage boundary',
    },
  ]) {
    const db = database();
    seed(db, scenario.seed);
    const result = await insertShare(
      db,
      who,
      scenario.input || valid,
      Date.now(),
      'f'.repeat(32),
      'b'.repeat(64),
    );
    assert.equal(result.meta.changes, 0, scenario.name);
    db.raw.close();
  }
  const db = database();
  seed(db, { count: 999 });
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      insertShare(
        db,
        { ...who, visitor: 'v' + i, network: 'n' + i },
        valid,
        Date.now(),
        'f'.repeat(30) + i.toString(16).padStart(2, '0'),
        'b'.repeat(64),
      ),
    ),
  );
  assert.equal(
    results.reduce((sum, result) => sum + result.meta.changes, 0),
    1,
  );
  assert.equal(count(db), 1000);
  db.raw.close();
  const storage = database();
  seed(storage, { count: 341, bytes: SHARE_LIMITS.maxImageBytes });
  const writes = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      insertShare(
        storage,
        { ...who, visitor: 'v' + i, network: 'n' + i },
        { ...valid, image: new Uint8Array(100 * 1024) },
        Date.now(),
        'f'.repeat(30) + i.toString(16).padStart(2, '0'),
        'b'.repeat(64),
      ),
    ),
  );
  assert.equal(
    writes.reduce((sum, result) => sum + result.meta.changes, 0),
    1,
  );
  assert.ok(
    storage.raw.prepare('SELECT SUM(image_bytes) bytes FROM public_shares').get().bytes <=
      SHARE_LIMITS.maxStorageBytes,
  );
  storage.raw.close();
});

test('expired fingerprints are erased but compact deleted ids remain and cannot be republished', async () => {
  const h = await setup();
  seed(h.db, { count: 2 });
  h.db.raw.exec(
    "UPDATE public_shares SET image=NULL,image_bytes=0,title='',delete_hash=NULL,deleted_at=1 WHERE id='00000000000000000000000000000000'",
  );
  const pending = [];
  const response = await handleShare(
    new Request(origin + '/api/share/session', { headers: { 'CF-Connecting-IP': '192.0.2.50' } }),
    h.env,
    {
      waitUntil(task) {
        pending.push(task);
      },
    },
  );
  assert.equal(response.status, 200);
  await Promise.all(pending);
  assert.equal(count(h.db), 2);
  const row = h.db.raw.prepare('SELECT * FROM public_shares WHERE deleted_at IS NULL').get();
  assert.equal(row.visitor, null);
  assert.equal(row.network, null);
  assert.ok(row.image);
  assert.equal(row.title, 'seed');
  const tombstone = h.db.raw
    .prepare('SELECT * FROM public_shares WHERE deleted_at IS NOT NULL')
    .get();
  assert.equal(tombstone.id, '0'.repeat(32));
  for (const field of ['visitor', 'network', 'image', 'delete_hash'])
    assert.equal(tombstone[field], null);
  assert.equal(tombstone.day, '');
  assert.equal(tombstone.created, 0);
  assert.equal(tombstone.deleted_at, 1);
  assert.equal(
    (
      await handleShare(
        h.create({ ...input, id: tombstone.id, deleteToken: 'd'.repeat(43) }),
        h.env,
      )
    ).status,
    409,
  );
});

test('10,000 compact tombstones exhaust the hard lifetime limit without retaining image bytes', async () => {
  const h = await setup();
  seed(h.db, { count: 10000 });
  h.db.raw.exec(
    "UPDATE public_shares SET image=NULL,image_bytes=0,title='',delete_hash=NULL,deleted_at=1,visitor=NULL,network=NULL,day=''",
  );
  const result = await insertShare(
    h.db,
    who,
    validateShare(input),
    Date.now(),
    'f'.repeat(32),
    'b'.repeat(64),
  );
  assert.equal(result.meta.changes, 0);
  const response = await handleShare(
    new Request(origin + '/api/share/session', { headers: { 'CF-Connecting-IP': '192.0.2.50' } }),
    h.env,
  );
  const session = await response.json();
  assert.equal(session.globalRemaining, 0);
  assert.equal(session.remaining, 0);
  assert.equal(session.limits.maxLifetimeShares, 10000);
  assert.equal(h.db.raw.prepare('SELECT SUM(image_bytes) bytes FROM public_shares').get().bytes, 0);
});

test('bounded streaming body, strict content type and malformed JSON are rejected before verification', async () => {
  const h = await setup();
  assert.equal(
    (await handleShare(h.create(input, { 'Content-Type': 'text/plain' }), h.env)).status,
    415,
  );
  assert.equal(
    (
      await handleShare(
        h.create(input, { 'Content-Length': String(SHARE_LIMITS.maxRequestBytes + 1) }),
        h.env,
      )
    ).status,
    413,
  );
  const make = (body) =>
    new Request(origin + '/api/share/create', {
      method: 'POST',
      headers: {
        Origin: origin,
        Cookie: h.cookie,
        'X-CSRF-Token': h.session.csrfToken,
        'CF-Connecting-IP': '192.0.2.50',
        'Content-Type': 'application/json',
      },
      body,
      ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
    });
  assert.equal((await handleShare(make('{broken'), h.env)).status, 400);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(SHARE_LIMITS.maxRequestBytes + 1));
      controller.close();
    },
  });
  assert.equal((await handleShare(make(stream), h.env)).status, 413);
  assert.equal(count(h.db), 0);
});

test('upstream errors and unavailable/missing database fail closed without leaking secrets', async () => {
  const h = await setup();
  const saved = globalThis.fetch;
  for (const failure of [
    async () => {
      throw Error('private credential');
    },
    async () => new Response('{broken'),
    async () => new Response('private credential', { status: 500 }),
  ]) {
    globalThis.fetch = failure;
    const response = await handleShare(h.create(), h.env);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'verification_unavailable');
  }
  globalThis.fetch = saved;
  const unavailable = {
    ...h.env,
    AI_DB: {
      prepare() {
        throw Error('private credential or SQL');
      },
    },
  };
  const response = await handleShare(
    new Request(origin + '/api/share/session', { headers: { 'CF-Connecting-IP': '192.0.2.50' } }),
    unavailable,
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'service_unavailable');
  assert.equal(count(h.db), 0);
  for (const url of ['/api/share/unknown', '/share/not-an-id/'])
    assert.equal((await handleShare(new Request(origin + url), h.env)).status, 404);
});
