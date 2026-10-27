import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { imageFileSignature } from '../scripts/seo/image-file-signature.mjs';
import { imageObject, IMAGE_COPYRIGHT, IMAGE_LICENSE } from '../src/lib/image-schema.ts';
import {
  attachImageMetadata,
  createImageIndex,
  htmlElements,
  imageSchemas,
  deferLargeStructuredData,
} from '../scripts/seo/image-seo.mjs';
import { previewUrls, previewIdentity } from '../scripts/preview-assets.mjs';

const item = JSON.parse(readFileSync(new URL('../data/art.json', import.meta.url)))[0];
const previewIndex = { [previewIdentity(item)]: { files: { 440: { width: 440, height: 440 } } } };
const urls = previewUrls(item);
const index = createImageIndex([item], { previewIndex });
const image = `<img src="${urls[440]}" alt="a real rendered image" title="A title" width="440" height="440">`;
const page = (body = image, head = '') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
test('large head metadata follows visible content without changing schemas or executable scripts', () => {
  const large = `<script id="large" type="application/ld+json">${JSON.stringify({ description: 'image details '.repeat(500) })}</script>`;
  const small = '<script type="application/ld+json">{"@type":"WebSite"}</script>';
  const executable = `<script>const long = '${'text'.repeat(2000)}';</script>`;
  const input = page('<h1>Visible content</h1>', small + large + executable);
  const result = deferLargeStructuredData(input);
  assert.ok(result.indexOf('<h1>') < result.indexOf(large));
  assert.ok(result.includes(large + '</body>'));
  assert.ok(result.indexOf(executable) < result.indexOf('</head>'));
  assert.ok(result.indexOf(small) < result.indexOf('</head>'));
  assert.equal(deferLargeStructuredData(result), result);
  assert.deepEqual(
    htmlElements(input)
      .filter((e) => e.name === 'script')
      .map((e) => e.text)
      .sort(),
    htmlElements(result)
      .filter((e) => e.name === 'script')
      .map((e) => e.text)
      .sort(),
  );
});
function schemas(html) {
  return htmlElements(html)
    .filter((e) => e.name === 'script' && e.attributes.type === 'application/ld+json')
    .flatMap((e) => imageSchemas(JSON.parse(e.text)));
}
test('original and screen image metadata share truthful identity, caption and qualified rights', () => {
  const original = imageObject(item, { primary: true, context: true });
  assert.equal(original.name, item.title);
  assert.equal(original.caption, item.alt);
  assert.equal(original.description, item.description);
  assert.equal(original.contentUrl, `https://ultraclipart.com${item.webp}`);
  assert.equal(original.creator.name, 'UltraClipart');
  assert.equal(original.copyrightNotice, IMAGE_COPYRIGHT);
  assert.ok(original.copyrightNotice.includes('third-party rights'));
  assert.equal(original.acquireLicensePage, IMAGE_LICENSE);
  assert.equal(original.representativeOfPage, true);
  const thumbnail = imageObject(item, { contentUrl: urls[440], width: 440, height: 440 });
  assert.equal(thumbnail.width, 440);
  assert.equal(thumbnail.isBasedOn['@id'], original['@id']);
  assert.equal(thumbnail.representativeOfPage, undefined);
  const unknownDimensions = imageObject(item, { width: null, height: null });
  assert.ok(!Object.hasOwn(unknownDimensions, 'width'));
});
test('only actual informative catalog images receive deduplicated metadata; repeated runs are identical', () => {
  const html = page(
    image +
      image +
      '<img src="/portrait.webp" alt="Team member"><img src="/decorative.svg" alt="">',
  );
  const result = attachImageMetadata(html, index);
  assert.equal(result.added, 1);
  assert.equal(result.images, 1);
  const nodes = schemas(result.html);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].contentUrl, `https://ultraclipart.com${urls[440]}`);
  assert.equal(nodes[0].caption, item.alt);
  assert.equal(attachImageMetadata(result.html, index).html, result.html);
});
test('robots exclusions, drafts and unpublished images stay out of generated graphs', () => {
  for (const robots of ['noindex,follow', 'none'])
    assert.equal(
      attachImageMetadata(page(image, `<meta name="robots" content="${robots}">`), index).added,
      0,
    );
  for (const changed of [{ published: false }, { indexable: false }])
    assert.equal(
      attachImageMetadata(page(), createImageIndex([{ ...item, ...changed }], { previewIndex }))
        .added,
      0,
    );
});
test('new approved artwork flows into the next build automatically without a manual page list', () => {
  const next = {
    ...item,
    id: 'future-reviewed-original',
    webp: '/future/original.webp',
    thumb: '/future/thumb.webp',
    title: 'A reviewed new subject',
    alt: 'The visible new subject.',
    description: 'A newly reviewed illustration.',
  };
  const nextIndex = createImageIndex([next]);
  const result = attachImageMetadata(
    page('<img src="/future/original.webp" alt="The visible new subject.">'),
    nextIndex,
  );
  assert.equal(result.added, 1);
  assert.equal(schemas(result.html)[0].name, next.title);
});
test('exact approved CDN URLs and verified derivatives resolve to the same reviewed catalog record', () => {
  const cdn = 'https://assets.ultraclipart.com/verified/a.webp';
  const cdnIndex = createImageIndex([item], {
    publishedAssets: { [item.id]: { webp: cdn } },
    previewIndex,
  });
  const result = attachImageMetadata(page(), cdnIndex);
  assert.equal(schemas(result.html)[0].isBasedOn['@id'], imageObject(item)['@id']);
  assert.equal(cdnIndex.get(cdn).item.id, item.id);
  assert.equal(cdnIndex.get(`https://ultraclipart.com${urls[440]}`).item.webp, cdn);
});
test('raw script/style/textarea/template/comment markup is not indexed as a displayed image', () => {
  const html =
    page(`<!-- ${image} --><script>const example = '${image}'</script><style>/* ${image} */</style>
    <textarea>${image}</textarea><template>${image}<template>${image}</template></template>`);
  assert.equal(attachImageMetadata(html, index).added, 0);
  const elements = htmlElements(
    '<img data-src="wrong" src="/real.webp" alt="A &amp; B > C" title=Title>',
  );
  assert.equal(elements[0].attributes.src, '/real.webp');
  assert.equal(elements[0].attributes.alt, 'A & B > C');
});
test('catalog metadata cannot close a script element or inject HTML', () => {
  const malicious = {
    ...item,
    title: '</script><img src=x>',
    alt: 'A < B & C',
    description: 'Safe > text',
  };
  const result = attachImageMetadata(page(), createImageIndex([malicious], { previewIndex }));
  assert.equal(schemas(result.html)[0].name, malicious.title);
  assert.equal((result.html.match(/<img\b/g) || []).length, 1);
  assert.ok(result.html.includes('\\u003c/script\\u003e'));
});
test('an existing original ImageObject is retained without adding another copy', () => {
  const existing = `<script type="application/ld+json">${JSON.stringify(imageObject(item))}</script>`;
  const result = attachImageMetadata(
    page(`<img src="${item.webp}" alt="Original image">`, existing),
    index,
  );
  assert.equal(result.added, 0);
  assert.equal(schemas(result.html).length, 1);
});

test('image format checks reject an HTML error body and a misleading PNG filename', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ultraclipart-image-seo-'));
  try {
    const file = join(directory, 'example.png');
    writeFileSync(file, '<html><body>Not found</body></html>');
    assert.equal(imageFileSignature(file).valid, false);
    writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    assert.equal(imageFileSignature(file).valid, false);
    writeFileSync(file, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(imageFileSignature(file).valid, true);
    const svg = join(directory, 'example.svg');
    writeFileSync(svg, '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
    assert.equal(imageFileSignature(svg).valid, true);
    assert.equal(imageFileSignature('public' + item.webp).valid, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
