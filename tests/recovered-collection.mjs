import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateRecoveredCollection } from '../scripts/recovered-collection.mjs';

function fixture() {
  const bodies = new Map();
  const rows = Array.from({ length: 50 }, (_, n) => {
    const files = {};
    for (const kind of ['png', 'webp', 'pdf', 'thumb', 'proof']) {
      const body = Buffer.from(
        kind === 'pdf'
          ? `%PDF-1.7 ${n}`
          : kind === 'webp' || kind === 'thumb'
            ? `RIFF0000WEBP${n}`
            : `PNG ${n}`,
      );
      const path = `work/technology-intake/test/${n}.${kind}`;
      bodies.set(path, body);
      files[kind] = {
        path,
        bytes: body.length,
        sha256: createHash('sha256').update(body).digest('hex'),
      };
    }
    return {
      id: `headphones-${n}`,
      title: `Headphones ${n}`,
      alt: 'Blue padded headphones with a separate audio cable.',
      description: 'Blue padded headphones with a separate audio cable for personal projects.',
      style: 'Color',
      productionMethod: 'owner-supplied',
      visualReview: 'PASS',
      compositionReview: 'DISTINCT',
      sourcePairPass: true,
      print: {
        components: 4,
        colorSpace: 'Device CMYK',
        alphaMask: true,
        registeredCondition: 'CGATS TR 006',
        pixelsPerInch: 300,
        weightedCmykRmse: 1.1,
        renderMeanDifference: 4,
        width: 1000,
        height: 1000,
      },
      files,
    };
  });
  return {
    intake: { schema: 1, topic: 'headphones', status: 'PASS', rows },
    bodies,
    read: (path) => bodies.get(path),
  };
}
test('complete reviewed recovery accepts new CMYK exports without claiming original PDFs', () => {
  const f = fixture();
  assert.equal(validateRecoveredCollection(f.intake, f.read).length, 50);
});
test('recovery rejects incomplete collections, RGB, unreviewed art, changed bytes and cross-wired sources', () => {
  for (const mutate of [
    (f) => f.intake.rows.pop(),
    (f) => {
      f.intake.rows[0].print.components = 3;
    },
    (f) => {
      f.intake.rows[0].visualReview = 'PENDING';
    },
    (f) => {
      f.intake.rows[0].files.webp = f.intake.rows[1].files.webp;
    },
    (f) => {
      f.intake.rows[0].files.png.path = '../outside.png';
    },
    (f) => {
      f.bodies.set(f.intake.rows[0].files.pdf.path, Buffer.from('%PDF-edited'));
    },
    (f) => {
      f.intake.rows[0].print.weightedCmykRmse = NaN;
    },
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => validateRecoveredCollection(f.intake, f.read));
  }
});
test('even a hash-consistent PDF over the hard byte cap is rejected', () => {
  const f = fixture(),
    row = f.intake.rows[0],
    body = Buffer.alloc(1_000_001);
  body.write('%PDF-1.7');
  f.bodies.set(row.files.pdf.path, body);
  row.files.pdf.bytes = body.length;
  row.files.pdf.sha256 = createHash('sha256').update(body).digest('hex');
  assert.throws(() => validateRecoveredCollection(f.intake, f.read), /oversized/);
});
