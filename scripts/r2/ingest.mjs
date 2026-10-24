#!/usr/bin/env node
// Existing CLI login/environment owns authentication; never accept credential flags.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  readFileSync,
  writeFileSync,
  renameSync,
  openSync,
  closeSync,
  unlinkSync,
  mkdtempSync,
  rmSync,
  realpathSync,
} from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { buildPlan, validateBatch, enforceStorageBudget, HARD_CAP } from './plan.mjs';
import { configuredToken, cloudflareTransport } from './cloudflare-api.mjs';
import {
  measureAccount,
  proveEmptyJurisdiction,
  parseEndpoint,
  jurisdictionOf,
  objectIdentity,
} from './inventory.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const usage =
  'node scripts/r2/ingest.mjs batch.json [--transport s3|cloudflare-api] [--inventory measured-inventory.json] [--verify-absent-scopes] [--workers 1-4] [--max-account-bytes N] [--apply]';
const args = process.argv.slice(2);
if (!args[0] || args.includes('--help')) {
  console.log(usage);
  process.exit(args.includes('--help') ? 0 : 1);
}
const batchPath = resolve(args.shift());
let apply = false;
let verifyAbsentScopes = false;
let inventoryPath;
let transport = 's3';
let workers = 1;
let storageBudget = HARD_CAP;
while (args.length) {
  const flag = args.shift();
  if (flag === '--apply') apply = true;
  else if (flag === '--verify-absent-scopes') verifyAbsentScopes = true;
  else if (flag === '--inventory' && args[0] && !args[0].startsWith('--'))
    inventoryPath = resolve(args.shift());
  else if (flag === '--transport' && ['s3', 'cloudflare-api'].includes(args[0]))
    transport = args.shift();
  else if (flag === '--workers' && /^[1-4]$/.test(args[0] ?? '')) workers = Number(args.shift());
  else if (flag === '--max-account-bytes' && /^\d+$/.test(args[0] ?? ''))
    storageBudget = Number(args.shift());
  else throw new Error(`Unknown argument: ${flag}`);
}
enforceStorageBudget({ projectedBytes: 0 }, storageBudget);
const budgetedPlan = (inventory) =>
  enforceStorageBudget(buildPlan(inventory, batch), storageBudget);
if (apply && inventoryPath)
  throw new Error('Apply requires fresh direct account inventory, never a saved snapshot');
const batch = validateBatch(JSON.parse(readFileSync(batchPath, 'utf8')));
if (new Set(batch.map((x) => x.assetId)).size > 50)
  throw new Error('At most 50 artworks per reviewed production wave');
const projectRoot = realpathSync(process.cwd());
const contents = new Map();
for (const object of batch) {
  const path = realpathSync(resolve(object.path));
  if (!path.startsWith(`${projectRoot}/`))
    throw new Error('Media must be located within the current project');
  const bytes = readFileSync(path);
  if (bytes.length !== object.bytes || sha(bytes) !== object.sha256)
    throw new Error(`Local checksum mismatch for ${object.key}`);
  if (
    object.kind === 'pdf' &&
    (extname(path) !== '.pdf' || !bytes.subarray(0, 5).equals(Buffer.from('%PDF-')))
  )
    throw new Error('Invalid PDF signature');
  if (
    ['webp', 'thumbnail'].includes(object.kind) &&
    (extname(path) !== '.webp' ||
      bytes.toString('ascii', 0, 4) !== 'RIFF' ||
      bytes.toString('ascii', 8, 12) !== 'WEBP')
  )
    throw new Error('Invalid WebP signature');
  if (
    object.kind === 'svg' &&
    (extname(path) !== '.svg' ||
      !/<svg[\s>]/.test(bytes.toString('utf8')) ||
      /<\s*(script|foreignObject|iframe)\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["'](?:https?:|data:|javascript:)/i.test(
        bytes.toString('utf8'),
      ))
  )
    throw new Error('Unsafe or invalid SVG; rerun full source preflight');
  contents.set(objectIdentity(object), { path, bytes });
}
const endpoint = process.env.R2_ENDPOINT;
if (!inventoryPath) {
  const target = parseEndpoint(endpoint);
  if (batch.some((object) => jurisdictionOf(object) !== target.jurisdiction))
    throw new Error('Batch jurisdiction must match the target R2_ENDPOINT');
}
let reads = 0;
let writes = 0;
const rest =
  transport === 'cloudflare-api'
    ? cloudflareTransport({
        accountId: parseEndpoint(endpoint).accountId,
        token: configuredToken(),
        writeBucket: process.env.R2_WRITE_BUCKET,
        requestIntervalMs: 550,
      })
    : null;
async function aws(command, fields = [], requestEndpoint = endpoint) {
  if (rest) {
    const result = await rest.aws(command, fields, requestEndpoint);
    command === 'put-object' ? writes++ : reads++;
    return result;
  }
  try {
    const stdout = execFileSync(
      'aws',
      [
        's3api',
        command,
        ...fields,
        '--endpoint-url',
        requestEndpoint,
        '--region',
        'auto',
        '--output',
        'json',
        '--no-cli-pager',
      ],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    command === 'put-object' ? writes++ : reads++;
    return stdout.trim() ? JSON.parse(stdout) : {};
  } catch {
    throw new Error(
      `AWS CLI ${command} failed; check scoped credentials and connectivity (credential-bearing output suppressed)`,
    );
  }
}
async function measure() {
  const options = {
    endpoint,
    batch,
    aws,
    ...(rest ? { proveAbsent: rest.proveAbsent, enumerationSource: rest.enumerationSource } : {}),
    ...(!rest && verifyAbsentScopes
      ? {
          proveAbsent: (accountId, jurisdiction) =>
            proveEmptyJurisdiction({
              accountId,
              jurisdiction,
              token: process.env.R2_ACCOUNT_READ_TOKEN,
            }),
        }
      : {}),
  };
  // A cold resume may spend most of the freshness window hashing existing
  // objects. Keep that verified ETag cache, then enumerate again; never extend
  // the inventory's age or pretend the first slow snapshot is fresh.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const inventory = await measureAccount(options);
      if (Date.now() - inventory.observedAt <= 45_000) return inventory;
      if (attempt === 2) throw new Error('Fresh all-account inventory could not finish in time');
    } catch (error) {
      if (
        attempt === 2 ||
        ![
          'Invalid disabled-jurisdiction capability proof',
          'An inaccessible enabled jurisdiction must block ingestion',
        ].includes(error.message)
      )
        throw error;
      await delay(2500 * (attempt + 1));
    }
  }
}
let lock;
const lockPath = resolve('.r2-ingest.lock');
const journalPath = resolve('r2-ingest-journal.json');
const verificationDir = mkdtempSync(join(tmpdir(), 'ultraclipart-r2-'));
function checkpoint(value) {
  const temp = `${journalPath}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temp, journalPath);
}
try {
  if (apply) {
    lock = openSync(lockPath, 'wx', 0o600);
    writeFileSync(lock, String(process.pid));
  }
  const inventory = inventoryPath
    ? JSON.parse(readFileSync(inventoryPath, 'utf8'))
    : await measure();
  let plan = budgetedPlan(inventory);
  let reservedAt = inventory.observedAt;
  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        measuredBytes: plan.measuredBytes,
        additionalBytes: plan.additionalBytes,
        projectedBytes: plan.projectedBytes,
        warning: plan.warning,
        artworks: plan.artworkIds.length,
        uploadObjects: plan.upload.length,
        verificationObjects: plan.verify.length,
      },
      null,
      2,
    ),
  );
  if (apply) {
    const journal = {
      schemaVersion: 2,
      inventoryScope: {
        accountId: inventory.accountId,
        scopeVersion: inventory.scopeVersion,
        observedAt: inventory.observedAt,
        jurisdictions: inventory.jurisdictions,
      },
      batchSha256: sha(readFileSync(batchPath)),
      startedAt: new Date().toISOString(),
      status: 'uploading',
      verifiedObjects: [],
      verifiedArtworkIds: [],
      publishApproved: false,
    };
    checkpoint(journal);
    const artworkIds = [...plan.artworkIds];
    for (let offset = 0; offset < artworkIds.length; offset += workers) {
      const group = artworkIds.slice(offset, offset + workers);
      // Reserve the entire remaining batch against an all-account inventory,
      // renewing within 30 seconds before a bounded group starts. One exclusive writer owns this reservation;
      // other machines must serialize uploaders against the same account as well.
      if (
        Date.now() - reservedAt >= 30_000 &&
        plan.upload.some((object) => group.includes(object.assetId))
      ) {
        const fresh = await measure();
        plan = budgetedPlan(fresh);
        reservedAt = fresh.observedAt;
      }
      async function ingestOne(id) {
        const formats = await Promise.allSettled(
          batch
            .filter((candidate) => candidate.assetId === id)
            .map(async (object) => {
              if (
                plan.upload.some(
                  (candidate) => objectIdentity(candidate) === objectIdentity(object),
                )
              ) {
                const mime =
                  object.kind === 'pdf'
                    ? 'application/pdf'
                    : object.kind === 'svg'
                      ? 'image/svg+xml'
                      : 'image/webp';
                const uploadSnapshot = join(verificationDir, `upload-${object.sha256}`);
                writeFileSync(uploadSnapshot, contents.get(objectIdentity(object)).bytes, {
                  mode: 0o600,
                });
                await aws('put-object', [
                  '--bucket',
                  object.bucket,
                  '--key',
                  object.key,
                  '--body',
                  uploadSnapshot,
                  '--storage-class',
                  'STANDARD',
                  '--content-type',
                  mime,
                  '--cache-control',
                  'public,max-age=31536000,immutable',
                  '--metadata',
                  JSON.stringify({ sha256: object.sha256, 'artwork-id': object.assetId }),
                  '--if-none-match',
                  '*',
                  ...(object.kind === 'pdf'
                    ? ['--content-disposition', `attachment; filename="${object.assetId}.pdf"`]
                    : []),
                ]);
              }
              const downloaded = join(verificationDir, `object-${object.sha256}`);
              await aws('get-object', ['--bucket', object.bucket, '--key', object.key, downloaded]);
              const actual = readFileSync(downloaded);
              if (actual.length !== object.bytes || sha(actual) !== object.sha256)
                throw new Error(`Remote checksum mismatch for ${object.key}`);
              journal.verifiedObjects.push({
                jurisdiction: jurisdictionOf(object),
                bucket: object.bucket,
                key: object.key,
                sha256: object.sha256,
                bytes: object.bytes,
              });
              checkpoint(journal);
            }),
        );
        // Keep the exclusive writer lock until every sibling transfer settles,
        // even when one format fails. Resume verifies any successful immutable PUTs.
        const failure = formats.find((result) => result.status === 'rejected');
        if (failure) throw failure.reason;
        journal.verifiedArtworkIds.push(id);
        checkpoint(journal);
      }
      // Do not release the writer lock while any request in this group is pending.
      const results = await Promise.allSettled(group.map(ingestOne));
      const failed = results.find((result) => result.status === 'rejected');
      if (failed) throw failed.reason;
    }
    const finalInventory = await measure();
    const final = budgetedPlan(finalInventory);
    if (final.upload.length)
      throw new Error('Final inventory is missing batch objects; publication remains unverified');
    journal.inventoryScope = {
      accountId: finalInventory.accountId,
      scopeVersion: finalInventory.scopeVersion,
      observedAt: finalInventory.observedAt,
      jurisdictions: finalInventory.jurisdictions,
    };
    journal.status = 'uploaded-and-byte-verified';
    journal.completedAt = new Date().toISOString();
    journal.aggregateBytes = final.measuredBytes;
    journal.operationCalls = { reads, writes };
    checkpoint(journal);
    console.log('All objects verified. Editorial publication remains a separate reviewed step.');
  }
} finally {
  rmSync(verificationDir, { recursive: true, force: true });
  if (lock !== undefined) {
    closeSync(lock);
    unlinkSync(lockPath);
  }
}
