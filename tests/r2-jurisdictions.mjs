import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JURISDICTIONS,
  measureAccount,
  endpointFor,
  proveEmptyJurisdiction,
  validateInventoryScope,
} from '../scripts/r2/inventory.mjs';
import { buildPlan, HARD_CAP } from '../scripts/r2/plan.mjs';
const accountId = 'a'.repeat(32),
  endpoint = endpointFor(accountId, 'default'),
  hash = 'a'.repeat(64),
  now = 1_000_000;
const batch = ['pdf', 'svg', 'thumbnail', 'webp'].map((kind) => ({
  assetId: 'pumpkin',
  kind,
  bucket: 'ultraclipart',
  key: `art.${kind}.${hash.slice(0, 12)}`,
  bytes: 100,
  sha256: hash,
}));
const jurisdictionFrom = (url) => JURISDICTIONS.find((j) => endpointFor(accountId, j) === url);
function adapter(extra = {}) {
  const calls = [];
  const aws = (command, args, url) => {
    const jurisdiction = jurisdictionFrom(url);
    calls.push({ command, jurisdiction, args });
    assert.ok(jurisdiction, 'Every request must use a known endpoint for the same account');
    const override = extra[jurisdiction];
    if (override instanceof Error) throw override;
    if (command === 'list-buckets')
      return { Buckets: jurisdiction === 'default' || override ? [{ Name: 'ultraclipart' }] : [] };
    if (command === 'list-objects-v2') return { IsTruncated: false, Contents: override ?? [] };
    throw new Error(`Unexpected ${command}`);
  };
  return { aws, calls };
}
test('measures every jurisdiction and counts same-named buckets independently', async () => {
  const { aws, calls } = adapter({ eu: [{ Key: 'legacy', Size: HARD_CAP - 399 }] });
  const inventory = await measureAccount({ endpoint, batch, aws, now: () => now });
  assert.deepEqual(
    calls.filter((c) => c.command === 'list-buckets').map((c) => c.jurisdiction),
    JURISDICTIONS,
  );
  assert.equal(inventory.buckets.length, 2);
  assert.throws(() => buildPlan(inventory, batch, now), /hard cap/);
});
test('one inaccessible jurisdiction fails closed; unknown is never zero', async () => {
  const { aws } = adapter({ us: new Error('AccessDenied') });
  await assert.rejects(measureAccount({ endpoint, batch, aws }), /Cannot inventory us/);
});
test('single-endpoint and incomplete saved inventories cannot claim account scope', async () => {
  const { aws } = adapter();
  const inventory = await measureAccount({ endpoint, batch, aws, now: () => now });
  const partial = { ...inventory, jurisdictions: inventory.jurisdictions.slice(0, 1) };
  assert.throws(() => buildPlan(partial, batch, now), /jurisdiction coverage/);
  assert.throws(
    () => buildPlan({ complete: true, observedAt: now, buckets: inventory.buckets }, batch, now),
    /inventory scope/,
  );
  inventory.jurisdictions[1].endpoint = endpointFor('b'.repeat(32), 'eu');
  assert.throws(() => validateInventoryScope(inventory), /mismatched/);
});
test('fresh verified API absence can replace an unavailable S3 scope, with evidence retained', async () => {
  const { aws } = adapter({ fedramp: new Error('Not enabled') });
  const seen = [];
  const inventory = await measureAccount({
    endpoint,
    batch,
    aws,
    now: () => now,
    proveAbsent: async (account, jurisdiction) => {
      seen.push(jurisdiction);
      return proveEmptyJurisdiction({
        accountId: account,
        jurisdiction,
        token: 'read-only-test-token',
        fetcher: async (url, options) => {
          assert.ok(
            url.startsWith(
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets?`,
            ),
          );
          assert.equal(options.headers['cf-r2-jurisdiction'], 'fedramp');
          assert.equal(options.redirect, 'error');
          return {
            status: 200,
            json: async () => ({
              success: true,
              errors: [],
              result: { buckets: [] },
              result_info: { total_count: 0 },
            }),
          };
        },
      });
    },
  });
  assert.deepEqual(seen, ['fedramp']);
  assert.equal(
    inventory.jurisdictions.find((x) => x.jurisdiction === 'fedramp').proof.source,
    'cloudflare-api-empty',
  );
  assert.equal(buildPlan(inventory, batch, now).projectedBytes, 400);
});
test('API denial, missing counts, pagination and nonempty scopes are not absence proof', async () => {
  const good = {
    success: true,
    errors: [],
    result: { buckets: [] },
    result_info: { total_count: 0 },
  };
  const cases = [
    { status: 403, body: good },
    { status: 404, body: good },
    { status: 200, body: { ...good, success: false } },
    { status: 200, body: { ...good, errors: [{ code: 1000 }] } },
    { status: 200, body: { ...good, result_info: {} } },
    { status: 200, body: { ...good, result_info: { total_count: 0, cursor: 'next' } } },
    { status: 200, body: { ...good, result: { buckets: [{ name: 'unseen' }] } } },
    { status: 200, body: { ...good, result_info: { total_count: 1 } } },
  ];
  for (const { status, body } of cases)
    await assert.rejects(
      proveEmptyJurisdiction({
        accountId,
        jurisdiction: 'fedramp',
        token: 'fixture',
        fetcher: async () => ({ status, json: async () => body }),
      }),
      /Cannot prove/,
    );
  await assert.rejects(
    proveEmptyJurisdiction({ accountId, jurisdiction: 'fedramp' }),
    /R2_ACCOUNT_READ_TOKEN/,
  );
});
test('paginated bucket and object enumeration is complete and looping cursors abort', async () => {
  const aws = (command, args, url) => {
    const j = jurisdictionFrom(url),
      next = args.includes('--continuation-token');
    if (command === 'list-buckets')
      return j === 'default'
        ? next
          ? { Buckets: [{ Name: 'second-bucket' }] }
          : { Buckets: [{ Name: 'ultraclipart' }], ContinuationToken: 'next-bucket' }
        : { Buckets: [] };
    if (command === 'list-objects-v2')
      return next
        ? { IsTruncated: false, Contents: [{ Key: 'two', Size: 2 }] }
        : {
            IsTruncated: true,
            NextContinuationToken: 'next-object',
            Contents: [{ Key: 'one', Size: 1 }],
          };
    throw new Error(command);
  };
  const inventory = await measureAccount({ endpoint, batch, aws, now: () => now });
  assert.equal(buildPlan(inventory, batch, now).measuredBytes, 6);
  await assert.rejects(
    measureAccount({ endpoint, batch, aws: () => ({ Buckets: [], ContinuationToken: 'loop' }) }),
    /Cannot inventory default/,
  );
});
test('object errors in a known populated jurisdiction cannot use an absence override', async () => {
  let absenceCalls = 0;
  await assert.rejects(
    measureAccount({
      endpoint,
      batch,
      aws: (command) => {
        if (command === 'list-buckets') return { Buckets: [{ Name: 'ultraclipart' }] };
        throw new Error('Denied object listing');
      },
      proveAbsent: async () => {
        absenceCalls++;
        return {};
      },
    }),
    /Denied object listing/,
  );
  assert.equal(absenceCalls, 0);
});
