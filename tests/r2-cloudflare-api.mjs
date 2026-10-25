import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  cloudflareTransport,
  configuredToken,
  refreshConfiguredLogin,
} from '../scripts/r2/cloudflare-api.mjs';
import { measureAccount, endpointFor, validateInventoryScope } from '../scripts/r2/inventory.mjs';
const accountId = 'a'.repeat(32),
  now = 1000000,
  token = 'never-printed-secret';
const endpoint = endpointFor(accountId, 'default');
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const envelope = (result, result_info) => ({
  success: true,
  errors: [],
  result,
  ...(result_info ? { result_info } : {}),
});
test('transient body interruption retries a GET and never caches a partial representation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'uc-read-retry-'));
  let calls = 0;
  const expected = Buffer.from('complete verified representation');
  const rest = cloudflareTransport({
    accountId,
    token,
    fetcher: async () => {
      calls++;
      if (calls === 1)
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array([1, 2, 3]));
              controller.error(new DOMException('interrupted', 'TimeoutError'));
            },
          }),
        );
      return new Response(expected, { headers: { ETag: '"complete"' } });
    },
  });
  try {
    const target = join(dir, 'download');
    await rest.aws(
      'get-object',
      ['--bucket', 'ultraclipart-media', '--key', 'art/file.pdf', target],
      endpoint,
    );
    assert.equal(calls, 2);
    assert.deepEqual(readFileSync(target), expected);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('readback reuses exact verified bytes, but a fresh deletion invalidates that reuse', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'uc-byte-cache-'));
  let deleted = false,
    gets = 0;
  const bytes = Buffer.from('verified original');
  const rest = cloudflareTransport({
    accountId,
    token,
    fetcher: async (url) => {
      if (url.includes('/objects?'))
        return json(
          envelope(deleted ? [] : [{ key: 'art/file.pdf', size: bytes.length, etag: 'v1' }]),
        );
      gets++;
      return new Response(deleted ? null : bytes, {
        status: deleted ? 404 : 200,
        headers: { ETag: '"v1"' },
      });
    },
  });
  const fields = ['--bucket', 'ultraclipart-media', '--key', 'art/file.pdf'];
  try {
    await rest.aws('list-objects-v2', ['--bucket', 'ultraclipart-media'], endpoint);
    await rest.aws('head-object', fields, endpoint);
    await rest.aws('get-object', [...fields, join(dir, 'download')], endpoint);
    assert.equal(gets, 1);
    assert.deepEqual(readFileSync(join(dir, 'download')), bytes);
    deleted = true;
    await rest.aws('list-objects-v2', ['--bucket', 'ultraclipart-media'], endpoint);
    await assert.rejects(
      rest.aws('get-object', [...fields, join(dir, 'download')], endpoint),
      /HTTP 404/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('verified SHA cache follows fresh R2 ETag and byte count; changed or unknown versions force a real GET', async () => {
  let currentTag = 'v1',
    body = Buffer.from('first'),
    gets = 0;
  const rest = cloudflareTransport({
    accountId,
    token,
    fetcher: async (url) => {
      if (url.includes('/objects?'))
        return json(envelope([{ key: 'art/file.pdf', size: body.length, etag: currentTag }]));
      gets++;
      return new Response(body, { headers: currentTag ? { ETag: `"${currentTag}"` } : {} });
    },
  });
  const list = () => rest.aws('list-objects-v2', ['--bucket', 'ultraclipart-media'], endpoint);
  const head = () =>
    rest.aws('head-object', ['--bucket', 'ultraclipart-media', '--key', 'art/file.pdf'], endpoint);
  await list();
  const first = await head();
  await list();
  assert.deepEqual(await head(), first);
  assert.equal(gets, 1);
  currentTag = 'v2';
  body = Buffer.from('other');
  await list();
  assert.notDeepEqual(await head(), first);
  assert.equal(gets, 2);
  body = Buffer.from('longer version');
  await list();
  await head();
  assert.equal(gets, 3);
  currentTag = '';
  await list();
  await head();
  await head();
  assert.equal(gets, 5);
});
test('REST inventory independently proves disabled FedRAMP; enabled/unknown/denied capabilities remain blocking', async () => {
  let feature = false,
    capabilityStatus = 200;
  const calls = [];
  const transport = cloudflareTransport({
    accountId,
    token,
    now: () => now,
    fetcher: async (url, options) => {
      calls.push(url);
      assert.equal(new URL(url).origin, 'https://api.cloudflare.com');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, `Bearer ${token}`);
      const jurisdiction = options.headers['cf-r2-jurisdiction'];
      if (url.endsWith('/entitlements'))
        return json(
          envelope([
            {
              feature: { key: 'r2.fedramp' },
              allocation: { type: 'bool', value: feature },
              deleted_date: '',
            },
          ]),
          capabilityStatus,
        );
      if (url.includes('/objects?')) return json(envelope([{ key: 'existing', size: 123 }]));
      if (['fedramp', 'fedramp-high'].includes(jurisdiction))
        return json({ success: false, errors: [{ code: 10003 }] }, 403);
      return json(
        envelope(
          {
            buckets:
              jurisdiction === 'default' ? [{ name: 'ultraclipart-media', jurisdiction }] : [],
          },
          { total_count: jurisdiction === 'default' ? 1 : 0 },
        ),
      );
    },
  });
  const inventory = await measureAccount({ endpoint, batch: [], ...transport, now: () => now });
  validateInventoryScope(inventory);
  assert.equal(inventory.buckets[0].objects[0].bytes, 123);
  assert.equal(inventory.jurisdictions[0].proof.source, 'cloudflare-api-list-buckets');
  assert.equal(inventory.jurisdictions[3].proof.source, 'cloudflare-entitlement-disabled');
  assert.equal(calls.filter((x) => x.endsWith('/entitlements')).length, 2);
  feature = true;
  await assert.rejects(
    measureAccount({ endpoint, batch: [], ...transport, now: () => now }),
    /enabled or unknown/,
  );
  feature = undefined;
  await assert.rejects(
    measureAccount({ endpoint, batch: [], ...transport, now: () => now }),
    /enabled or unknown/,
  );
  feature = false;
  capabilityStatus = 403;
  await assert.rejects(
    measureAccount({ endpoint, batch: [], ...transport, now: () => now }),
    /HTTP 403/,
  );
  inventory.jurisdictions[3].proof.allocated = true;
  assert.throws(() => validateInventoryScope(inventory), /capability proof/);
});
test('REST bucket roster cannot silently omit a counted bucket; object cursors must be complete', async () => {
  const rest = cloudflareTransport({
    accountId,
    token,
    fetcher: async () =>
      json(envelope({ buckets: [{ name: 'ultraclipart-media' }] }, { total_count: 2 })),
  });
  await assert.rejects(
    measureAccount({ endpoint, batch: [], ...rest }),
    /Cannot inventory default/,
  );
  const truncated = cloudflareTransport({
    accountId,
    token,
    fetcher: async () => json(envelope([], { is_truncated: true })),
  });
  await assert.rejects(
    truncated.aws('list-objects-v2', ['--bucket', 'ultraclipart-media'], endpoint),
    /pagination/,
  );
});
test('REST writes require explicit project bucket, immutable snapshot and conditional Standard metadata; actual GET bytes are verified', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'uc-rest-'));
  try {
    const bytes = Buffer.from('%PDF-original-vector'),
      sha = createHash('sha256').update(bytes).digest('hex'),
      key = `pumpkin/art.${sha.slice(0, 16)}.pdf`;
    writeFileSync(join(dir, 'input.pdf'), bytes);
    const calls = [];
    const rest = cloudflareTransport({
      accountId,
      token,
      writeBucket: 'ultraclipart-media',
      fetcher: async (url, options) => {
        calls.push({ url, options });
        if (options.method === 'PUT')
          return json(envelope({ key, size: String(bytes.length), storage_class: 'Standard' }));
        return new Response(bytes);
      },
    });
    const args = [
      '--bucket',
      'ultraclipart-media',
      '--key',
      key,
      '--body',
      join(dir, 'input.pdf'),
      '--if-none-match',
      '*',
      '--storage-class',
      'STANDARD',
      '--metadata',
      JSON.stringify({ sha256: sha }),
      '--content-type',
      'application/pdf',
      '--cache-control',
      'public,max-age=31536000,immutable',
    ];
    await rest.aws('put-object', args, endpoint);
    assert.equal(calls[0].options.headers['If-None-Match'], '*');
    assert.equal(calls[0].options.headers['cf-r2-storage-class'], 'Standard');
    assert.ok(calls[0].url.endsWith('/objects/' + key));
    assert.ok(!calls[0].url.includes('%2F'));
    assert.ok(Buffer.from(calls[0].options.body).equals(bytes));
    const header = await rest.aws(
      'head-object',
      ['--bucket', 'ultraclipart-media', '--key', key],
      endpoint,
    );
    assert.equal(header.Metadata.sha256, sha);
    await rest.aws(
      'get-object',
      ['--bucket', 'ultraclipart-media', '--key', key, join(dir, 'download')],
      endpoint,
    );
    assert.ok(readFileSync(join(dir, 'download')).equals(bytes));
    const other = [...args];
    other[1] = 'unrelated-bucket';
    await assert.rejects(rest.aws('put-object', other, endpoint), /configured project bucket/);
    await assert.rejects(rest.aws('delete-object', args, endpoint), /Unsupported/);
    const large = cloudflareTransport({
      accountId,
      token,
      fetcher: async () => new Response('bad', { headers: { 'Content-Length': '16000001' } }),
    });
    await assert.rejects(
      large.aws('head-object', ['--bucket', 'ultraclipart-media', '--key', key], endpoint),
      /allowed bound/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('expired/missing Wrangler login is rejected without revealing credentials', () => {
  const dir = mkdtempSync(join(tmpdir(), 'uc-auth-'));
  try {
    const path = join(dir, 'auth.toml');
    writeFileSync(path, `oauth_token = "${token}"\nexpiration_time = "1970-01-01T00:00:00Z"\n`);
    assert.throws(() => configuredToken({ WRANGLER_AUTH_FILE: path }, now), /expires soon/);
    assert.throws(() => configuredToken({}, now), /never pass tokens/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('explicit rate limits retry the rejected request after backoff', async () => {
  let calls = 0;
  const observed = [];
  const transport = cloudflareTransport({
    accountId,
    token,
    writeBucket: 'ultraclipart-media',
    fetcher: async (url, options) => {
      observed.push({ method: options.method, condition: options.headers['If-None-Match'] });
      calls++;
      return calls === 1
        ? new Response(null, { status: 429, headers: { 'retry-after': '0' } })
        : json(envelope({ buckets: [] }, { total_count: 0 }));
    },
  });
  await transport.aws('list-buckets', [], endpoint);
  assert.equal(calls, 2);
  assert.deepEqual(observed[0], observed[1]);
});

test('a full page without pagination metadata is probed with start_after, including an empty terminal page', async () => {
  for (const remainder of [0, 2]) {
    const objects = Array.from({ length: 1000 }, (_, i) => ({
      key: `art/${String(i).padStart(4, '0')}`,
      size: i,
      etag: `v${i}`,
    }));
    const seen = [];
    const rest = cloudflareTransport({
      accountId,
      token,
      fetcher: async (input) => {
        const url = new URL(input);
        seen.push(url);
        if (url.searchParams.has('start_after')) {
          assert.equal(url.searchParams.get('start_after'), 'art/0999');
          assert.equal(url.searchParams.has('cursor'), false);
          return json(
            envelope(
              Array.from({ length: remainder }, (_, i) => ({
                key: `art/${1000 + i}`,
                size: i,
                etag: `next${i}`,
              })),
            ),
          );
        }
        return json(envelope(objects));
      },
    });
    const first = await rest.aws('list-objects-v2', ['--bucket', 'ultraclipart-media'], endpoint);
    assert.equal(first.IsTruncated, true);
    assert.equal(first.Contents.length, 1000);
    const last = await rest.aws(
      'list-objects-v2',
      ['--bucket', 'ultraclipart-media', '--continuation-token', first.NextContinuationToken],
      endpoint,
    );
    assert.equal(last.IsTruncated, false);
    assert.equal(last.Contents.length, remainder);
    assert.equal(seen.length, 2);
  }
});

test('fallback object enumeration rejects a repeated last key and cannot cross buckets', async () => {
  const objects = Array.from({ length: 1000 }, (_, i) => ({
    key: `art/${String(i).padStart(4, '0')}`,
    size: i,
    etag: `v${i}`,
  }));
  const rest = cloudflareTransport({
    accountId,
    token,
    fetcher: async (url) =>
      json(envelope(url.includes('start_after=') ? [objects.at(-1)] : objects)),
  });
  const first = await rest.aws('list-objects-v2', ['--bucket', 'ultraclipart-media'], endpoint);
  await assert.rejects(
    rest.aws(
      'list-objects-v2',
      ['--bucket', 'ultraclipart-media', '--continuation-token', first.NextContinuationToken],
      endpoint,
    ),
    /did not advance/,
  );
  await assert.rejects(
    rest.aws(
      'list-objects-v2',
      ['--bucket', 'other-bucket', '--continuation-token', first.NextContinuationToken],
      endpoint,
    ),
    /scope mismatch/,
  );
});

test('the final-minute login boundary waits for native refresh without changing the saved expiry', async () => {
  for (const remaining of [35_000, 60_000]) {
    let clock = 100_000,
      expiry = clock + remaining,
      calls = 0;
    const waits = [];
    const readToken = () => {
      if (expiry <= clock + 60_000) throw Error('expires soon');
      return 'valid';
    };
    const result = await refreshConfiguredLogin({
      now: () => clock,
      expiry: () => expiry,
      readToken,
      refresh: async () => {
        calls++;
        if (clock >= expiry) expiry = clock + 3_600_000;
      },
      wait: async (milliseconds) => {
        assert.equal(expiry, 100_000 + remaining);
        assert.ok(milliseconds <= 60_000);
        waits.push(milliseconds);
        clock += milliseconds;
      },
    });
    assert.equal(result, 'valid');
    assert.equal(calls, 2);
    assert.equal(waits.length, 1);
    assert.ok(expiry > clock + 60_000);
  }
});

test('an already expired native login refreshes immediately', async () => {
  let expiry = 99_000,
    calls = 0;
  assert.equal(
    await refreshConfiguredLogin({
      now: () => 100_000,
      expiry: () => expiry,
      readToken: () => {
        if (expiry <= 160_000) throw Error('expired');
        return 'valid';
      },
      refresh: async () => {
        calls++;
        expiry = 3_700_000;
      },
      wait: async () => {
        throw Error('unnecessary wait');
      },
    }),
    'valid',
  );
  assert.equal(calls, 1);
});

test('missing or invalid login state cannot turn into a successful refresh', async () => {
  for (const expiry of [NaN, 3_700_000])
    await assert.rejects(
      refreshConfiguredLogin({
        now: () => 100_000,
        expiry: () => expiry,
        readToken: () => {
          throw Error('missing credentials');
        },
        refresh: async () => {},
        wait: async () => {
          throw Error('unexpected wait');
        },
      }),
      /missing credentials/,
    );
});
