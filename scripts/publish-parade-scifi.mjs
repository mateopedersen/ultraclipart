// Stage only: prepare byte-verified per-topic releases. Updating Git and deploying
// remains a separate step after the complete site has passed its tests.
import {
  readFileSync,
  writeFileSync,
  existsSync,
  copyFileSync,
  openSync,
  closeSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { configuredToken } from './r2/cloudflare-api.mjs';

const root = resolve(import.meta.dirname, '..'),
  stage = join(root, 'work/imports/parade-scifi-14');
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const topics = read(join(stage, 'release-map.json')).map((item) => item.topic);
const origin = join(root, 'data/publication.json');
let prior = origin;
async function run(script, args, log) {
  const fd = openSync(log, 'a');
  try {
    await new Promise((accept, reject) => {
      const child = spawn(process.execPath, [script, ...args], {
        cwd: root,
        env: process.env,
        stdio: ['ignore', fd, fd],
      });
      child.once('error', reject);
      child.once('exit', (code, signal) =>
        code === 0
          ? accept()
          : reject(new Error(`${script} stopped (${code ?? signal}); inspect ${log}`)),
      );
    });
  } finally {
    closeSync(fd);
  }
}
for (const topic of topics) {
  const batch = join(stage, topic + '.r2-batch.json'),
    catalog = join(stage, topic + '.catalog.next.json');
  const journal = join(stage, topic + '.upload-journal.json'),
    output = join(stage, topic + '.publication.next.json');
  const deadline = Date.now() + 45 * 60_000;
  while (!existsSync(batch) || !existsSync(catalog)) {
    if (Date.now() > deadline) throw new Error(`Intake preparation did not finish: ${topic}`);
    await delay(1000);
  }
  if (existsSync(output)) {
    const checkpoint = read(output);
    if (
      checkpoint.status !== 'verified' ||
      !existsSync(journal) ||
      read(journal).batchSha256 !== hash(batch)
    )
      throw new Error(`Invalid saved release: ${topic}`);
    prior = output;
    console.log(JSON.stringify({ topic, status: 'RESUMED_VERIFIED_RELEASE' }));
    continue;
  }
  if (!existsSync(journal)) {
    try {
      configuredToken();
    } catch {
      await run(
        'node_modules/wrangler/bin/wrangler.js',
        ['whoami'],
        join(root, 'work/wrangler-refresh.log'),
      );
    }
    await run(
      'scripts/r2/ingest.mjs',
      [batch, '--transport', 'cloudflare-api', '--workers', '4', '--apply'],
      join(stage, topic + '.upload.log'),
    );
    copyFileSync(join(root, 'r2-ingest-journal.json'), journal);
  }
  if (
    read(journal).status !== 'uploaded-and-byte-verified' ||
    read(journal).batchSha256 !== hash(batch)
  )
    throw new Error(`Incomplete upload journal: ${topic}`);
  await run(
    'scripts/r2/prepare-publication.mjs',
    [
      '--batch',
      batch,
      '--journal',
      journal,
      '--catalog',
      catalog,
      '--prior',
      prior,
      '--output',
      output,
    ],
    join(stage, topic + '.cdn.log'),
  );
  prior = output;
  writeFileSync(
    join(stage, 'publication-progress.json'),
    JSON.stringify(
      { topic, status: 'VERIFIED_NOT_DEPLOYED', manifest: output, at: new Date().toISOString() },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      topic,
      status: 'R2_AND_CDN_VERIFIED',
      artworks: read(catalog).length,
      bytes: read(output).bytes,
    }),
  );
}
console.log(JSON.stringify({ status: 'ALL_PACKAGE_RELEASES_VERIFIED', manifest: prior }));
