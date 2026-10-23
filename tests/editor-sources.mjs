import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { validateEditorSource } from '../src/lib/artwork-source.ts';
import { verifiedSourceUrl } from '../src/editor/source-policy.ts';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const catalog = JSON.parse(read('data/art.json'));
const raster = catalog.find((a) => a.sourceType === 'raster');

test('every catalog source is editable without a topic-specific feature switch', () => {
  for (const art of catalog) assert.equal(validateEditorSource(art), art.sourceType ?? 'layered');
  const future = {
    ...raster,
    id: 'future-landscape',
    topic: 'new-topic',
    width: 2048,
    height: 1024,
  };
  assert.equal(validateEditorSource(future), 'raster');
  for (const patch of [
    { width: 0 },
    { height: 4097 },
    { sourceType: 'unknown' },
    { pdf: null },
    { files: { ...raster.files, webp: { bytes: 100, sha256: 'unverified' } } },
  ])
    assert.throws(() => validateEditorSource({ ...future, ...patch }));
});

test('catalog image requests support any collection but reject foreign origins, wrong formats and invalid identities', () => {
  const origin = 'https://ultraclipart.com';
  const file = { bytes: 1024, sha256: 'a'.repeat(64) };
  for (const url of [
    '/catalog/flowers/pink-peony.webp',
    '/catalog/wave_003/winter.webp',
    'https://assets.ultraclipart.com/flowers/pink-peony.aaaaaaaaaaaaaaaa.webp',
  ])
    assert.equal(
      verifiedSourceUrl({ ...file, url }, 'webp', origin).pathname.endsWith('.webp'),
      true,
    );
  for (const url of [
    'https://attacker.invalid/catalog/a.webp',
    'data:image/webp;base64,aaaa',
    '/account/a.webp',
    '/catalog/x/a.pdf',
    '/catalog/x/a.webp?url=other',
    '/catalog/x/a.webp#other',
    'https://user:pass@assets.ultraclipart.com/a.webp',
    '/catalog/x/%2e%2e/a.webp',
  ])
    assert.throws(() => verifiedSourceUrl({ ...file, url }, 'webp', origin));
  assert.throws(() =>
    verifiedSourceUrl({ ...file, url: '/catalog/a.pdf', bytes: 1_000_001 }, 'pdf', origin),
  );
});

test(
  'every built artwork has the correct editor route, adapter and download pair',
  { skip: !existsSync(new URL('../dist', import.meta.url)) },
  () => {
    for (const art of catalog) {
      const detail = read(`dist/art/${art.id}/index.html`);
      assert.ok(detail.includes(`href="/edit/${art.id}/"`), `missing Edit link: ${art.id}`);
      const editor = read(`dist/edit/${art.id}/index.html`);
      assert.ok(editor.includes(`data-art-id="${art.id}"`));
      assert.match(editor, /<meta name="robots" content="noindex/);
      if (art.sourceType === 'raster') {
        assert.match(editor, /data-raster-source=/);
        assert.ok(editor.includes(art.files.webp.sha256));
        assert.ok(editor.includes(art.files.pdf.sha256));
        assert.match(editor, /data-composition="true"/);
      } else {
        assert.match(editor, /data-source="[^\"]+\.svg"/);
        assert.doesNotMatch(editor, /data-raster-source=/);
      }
    }
  },
);
