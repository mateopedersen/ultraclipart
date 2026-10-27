import test from 'node:test';
import assert from 'node:assert/strict';
import { planFavoriteDownload, FAVORITE_ARCHIVE_LIMIT } from '../src/lib/favorite-download-plan.ts';
const item = (id, bytes = 100) => ({
  id,
  title: id,
  alt: id,
  thumb: '/x',
  webp: `/catalog/test/${id}.webp`,
  pdf: `/catalog/test/${id}.pdf`,
  download: {
    files: { webp: { bytes, sha256: 'a'.repeat(64) }, pdf: { bytes: 100, sha256: 'b'.repeat(64) } },
    width: 1,
    height: 1,
    alpha: true,
    pdfPage: 'A4',
    pdfColorSpace: 'CMYK',
  },
});
test('all favorite originals retain names, formats and hashes', () => {
  const plan = planFavoriteDownload([item('first'), item('second')], 'pdf', 'http://localhost');
  assert.equal(plan.files.length, 2);
  assert.equal(plan.parts.length, 1);
  assert.equal(plan.files[0].name, 'first.pdf');
  assert.equal(plan.files[0].sha256, 'b'.repeat(64));
});
test('unavailable and untrusted sources are listed, never silently downloaded', () => {
  const bad = item('bad');
  bad.webp = 'https://invalid.test/file.webp';
  const p = planFavoriteDownload([null, bad, item('good')], 'webp', 'http://localhost');
  assert.equal(p.unavailable.length, 2);
  assert.deepEqual(
    p.files.map((f) => f.id),
    ['good'],
  );
});
test('large collections are partitioned without losing or duplicating any ID', () => {
  const input = Array.from({ length: 260 }, (_, i) => item(`art-${i}`, 1000000));
  const p = planFavoriteDownload(input, 'webp', 'http://localhost');
  assert.deepEqual(
    p.parts.flat().map((i) => i.id),
    input.map((i) => i.id),
  );
  assert.ok(
    p.parts.every(
      (part) =>
        part.length <= 128 && part.reduce((s, f) => s + f.bytes, 0) <= FAVORITE_ARCHIVE_LIMIT,
    ),
  );
});
