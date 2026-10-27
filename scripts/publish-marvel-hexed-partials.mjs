// Serialize the final 28 ready sources after the preceding reviewed package's writer.
import { configuredToken } from './r2/cloudflare-api.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const root = path.resolve(import.meta.dirname, '..'),
  stage = path.join(root, 'work/imports/marvel-hexed-4'),
  preceding = path.join(root, 'work/imports/parade-scifi-14/mockingjay.publication.next.json'),
  read = (p) => JSON.parse(fs.readFileSync(p)),
  sha = (b) => createHash('sha256').update(b).digest('hex');
while (
  !fs.existsSync(preceding) ||
  !fs.existsSync(path.join(stage, 'art.next.json')) ||
  read(path.join(stage, 'art.next.json')).filter(
    (x) => x.sourceCollection === 'owner-marvel-hexed-partials-2026-10-26',
  ).length !== 28
)
  await delay(2000);
const maps = read(path.join(stage, 'release-map.json')),
  batch = maps.flatMap((m) => read(path.join(stage, m.topic + '.r2-batch.json')));
if (batch.length !== 84 || new Set(batch.map((x) => x.assetId)).size !== 28)
  throw Error('Incomplete ready-source batch');
const batchPath = path.join(stage, 'all.r2-batch.json'),
  journal = path.join(stage, 'all.upload-journal.json'),
  output = path.join(stage, 'all.publication.next.json');
fs.writeFileSync(batchPath, JSON.stringify(batch, null, 2) + '\n');
async function run(script, args, log) {
  const fd = fs.openSync(path.join(stage, log), 'a');
  try {
    await new Promise((yes, no) => {
      const c = spawn(process.execPath, [script, ...args], {
        cwd: root,
        env: process.env,
        stdio: ['ignore', fd, fd],
      });
      c.once('error', no);
      c.once('exit', (code) =>
        code === 0 ? yes() : no(Error(script + ' failed; inspect ' + log)),
      );
    });
  } finally {
    fs.closeSync(fd);
  }
}
if (!fs.existsSync(journal)) {
  try {
    configuredToken();
  } catch {
    await run('node_modules/wrangler/bin/wrangler.js', ['whoami'], 'wrangler-refresh.log');
  }
  await run(
    'scripts/r2/ingest.mjs',
    [batchPath, '--transport', 'cloudflare-api', '--workers', '4', '--apply'],
    'all.upload.log',
  );
  fs.copyFileSync(path.join(root, 'r2-ingest-journal.json'), journal);
}
if (
  read(journal).status !== 'uploaded-and-byte-verified' ||
  read(journal).batchSha256 !== sha(fs.readFileSync(batchPath))
)
  throw Error('Incomplete upload journal');
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
    preceding,
    '--output',
    output,
  ],
  'all.cdn.log',
);
console.log(
  JSON.stringify({ status: 'ALL_28_READY_SOURCES_UPLOADED_AND_CDN_VERIFIED', manifest: output }),
);
