import { readFileSync, writeFileSync, realpathSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, join } from 'node:path';
import { validateBatch } from './plan.mjs';

const root = resolve(import.meta.dirname, '../..');
const [wave, bucket] = process.argv.slice(2);
if (!/^wave_\d{3}$/.test(wave ?? '') || !/^[a-z0-9][a-z0-9-]+$/.test(bucket ?? ''))
  throw new Error('Usage: node scripts/r2/make-wave-batch.mjs wave_001 BUCKET');
const stage = realpathSync(join(root, 'work/production', wave));
const report = JSON.parse(readFileSync(join(stage, 'report.json')));
if (report.wave !== wave || report.artworks.length !== report.actualExportedDrawings)
  throw new Error('Production report does not match this wave');
const batch = report.artworks.flatMap((item) => {
  if (item.state !== 'FORMAT_PREFLIGHT_PASSED') throw new Error('Export preflight is incomplete');
  return ['pdf', 'svg', 'webp', 'thumb'].map((field) => {
    const file = item.files[field],
      path = realpathSync(join(root, file.path));
    if (!path.startsWith(stage + '/')) throw new Error('Wave source escapes its staging directory');
    const body = readFileSync(path),
      sha256 = createHash('sha256').update(body).digest('hex');
    if (file.bytes !== body.length || file.sha256 !== sha256)
      throw new Error(`Wave source changed: ${item.id}/${field}`);
    const kind = field === 'thumb' ? 'thumbnail' : field;
    return {
      assetId: item.id,
      kind,
      bucket,
      jurisdiction: 'default',
      key: `${item.topic}/${item.id}.${kind}.${sha256.slice(0, 16)}.${field === 'thumb' ? 'webp' : field}`,
      path: relative(process.cwd(), path),
      bytes: body.length,
      sha256,
    };
  });
});
if (report.artworks.length > 50) throw new Error('At most 50 drawings per production wave');
validateBatch(batch);
const output = join(root, 'work', `${wave}.r2-batch.json`);
mkdirSync(join(root, 'work'), { recursive: true });
writeFileSync(output, JSON.stringify(batch, null, 2) + '\n', { mode: 0o600 });
console.log(
  JSON.stringify(
    {
      output,
      drawings: report.artworks.length,
      objects: batch.length,
      bytes: batch.reduce((n, x) => n + x.bytes, 0),
      remoteWrites: 0,
      publication: 'unchanged',
    },
    null,
    2,
  ),
);
