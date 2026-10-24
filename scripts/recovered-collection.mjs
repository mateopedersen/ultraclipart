import { createHash } from 'node:crypto';

const hash = (body) => createHash('sha256').update(body).digest('hex');
const safe = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? '');
const requireFact = (condition, message) => {
  if (!condition) throw new Error(message);
};

/** A recovered PDF is a new export, never an unchanged owner-supplied PDF.
 * Publication remains separate: this boundary checks the reviewed local evidence.
 */
export function validateRecoveredCollection(intake, read) {
  requireFact(intake?.schema === 1 && safe(intake.topic), 'Invalid recovery identity');
  requireFact(
    intake.status === 'PASS' &&
      intake.rows?.length === 50 &&
      new Set(intake.rows.map((row) => row.id)).size === 50,
    'A complete reviewed collection of 50 distinct identities is required',
  );
  const screenHashes = new Set();
  for (const row of intake.rows) {
    requireFact(
      safe(row.id) &&
        row.title?.length > 5 &&
        row.alt?.length > 20 &&
        row.description?.length > 30 &&
        ['Color', 'Outline', 'Black & White'].includes(row.style),
      'Missing descriptive artwork metadata',
    );
    requireFact(
      ['owner-supplied', 'generated-raster'].includes(row.productionMethod) &&
        row.visualReview === 'PASS' &&
        row.compositionReview === 'DISTINCT' &&
        row.sourcePairPass === true,
      `Unreviewed source: ${row.id}`,
    );
    const proof = row.print;
    requireFact(
      proof?.components === 4 &&
        proof.colorSpace === 'Device CMYK' &&
        proof.alphaMask === true &&
        proof.registeredCondition === 'CGATS TR 006' &&
        proof.pixelsPerInch === 300 &&
        proof.weightedCmykRmse <= 1.8 &&
        Number.isFinite(proof.weightedCmykRmse) &&
        proof.weightedCmykRmse >= 0 &&
        proof.renderMeanDifference < 18 &&
        Number.isFinite(proof.renderMeanDifference) &&
        proof.width >= 500 &&
        proof.height >= 500,
      `Unverified CMYK export: ${row.id}`,
    );
    for (const [kind, file] of Object.entries(row.files ?? {})) {
      requireFact(['png', 'webp', 'pdf', 'thumb', 'proof'].includes(kind), 'Unknown file kind');
      requireFact(
        typeof file.path === 'string' &&
          file.path.startsWith('work/technology-intake/') &&
          !file.path.split('/').includes('..') &&
          !file.path.includes('\\') &&
          /^[a-f0-9]{64}$/.test(file.sha256) &&
          Number.isSafeInteger(file.bytes),
        'Unsafe or incomplete recovery file',
      );
      const body = read(file.path);
      requireFact(
        body.length === file.bytes && hash(body) === file.sha256,
        `Recovery bytes changed: ${row.id}/${kind}`,
      );
      if (kind === 'pdf')
        requireFact(
          body.length <= 1_000_000 && body.subarray(0, 5).toString() === '%PDF-',
          'Invalid or oversized PDF',
        );
      if (kind === 'webp' || kind === 'thumb')
        requireFact(
          body.subarray(0, 4).toString() === 'RIFF' && body.subarray(8, 12).toString() === 'WEBP',
          'Invalid WebP',
        );
    }
    for (const kind of ['png', 'webp', 'pdf', 'thumb', 'proof'])
      requireFact(row.files?.[kind], 'Incomplete recovery representations');
    requireFact(!screenHashes.has(row.files.webp.sha256), 'Duplicate WebP bytes');
    screenHashes.add(row.files.webp.sha256);
  }
  return intake.rows;
}
