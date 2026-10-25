import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewedProductMetadata } from '../scripts/product-identity.mjs';
import { packageMetadata } from '../scripts/remaining-thirty-one-copy.mjs';
const reviews = JSON.parse(
  readFileSync(new URL('../scripts/remaining-product-identities.json', import.meta.url)),
);
test('all 150 branded images have source-bound visual reviews and manufacturer references', () => {
  assert.equal(Object.keys(reviews).length, 150);
  for (const [id, record] of Object.entries(reviews)) {
    const result = packageMetadata(id.split('-clipart-')[0], id, record.sourceSha256);
    assert.equal(result.alt, record.caption);
    assert.equal(result.title, record.subject + ' Clipart');
    assert.deepEqual(result.productIdentity, reviewedProductMetadata(record).productIdentity);
    assert.throws(() => packageMetadata(id.split('-clipart-')[0], id, '0'.repeat(64)), /changed/);
  }
});
test('unknown models, changed images and invented production concepts fail closed', () => {
  const model = reviews['tesla-clipart-model-x-falcon-doors'];
  assert.equal(model.model, 'Model X');
  assert.throws(() => reviewedProductMetadata(null), /review/);
  assert.throws(
    () => reviewedProductMetadata({ ...model, sourcePath: undefined }),
    /source image path/,
  );
  assert.throws(() => packageMetadata('tesla', 'tesla-clipart-unreviewed-flying-car'), /review/);
  assert.throws(() => reviewedProductMetadata({ ...model, reviewedFromPixels: false }), /review/);
  assert.throws(
    () => reviewedProductMetadata({ ...model, reference: 'https://rumors.example/car' }),
    /manufacturer/,
  );
  assert.throws(
    () => reviewedProductMetadata({ ...model, kind: 'imagined-concept' }),
    /exact production model/,
  );
  const flying = packageMetadata('tesla', 'tesla-clipart-roadster-rocket-vertical-liftoff');
  assert.equal(flying.productIdentity.model, null);
  assert.equal(flying.productIdentity.kind, 'imagined-concept');
  assert.match(flying.title, /Flying Sports Car Concept/);
  assert.match(flying.description, /fictional flight/);
  const orange = packageMetadata('iphone', 'iphone-clipart-iphone-17-pro-max-cosmic-orange-gimbal');
  assert.equal(orange.productIdentity.model, null);
  assert.doesNotMatch(orange.title, /17|Pro Max/);
  assert.match(
    packageMetadata('tesla', 'tesla-clipart-first-roadster-open-top').title,
    /First-generation Tesla Roadster/,
  );
});
