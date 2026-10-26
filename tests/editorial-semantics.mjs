import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {
  copyIssues,
  publicFigureCopyIssues,
  validateEditorialReview,
} from '../scripts/artwork-editorial.mjs';

const catalog = JSON.parse(readFileSync(new URL('../data/art.json', import.meta.url)));
const reviews = JSON.parse(
  readFileSync(new URL('../data/editorial/reviews.json', import.meta.url)),
).artworks;
const people = reviews.filter((record) => record.depiction?.kind === 'public-figure-illustration');

test('a reviewed concise caption does not need padding to a minimum length', () => {
  const copy = {
    title: 'Red Apple with a Leaf',
    alt: 'A red apple with a green leaf on its short stem.',
    description: 'A red apple has a short stem and one green leaf.',
  };
  assert.deepEqual(copyIssues(copy, { reviewed: true }), []);
  assert(copyIssues(copy).includes('description:needs-detail-review'));
  assert(
    copyIssues({ ...copy, description: '' }, { reviewed: true }).includes('description:missing'),
  );
});

test('public-figure copy preserves identity and distinguishes fictional roles from real events', () => {
  assert.equal(people.filter((record) => record.id.startsWith('donald-trump-')).length, 100);
  for (const record of people) {
    const item = catalog.find((row) => row.id === record.id);
    assert.deepEqual(publicFigureCopyIssues(record.copy, record.depiction), [], record.id);
    assert(record.references.length > 0, record.id);
    assert.deepEqual(validateEditorialReview(item, record), record.copy);
  }
  const astronaut = people.find((record) => record.id.includes('astronaut'));
  const astronautItem = catalog.find((item) => item.id === astronaut.id);
  assert.throws(
    () => validateEditorialReview(astronautItem, { ...astronaut, depiction: undefined }),
    /registered subject context/,
  );
  assert.throws(
    () => validateEditorialReview(astronautItem, { ...astronaut, references: [] }),
    /primary reference/,
  );
  assert(
    publicFigureCopyIssues(
      { ...astronaut.copy, description: 'Donald Trump flew to the Moon in a spacesuit.' },
      astronaut.depiction,
    ).includes('depiction:unqualified-fictional-role'),
  );
  assert(
    publicFigureCopyIssues(
      { ...astronaut.copy, description: 'Donald Trump won a historic election in this cartoon.' },
      astronaut.depiction,
    ).includes('depiction:unsupported-event-claim'),
  );
  assert(
    publicFigureCopyIssues(
      { ...astronaut.copy, title: 'A different unnamed astronaut' },
      astronaut.depiction,
    ).includes('depiction:inconsistent-person'),
  );
});

test('line-art labels agree with measured pixels in all 100 public-figure originals', async () => {
  let monochrome = 0;
  for (const record of people) {
    const item = catalog.find((row) => row.id === record.id);
    const bytes = readFileSync(new URL('../public' + item.webp, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.imageSha256, item.id);
    const { data } = await sharp(bytes)
      .resize(256, 256, { fit: 'inside' })
      .toColourspace('srgb')
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let visible = 0,
      colored = 0;
    for (let p = 0; p < data.length; p += 4) {
      if (data[p + 3] < 128) continue;
      visible++;
      if (
        Math.max(data[p], data[p + 1], data[p + 2]) - Math.min(data[p], data[p + 1], data[p + 2]) >
        28
      )
        colored++;
    }
    assert(visible > 100, item.id);
    const isMonochrome = colored / visible <= 0.001;
    assert.equal(isMonochrome, item.style === 'Black & White', item.id);
    const namedLineArt = /\b(?:line art|line drawing|outline|black.and.white)\b/i.test(
      record.copy.title,
    );
    assert.equal(namedLineArt, isMonochrome, item.id);
    if (isMonochrome) monochrome++;
  }
  assert.equal(monochrome, 20);
});
