import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePublication } from '../scripts/r2/prepare-publication.mjs';
import {
  ASSET_ORIGIN,
  MIME_TYPES,
  SITE_ORIGIN,
  validatePublication,
} from '../scripts/publication-policy.mjs';
import { artwork, manifestFor, waveFor, date } from './fixtures/publication.mjs';
function environment(items, bodies, wave, overrides = {}) {
  const calls = [];
  return {
    calls,
    options: {
      catalog: items,
      ...wave,
      readAsset: (path) => bodies.get(path),
      now: () => Date.parse(date),
      fetcher: async (url, options) => {
        calls.push(url);
        assert.equal(options.headers.Origin, SITE_ORIGIN);
        assert.equal(options.redirect, 'error');
        const object = wave.batch.find((x) => `${ASSET_ORIGIN}/${x.key}` === url);
        assert.ok(object, 'Only newly uploaded URLs may be fetched');
        const kind = object.kind === 'thumbnail' ? 'thumb' : object.kind;
        const item = items.find((x) => x.id === object.assetId);
        return new Response(overrides.body ?? bodies.get(item[kind]), {
          status: overrides.status ?? 200,
          headers: {
            'content-type': MIME_TYPES[kind],
            'access-control-allow-origin': SITE_ORIGIN,
            ...overrides.headers,
          },
        });
      },
    },
  };
}
test('two sequential waves retain old URLs and verify only new CDN files', async () => {
  const bodies = new Map(),
    a = artwork('first-artwork', bodies),
    b = artwork('second-artwork', bodies);
  const one = environment([a], bodies, waveFor([a]));
  const first = await preparePublication({ prior: null, ...one.options });
  assert.equal(one.calls.length, 4);
  const two = environment([a, b], bodies, waveFor([b]));
  const second = await preparePublication({ prior: first, ...two.options });
  assert.equal(two.calls.length, 4);
  assert.equal(second.files.length, 8);
  assert.deepEqual(
    second.files.filter((x) => x.assetId === a.id),
    first.files,
  );
  assert.ok(
    second.files
      .filter((x) => x.assetId === b.id)
      .every((x) => x.url.includes(x.sha256.slice(0, 16))),
  );
  assert.equal(validatePublication(second, [a, b], (path) => bodies.get(path)).files, 8);
});
test('existing flat pilot URLs survive adding a content-addressed production wave', async () => {
  const bodies = new Map(),
    a = artwork('existing-pilot', bodies),
    b = artwork('next-artwork', bodies),
    prior = manifestFor([a]);
  const e = environment([a, b], bodies, waveFor([b]));
  const result = await preparePublication({ prior, ...e.options });
  assert.deepEqual(
    result.files.filter((x) => x.assetId === a.id),
    prior.files,
  );
  assert.equal(e.calls.length, 4);
});
test('incomplete or unverified journals cannot produce a publication manifest', async () => {
  for (const mutate of [
    (j) => (j.status = 'uploading'),
    (j) => (j.batchSha256 = 'b'.repeat(64)),
    (j) => j.verifiedObjects.pop(),
    (j) => (j.verifiedArtworkIds = []),
    (j) => (j.verifiedObjects[0].sha256 = 'c'.repeat(64)),
    (j) => j.inventoryScope.jurisdictions.pop(),
    (j) => (j.aggregateBytes = 8_000_000_001),
  ]) {
    const bodies = new Map(),
      a = artwork('drawing-one', bodies),
      wave = waveFor([a]);
    mutate(wave.journal);
    const e = environment([a], bodies, wave);
    await assert.rejects(preparePublication({ prior: null, ...e.options }));
    assert.equal(e.calls.length, 0);
  }
});
test('an incomplete next catalog or mismatched local content fails before network reads', async () => {
  const bodies = new Map(),
    a = artwork('drawing-one', bodies),
    b = artwork('drawing-two', bodies),
    wave = waveFor([a]);
  const e = environment([a, b], bodies, wave);
  await assert.rejects(
    preparePublication({ prior: null, ...e.options }),
    /Incomplete next publication/,
  );
  assert.equal(e.calls.length, 0);
  bodies.set(a.svg, Buffer.from('modified'));
  const changed = environment([a], bodies, wave);
  await assert.rejects(
    preparePublication({ prior: null, ...changed.options }),
    /Local source differs/,
  );
  assert.equal(changed.calls.length, 0);
});
test('CDN MIME, CORS, status and full-byte checks all gate verification', async () => {
  for (const overrides of [
    { headers: { 'content-type': 'text/plain' } },
    { headers: { 'access-control-allow-origin': 'https://wrong.example' } },
    { status: 404 },
    { body: Buffer.from('wrong bytes') },
  ]) {
    const bodies = new Map(),
      a = artwork('drawing-one', bodies),
      e = environment([a], bodies, waveFor([a]), overrides);
    await assert.rejects(preparePublication({ prior: null, ...e.options }), /CDN/);
  }
});
test('changed artwork requires its new complete upload journal and refreshes only changed files', async () => {
  const bodies = new Map(),
    a = artwork('drawing-one', bodies),
    prior = manifestFor([a]);
  const { digest } = await import('./fixtures/publication.mjs');
  const body = Buffer.from('new original svg revision');
  bodies.set(a.svg, body);
  a.files.svg = { bytes: body.length, sha256: digest(body) };
  const e = environment([a], bodies, waveFor([a]));
  const result = await preparePublication({ prior, ...e.options });
  assert.equal(e.calls.length, 1);
  assert.notEqual(
    result.files.find((x) => x.kind === 'svg').url,
    prior.files.find((x) => x.kind === 'svg').url,
  );
  for (const kind of ['pdf', 'webp', 'thumb'])
    assert.equal(
      result.files.find((x) => x.kind === kind).url,
      prior.files.find((x) => x.kind === kind).url,
    );
});
