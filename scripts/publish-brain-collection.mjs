import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const root = path.resolve(import.meta.dirname, '..');
const stage = path.join(root, 'work/imports/brain-50');
const read = (p) => JSON.parse(fs.readFileSync(p));
const batchPath = path.join(stage, 'brain.r2-batch.json');
while (!fs.existsSync(batchPath)) await delay(2000);
const batch = read(batchPath);
assert.equal(batch.length, 150);
assert.equal(new Set(batch.map((x) => x.assetId)).size, 50);
const prior = path.join(stage, 'publication.prior.json');
if (!fs.existsSync(prior)) fs.copyFileSync(path.join(root, 'data/publication.json'), prior);
const journal = path.join(stage, 'brain.upload-journal.json');
const output = path.join(stage, 'brain.publication.next.json');
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
if (!fs.existsSync(journal)) {
  await run(
    'scripts/r2/ingest.mjs',
    [batchPath, '--transport', 'cloudflare-api', '--workers', '4', '--apply'],
    'brain.upload.log',
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
    path.join(stage, 'art.next.json'),
    '--prior',
    prior,
    '--output',
    output,
  ],
  'brain.cdn.log',
);
console.log(
  JSON.stringify({ status: 'ALL_50_BRAIN_SOURCES_UPLOADED_AND_CDN_VERIFIED', manifest: output }),
);
