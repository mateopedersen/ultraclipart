import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const stage = path.join(root, 'work/imports/donald-trump-100');
const read = (p) => JSON.parse(fs.readFileSync(p));
async function run(script, args, log) {
  const fd = fs.openSync(path.join(stage, log), 'a');
  try {
    await new Promise((yes, no) => {
      const child = spawn(process.execPath, [script, ...args], {
        cwd: root,
        env: process.env,
        stdio: ['ignore', fd, fd],
      });
      child.once('error', no);
      child.once('exit', (code) =>
        code === 0 ? yes() : no(Error(script + ' failed; inspect ' + log)),
      );
    });
  } finally {
    fs.closeSync(fd);
  }
}
const baseline = read(path.join(root, 'data/art.json'));
const exact = read(path.join(stage, 'duplicate-review.json'));
assert.equal(exact.status, 'PASS');
assert.equal(
  exact.baselineCatalogSha256,
  createHash('sha256')
    .update(fs.readFileSync(path.join(root, 'data/art.json')))
    .digest('hex'),
  'Refresh and re-review concurrent catalog additions first',
);
const supplied = read(path.join(stage, 'art.next.json')).filter(
  (x) => x.sourceCollection === 'owner-donald-trump-100-2026-10-26',
);
assert.equal(supplied.length, 100);
assert(
  !baseline.some((x) => supplied.some((y) => x.id === y.id)),
  'Already promoted; do not overwrite release history',
);
let prior = path.join(root, 'data/publication.json');
for (const wave of [1, 2]) {
  const batchPath = path.join(stage, `wave-${wave}.r2-batch.json`);
  const batch = read(batchPath);
  assert.equal(batch.length, 150);
  assert.equal(new Set(batch.map((x) => x.assetId)).size, 50);
  const journal = path.join(stage, `wave-${wave}.upload-journal.json`);
  const output = path.join(stage, `wave-${wave}.publication.next.json`);
  const catalog = path.join(stage, `wave-${wave}.catalog.next.json`);
  fs.writeFileSync(
    catalog,
    JSON.stringify([...baseline, ...supplied.slice(0, wave * 50)], null, 2) + '\n',
  );
  if (!fs.existsSync(journal)) {
    await run(
      'scripts/r2/ingest.mjs',
      [batchPath, '--transport', 'cloudflare-api', '--workers', '4', '--apply'],
      `wave-${wave}.upload.log`,
    );
    fs.copyFileSync(path.join(root, 'r2-ingest-journal.json'), journal);
  }
  assert.equal(read(journal).status, 'uploaded-and-byte-verified');
  assert.equal(
    read(journal).batchSha256,
    createHash('sha256').update(fs.readFileSync(batchPath)).digest('hex'),
  );
  await run(
    'scripts/r2/prepare-publication.mjs',
    [
      '--batch',
      batchPath,
      '--journal',
      journal,
      '--catalog',
      catalog,
      '--prior',
      prior,
      '--output',
      output,
    ],
    `wave-${wave}.cdn.log`,
  );
  prior = output;
}
console.log(
  JSON.stringify({ status: 'ALL_100_TRUMP_SOURCES_UPLOADED_AND_CDN_VERIFIED', manifest: prior }),
);
