import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateIdentification } from '../scripts/identification-review.mjs';

const root = resolve(import.meta.dirname, '..');
const read = (path) => JSON.parse(readFileSync(resolve(root, path)));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const collection = 'owner-culture-tech-2026-10-26';
const art = read('data/art.json').filter((x) => x.sourceCollection === collection);
const registry = read('data/identification/culture-tech.json');
const review = read('data/culture-tech-review.json');

test('all supplied packages have fifty independent accepted entries and one file pair', () => {
  assert.equal(art.length, 1250);
  assert.equal(new Set(art.map((x) => x.id)).size, 1250);
  const archives = new Map();
  for (const a of art) {
    archives.set(a.sourceArchiveTopic, (archives.get(a.sourceArchiveTopic) ?? 0) + 1);
    assert.deepEqual(a.formats, ['WEBP', 'PDF']);
    assert.equal(a.svg, null);
    assert.equal(a.published, true);
    assert.equal(a.indexable, true);
    assert(a.files.pdf.bytes <= 1_000_000);
  }
  assert.equal(archives.size, 25);
  for (const count of archives.values()) assert.equal(count, 50);
  assert.equal(new Set(art.map((x) => x.topic)).size, 22);
  for (const topic of ['hexed', 'sonic-the-hedgehog', 'angry-birds'])
    assert.equal(art.filter((x) => x.topic === topic).length, 100);
});

test('actual source bytes and public metadata match the reviewed identity, including replacements', () => {
  assert.equal(registry.artworks.length, 1250);
  assert.equal(
    review.identityRegistrySha256,
    sha(readFileSync(resolve(root, 'data/identification/culture-tech.json'))),
  );
  for (const a of art) {
    const record = registry.artworks.find((x) => x.id === a.id);
    const bytes = readFileSync(resolve(root, 'public', a.webp.slice(1)));
    assert.equal(record.status, 'PASS');
    assert.equal(sha(bytes), record.sourceSha256, a.id);
    for (const key of ['title', 'alt', 'description']) assert.equal(a[key], record.metadata[key]);
    assert(
      !/FLUX|real generated examples|AI.generated artwork/i.test(a.title + a.alt + a.description),
    );
    if (['generic-subject', 'political-symbol'].includes(record.level)) {
      assert.equal(a.productIdentity, undefined);
    } else {
      assert.deepEqual(
        validateIdentification({ artwork: a, record, sourceBytes: bytes }).productIdentity,
        a.productIdentity,
      );
      assert.equal(a.productIdentity.model, null, 'No unsupported exact product model');
    }
  }
  const a = art.find((x) => x.id === 'sonic-4-clipart-metal-mechanical-hand-fan-concept');
  const record = registry.artworks.find((x) => x.id === a.id);
  assert.throws(
    () =>
      validateIdentification({ artwork: a, record, sourceBytes: Buffer.from('replaced image') }),
    /source changed/,
  );
  for (const a of art.filter((x) => x.topic === 'smart-glasses'))
    assert(!/Neural Band|Prescription|Ray.Ban|Meta|Certified/i.test(a.title), a.id);
});

test('completion and repair evidence reports truthful print dimensions and reviewed duplicates', () => {
  assert.equal(review.completedMissing, 18);
  assert.equal(review.replacedCompositions, 14);
  assert.equal(review.repairedPdfs, 8);
  assert.equal(review.drawings.length, 32);
  assert.equal(review.authoredPdfProofs.length, 40);
  assert.equal(review.physicalPrintProof, false);
  assert.equal(review.exactDuplicateReview.status, 'PASS');
  assert.deepEqual(review.exactDuplicateReview.collisions, []);
  assert.equal(review.perceptualReview.status, 'PASS');
  assert(review.perceptualReview.candidates.length > 300);
  for (const pair of review.perceptualReview.candidates) {
    assert.equal(pair.status, 'DISTINCT_COMPOSITION');
    assert.equal(pair.sourceSha256s.length, 2);
  }
  for (const row of review.rows) {
    assert.equal(row.ppi, 300);
    assert.equal(row.pdfAlphaExactToPrintSource, true);
    const drawn = review.drawings.find((x) => x.id === row.id);
    if (drawn) {
      assert.equal(row.pdfAlphaExact, false);
      assert.deepEqual(row.printDimensions, drawn.printDimensions);
      assert.equal(row.printSourceSha256, drawn.printSourceSha256);
      assert(Math.max(...row.printDimensions) <= 850);
      assert(Math.max(...row.dimensions) > Math.max(...row.printDimensions));
    } else assert.equal(row.pdfAlphaExact, true);
  }
});

test('duplicate keyword packages share canonical topics and permanent collection aliases', () => {
  const redirects = readFileSync(resolve(root, 'public/_redirects'), 'utf8');
  const topics = read('data/extra-topics.json');
  for (const [alias, target] of Object.entries({
    'disney-hexed': 'hexed',
    sonic: 'sonic-the-hedgehog',
    'angry-birds-movie': 'angry-birds',
  })) {
    assert(!topics.some((x) => x.slug === alias));
    assert.equal(topics.filter((x) => x.slug === target).length, 1);
    for (const slash of ['', '/'])
      assert(redirects.includes(`/clipart/${alias}${slash} /clipart/${target}/ 301`));
  }
  for (const a of art.filter((x) =>
    ['godzilla-minus-zero', 'sonic-4', 'angry-birds-3'].includes(x.topic),
  ))
    assert(/concept/i.test(a.title), a.id);
});

test('new collection navigation leads to populated subjects in the correct category', () => {
  const catalog = read('data/art.json');
  const publishedTopics = new Set(catalog.map((x) => x.topic));
  const contexts = read('scripts/culture-tech-contexts.json');
  const topics = read('data/extra-topics.json');
  const clusters = read('data/topic-clusters.json');
  assert.equal(new Set(topics.map((x) => x.id)).size, topics.length);
  for (const [slug, context] of Object.entries(contexts)) {
    assert.equal(topics.find((x) => x.slug === slug)?.cluster, context.cluster);
    for (const related of context.related)
      assert(publishedTopics.has(related), `${slug}: empty related subject ${related}`);
  }
  assert.equal(topics.find((x) => x.slug === 'sonic-birthday').cluster, 'Family & celebrations');
  assert(clusters['sonic-birthday'].includes('Arts & entertainment'));
});
