#!/usr/bin/env node
// AWS CLI owns authentication. Credentials are never accepted in command-line flags.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { buildPlan, validateBatch } from './plan.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const usage = 'node scripts/r2/ingest.mjs batch.json [--inventory measured-inventory.json] [--apply]';
const args = process.argv.slice(2);
if (!args[0] || args.includes('--help')) { console.log(usage); process.exit(args.includes('--help') ? 0 : 1); }
const batchPath = resolve(args.shift());
let apply = false;
let inventoryPath;
while (args.length) {
  const flag = args.shift();
  if (flag === '--apply') apply = true;
  else if (flag === '--inventory' && args[0] && !args[0].startsWith('--')) inventoryPath = resolve(args.shift());
  else throw new Error(`Unknown argument: ${flag}`);
}
if (apply && inventoryPath) throw new Error('Apply requires fresh direct account inventory, never a saved snapshot');
const batch = validateBatch(JSON.parse(readFileSync(batchPath, 'utf8')));
if (new Set(batch.map(x => x.assetId)).size > 50) throw new Error('At most 50 artworks per reviewed production wave');
const projectRoot = realpathSync(process.cwd());
const contents = new Map();
for (const object of batch) {
  const path = realpathSync(resolve(object.path));
  if (!path.startsWith(`${projectRoot}/`)) throw new Error('Media must be located within the current project');
  const bytes = readFileSync(path);
  if (bytes.length !== object.bytes || sha(bytes) !== object.sha256) throw new Error(`Local checksum mismatch for ${object.key}`);
  if (object.kind === 'pdf' && (extname(path) !== '.pdf' || !bytes.subarray(0, 5).equals(Buffer.from('%PDF-')))) throw new Error('Invalid PDF signature');
  if (['webp', 'thumbnail'].includes(object.kind) && (extname(path) !== '.webp' || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP')) throw new Error('Invalid WebP signature');
  if (object.kind === 'svg' && (extname(path) !== '.svg' || !/<svg[\s>]/.test(bytes.toString('utf8')) || /<\s*(script|foreignObject|iframe)\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["'](?:https?:|data:|javascript:)/i.test(bytes.toString('utf8')))) throw new Error('Unsafe or invalid SVG; rerun full source preflight');
  contents.set(object.key, { path, bytes });
}
const endpoint = process.env.R2_ENDPOINT;
if (!inventoryPath && (!endpoint || !/^https:\/\/[a-f0-9]{32}(?:\.(?:eu|fedramp))?\.r2\.cloudflarestorage\.com$/.test(endpoint))) throw new Error('Set R2_ENDPOINT to the account S3 endpoint');
let reads = 0;
let writes = 0;
function aws(command, fields = []) {
  try {
    const stdout = execFileSync('aws', ['s3api', command, ...fields, '--endpoint-url', endpoint, '--region', 'auto', '--output', 'json', '--no-cli-pager'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    command === 'put-object' ? writes++ : reads++;
    return stdout.trim() ? JSON.parse(stdout) : {};
  } catch {
    throw new Error(`AWS CLI ${command} failed; check scoped credentials and connectivity (credential-bearing output suppressed)`);
  }
}
function measure() {
  const list = aws('list-buckets');
  if (!Array.isArray(list.Buckets) || list.Buckets.length === 0) throw new Error('Complete account bucket enumeration unavailable');
  const buckets = [];
  for (const item of list.Buckets) {
    const objects = [];
    let token;
    const seenTokens = new Set();
    do {
      const page = aws('list-objects-v2', ['--bucket', item.Name, '--max-keys', '1000', '--no-paginate', ...(token ? ['--continuation-token', token] : [])]);
      if (page.IsTruncated !== true && page.IsTruncated !== false) throw new Error('Uncertain bucket pagination');
      for (const entry of page.Contents ?? []) {
        const object = { key: entry.Key, bytes: entry.Size };
        if (batch.some(candidate => candidate.bucket === item.Name && candidate.key === entry.Key)) {
          const head = aws('head-object', ['--bucket', item.Name, '--key', entry.Key]);
          object.sha256 = head.Metadata?.sha256;
        }
        objects.push(object);
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
      if (page.IsTruncated && (!token || seenTokens.has(token))) throw new Error('Incomplete or looping bucket pagination');
      if (token) seenTokens.add(token);
    } while (token);
    buckets.push({ name: item.Name, complete: true, objects });
  }
  return { complete: true, observedAt: Date.now(), buckets };
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
  if (apply) { lock = openSync(lockPath, 'wx', 0o600); writeFileSync(lock, String(process.pid)); }
  const inventory = inventoryPath ? JSON.parse(readFileSync(inventoryPath, 'utf8')) : measure();
  let plan = buildPlan(inventory, batch);
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', measuredBytes: plan.measuredBytes, additionalBytes: plan.additionalBytes, projectedBytes: plan.projectedBytes, warning: plan.warning, artworks: plan.artworkIds.length, uploadObjects: plan.upload.length, verificationObjects: plan.verify.length }, null, 2));
  if (apply) {
    const journal = { schemaVersion: 1, batchSha256: sha(readFileSync(batchPath)), startedAt: new Date().toISOString(), status: 'uploading', verifiedObjects: [], verifiedArtworkIds: [], publishApproved: false };
    checkpoint(journal);
    for (const id of plan.artworkIds) {
      // Full-account remeasurement before each complete artwork limits drift.
      // Operators must also serialize any uploaders on other machines/accounts.
      plan = buildPlan(measure(), batch);
      for (const object of batch.filter(candidate => candidate.assetId === id)) {
        if (plan.upload.some(candidate => candidate.bucket === object.bucket && candidate.key === object.key)) {
          const mime = object.kind === 'pdf' ? 'application/pdf' : object.kind === 'svg' ? 'image/svg+xml' : 'image/webp';
          const uploadSnapshot = join(verificationDir, `upload-${object.sha256}`);
          writeFileSync(uploadSnapshot, contents.get(object.key).bytes, { mode: 0o600 });
          aws('put-object', ['--bucket', object.bucket, '--key', object.key, '--body', uploadSnapshot, '--storage-class', 'STANDARD', '--content-type', mime, '--cache-control', 'public,max-age=31536000,immutable', '--metadata', JSON.stringify({ sha256: object.sha256, 'artwork-id': object.assetId }), '--if-none-match', '*', ...(object.kind === 'pdf' ? ['--content-disposition', `attachment; filename="${object.assetId}.pdf"`] : [])]);
        }
        const downloaded = join(verificationDir, 'object');
        aws('get-object', ['--bucket', object.bucket, '--key', object.key, downloaded]);
        const actual = readFileSync(downloaded);
        if (actual.length !== object.bytes || sha(actual) !== object.sha256) throw new Error(`Remote checksum mismatch for ${object.key}`);
        journal.verifiedObjects.push({ bucket: object.bucket, key: object.key, sha256: object.sha256, bytes: object.bytes });
        checkpoint(journal);
      }
      journal.verifiedArtworkIds.push(id);
      checkpoint(journal);
    }
    const final = buildPlan(measure(), batch);
    journal.status = 'uploaded-and-byte-verified';
    journal.completedAt = new Date().toISOString();
    journal.aggregateBytes = final.measuredBytes;
    journal.operationCalls = { reads, writes };
    checkpoint(journal);
    console.log('All objects verified. Editorial publication remains a separate reviewed step.');
  }
} finally {
  rmSync(verificationDir, { recursive: true, force: true });
  if (lock !== undefined) { closeSync(lock); unlinkSync(lockPath); }
}
