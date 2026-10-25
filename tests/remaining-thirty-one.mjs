import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { packageContexts, packageMetadata } from '../scripts/remaining-thirty-one-copy.mjs';
import { defaults, searchArtwork } from '../src/lib/search.ts';
import { primaryClusterForTopic, clustersForTopic } from '../src/lib/topic-clusters.ts';
import { cuteConfidence } from '../src/lib/cute-discovery.ts';
import { artworkDetails } from '../src/lib/artwork-details.ts';
const read = (path) => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const art = read('data/art.json');
const items = art.filter((x) => x.sourceCollection === 'owner-remaining-thirty-one-2026-10-25');
const topics = Object.keys(packageContexts);
test('new greetings and ordinary objects do not enter cute discovery through keyword matches', () => {
  const approved = read('data/remaining-thirty-one-review.json').discoveryReview.cuteSelections;
  assert.equal(approved.length, 4);
  for (const item of items)
    assert.equal(cuteConfidence(item) > 0, approved.includes(item.id), item.id);
});
test('31 supplied packs preserve 1,550 verified original PDF/WebP pairs', () => {
  const proof = read('data/remaining-thirty-one-review.json');
  assert.equal(items.length, 1550);
  assert.equal(proof.count, 1550);
  assert.equal(proof.archives.length, 31);
  assert.equal(proof.ownerArchives.length, 19);
  assert.equal(proof.screenReviewSheets.length, 62);
  assert.equal(proof.screenReview, 'PASS');
  assert.equal(proof.productIdentityReview.status, 'PASS');
  assert.equal(proof.productIdentityReview.records, 150);
  assert.equal(proof.productIdentityReview.sourceBound, true);
  assert.equal(proof.coverReview.status, 'PASS');
  assert.equal(proof.coverReview.rows.length, 31);
  for (const row of proof.coverReview.rows) {
    assert.equal(row.id, packageContexts[row.topic].cover);
    assert.equal(items.find((item) => item.id === row.id).files.webp.sha256, row.sha256);
  }
  assert.equal(proof.colorReview.status, 'PASS');
  assert.equal(proof.colorReview.checked, 1550);
  assert.equal(proof.colorReview.reviewedFromActualPixels, true);
  assert.equal(proof.colorReview.candidates.length, 16);
  for (const row of proof.colorReview.candidates)
    assert.equal(items.find((item) => item.id === row.id).style, row.reviewedStyle);
  assert.equal(proof.duplicateReview.status, 'PASS');
  assert.equal(proof.duplicateReview.new, 1550);
  assert.deepEqual(proof.duplicateReview.collisions, []);
  const rows = new Map(proof.rows.map((x) => [x.id, x]));
  for (const item of items) {
    const row = rows.get(item.id);
    assert.equal(row.pairedWebp, item.id);
    assert.equal(row.pdfAlphaExact, true);
    assert.equal(row.components, 4);
    assert.equal(row.ppi, 300);
    assert.equal(item.width, 1254);
    assert.equal(item.height, 1254);
    assert.ok(item.files.pdf.bytes <= 1_000_000);
    assert.equal(item.sourceType, 'raster');
    assert.equal(item.svg, null);
    for (const key of ['title', 'alt', 'description', 'style', 'visualStyle'])
      assert.equal(item[key], packageMetadata(item.topic, item.id)[key]);
    assert.deepEqual(
      item.productIdentity,
      packageMetadata(item.topic, item.id, item.files.webp.sha256).productIdentity,
    );
    for (const kind of ['webp', 'pdf', 'thumb']) {
      const bytes = readFileSync(new URL('../public' + item[kind], import.meta.url));
      assert.equal(bytes.length, item.files[kind].bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), item.files[kind].sha256);
      if (kind !== 'thumb') assert.equal(item.files[kind].sha256, row.hashes[kind]);
    }
  }
});
test('all 31 subjects have accurate categories, unique metadata and searchable designs', () => {
  const taxonomy = [...read('data/topics.json').topics, ...read('data/extra-topics.json')];
  const copy = read('data/collection-copy.json');
  for (const [slug, cluster] of [
    ['hat', 'Clothing & accessories'],
    ['earth', 'Space & science'],
    ['electric-car', 'Transport & vehicles'],
  ]) {
    const subject = taxonomy.find((topic) => topic.slug === slug);
    assert.ok(subject, slug);
    assert.ok(clustersForTopic(subject).includes(cluster), slug);
  }
  for (const topic of topics) {
    const group = items.filter((x) => x.topic === topic);
    assert.equal(group.length, 50);
    assert.equal(taxonomy.filter((x) => x.slug === topic).length, 1);
    assert.equal(
      primaryClusterForTopic(taxonomy.find((x) => x.slug === topic)),
      packageContexts[topic].cluster,
    );
    for (const key of ['title', 'alt', 'description'])
      assert.equal(new Set(group.map((x) => x[key])).size, 50);
    for (const secondary of packageContexts[topic].secondary ?? [])
      assert.ok(clustersForTopic(taxonomy.find((x) => x.slug === topic)).includes(secondary));
    assert.ok(copy[topic].related.every((t) => art.some((x) => x.topic === t)));
    assert.ok(copy[topic].featured.every((id) => group.some((x) => x.id === id)));
    assert.equal(copy[topic].featured[0], packageContexts[topic].cover);
    assert.ok(
      !['Outline', 'Black & White'].includes(
        group.find((item) => item.id === copy[topic].featured[0]).style,
      ),
    );
    const found = new Set(
      searchArtwork(art, { ...defaults, q: topic, size: 10000 }).items.map((x) => x.id),
    );
    assert.ok(
      group.every((x) => found.has(x.id)),
      topic,
    );
    for (const chip of copy[topic].chips) {
      assert.ok(!/\b(\w+)\s+\1\b/i.test(chip.query), chip.query);
      assert.ok(
        searchArtwork(art, { ...defaults, q: chip.query, size: 20 }).items.some(
          (x) => x.topic === topic,
        ),
        chip.query,
      );
    }
  }
  assert.equal(read('data/production-queue.json').availableArtworkCount, art.length);
});
test(
  'all 1,550 production pages have canonical URLs, image schema and sitemap entries',
  {
    skip: !existsSync(new URL('../dist/clipart/american-flag/index.html', import.meta.url)),
  },
  () => {
    const text = (path) => readFileSync(new URL('../dist/' + path, import.meta.url), 'utf8');
    const pages = text('sitemap-pages.xml'),
      images = text('sitemap-images.xml');
    for (const topic of topics) {
      const html = text(`clipart/${topic}/index.html`);
      assert.ok(html.includes(`https://ultraclipart.com/clipart/${topic}/`));
      assert.ok(html.includes('"numberOfItems":50'));
      for (const chip of packageContexts[topic].chips)
        assert.ok(html.includes(`/search/?q=${encodeURIComponent(chip)}`), chip);
    }
    for (const item of items) {
      const html = text(`art/${item.id}/index.html`);
      assert.ok(!/<title>[^<]*Clipart Clipart/i.test(html), item.id);
      assert.ok(html.includes(`https://ultraclipart.com/art/${item.id}/`));
      assert.ok(html.includes('ImageObject'));
      const imageSchema = [
        ...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
      ]
        .map((match) => JSON.parse(match[1]))
        .find((schema) => schema['@type'] === 'ImageObject');
      assert.equal(imageSchema.name, item.title, item.id);
      assert.equal(imageSchema.description, item.description, item.id);
      assert.equal(imageSchema.width, item.width);
      assert.equal(imageSchema.height, item.height);
      assert.equal(imageSchema.encodingFormat, 'image/webp');
      assert.ok(!html.includes('content="noindex'));
      for (const format of ['webp', 'pdf']) {
        assert.ok(html.includes(`href="/download/${item.id}/?format=${format}"`));
        const download = text(`download/${item.id}/index.html`);
        assert.ok(download.includes(`download="${item.id}.${format}"`));
        assert.ok(download.includes(`data-expected-sha256="${item.files[format].sha256}"`));
        assert.ok(download.includes(`data-expected-bytes="${item.files[format].bytes}"`));
      }
      assert.ok(pages.includes(`/art/${item.id}/`));
      assert.ok(images.includes(`/art/${item.id}/`));
      assert.ok(text(`edit/${item.id}/index.html`).includes('noindex'));
    }
  },
);

test('reviewed image details replace misleading source filenames', () => {
  const expected = {
    'new-york-clipart-new-york-nypl-lion': /^New York Public Library Lion Statue Clipart$/,
    'new-york-clipart-new-york-nyc-street-corner': /^New York City Street Corner Clipart$/,
    'mom-clipart-mother-newborn-hand-detail': /Newborn Feet/,
    'clock-clipart-candle-clock': /Lit Candle in a Brass Holder/,
    'moon-clipart-lunar-calendar-outline': /Table Mirror/,
    'moon-clipart-moon-cloud-rain-outline': /Hanging Stars/,
    'exercise-clipart-woman-battle-ropes': /^Man Training/,
    'exercise-clipart-man-rowing-machine': /^Older Adult/,
    'shoe-clipart-shoe-on-shoebox-outline': /in an Open Shoebox/,
    'candy-clipart-conversation-heart': /Pastel Heart Candies/,
    'tesla-clipart-battery-factory-installation': /Car Chassis on an Assembly Line/,
  };
  for (const [id, pattern] of Object.entries(expected)) {
    const item = items.find((x) => x.id === id);
    assert.ok(item, id);
    assert.match(item.title, pattern, id);
  }
  for (const id of [
    'thank-you-clipart-ink-botanical-wreath',
    'thank-you-clipart-ink-stamp-thanks',
    'happy-birthday-clipart-script-flourish-birthday-ink',
    'cheese-clipart-cheese-curd-harp-vat',
    'cheese-clipart-cheese-weighing-balance',
    'cheese-clipart-mouse-nibbling-cheese',
  ])
    assert.equal(items.find((x) => x.id === id).style, 'Black & White');
  assert.equal(items.find((x) => x.id === 'wave-clipart-wave-woodcut').style, 'Color');
  assert.equal(
    items.find((x) => x.id === 'wave-clipart-wave-hatching-engraving').style,
    'Black & White',
  );
  assert.equal(
    artworkDetails(items.find((x) => x.id === 'grass-clipart-grass-cartoon-clump')).style,
    'Cartoon illustration',
  );
  for (const id of [
    'math-clipart-abacus-wooden',
    'france-flag-clipart-flag-ceramic-espresso',
    'mexico-flag-clipart-flag-ceramic-mug',
  ])
    assert.equal(artworkDetails(items.find((x) => x.id === id)).style, 'Full-color illustration');
  assert.equal(
    items.find((x) => x.id === 'math-clipart-square-root-cube').title,
    'Square Root of Nine Equals Three Clipart',
  );
  assert.equal(
    items.find((x) => x.id === 'math-clipart-pi-symbol-ribbon').title,
    'Pi Symbol with Vines and a Circle Clipart',
  );
  assert.equal(
    items.find((x) => x.id === 'cheese-clipart-feta-brine-jar').title,
    'Herbed Cheese Cubes in a Jar Clipart',
  );
  for (const item of items) {
    assert.ok(
      !/real generated examples|flux[. ]|100% google|best clipart|ai.generated/i.test(
        [item.title, item.alt, item.description].join(' '),
      ),
      item.id,
    );
    assert.ok(item.alt.length < 420);
  }
});
