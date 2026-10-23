#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { validateBatch } from './plan.mjs';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const bucket = args.shift();
if (!bucket || bucket.startsWith('-')) throw new Error('Usage: node scripts/r2/make-batch.mjs BUCKET [--pilot] [--ids id,id] [--output work/r2-batch.json]');
let pilot = false; let ids; let output = resolve(root, 'work/r2-batch.json');
while (args.length) {
  const arg = args.shift();
  if (arg === '--pilot') pilot = true;
  else if (arg === '--ids' && args[0]) ids = args.shift().split(',');
  else if (arg === '--output' && args[0]) output = resolve(args.shift());
  else throw new Error(`Invalid argument: ${arg}`);
}
const catalog = JSON.parse(readFileSync(resolve(root, 'data/art.json')));
const art = catalog.filter(item => (pilot || item.published) && (!ids || ids.includes(item.id)));
if (!art.length) throw new Error('No matching published artwork. --pilot explicitly prepares unapproved preview assets without publishing them.');
if (ids && ids.some(id => !art.some(item => item.id === id))) throw new Error('Unknown or ineligible artwork ID');
if (art.length > 50) throw new Error('Select at most 50 artworks with --ids');
const batch = art.flatMap(item => ['pdf', 'svg', 'webp', 'thumb'].map(field => {
  const path = resolve(root, 'public', item[field].replace(/^\//, ''));
  const body = readFileSync(path);
  const sha256 = createHash('sha256').update(body).digest('hex');
  if (item.files?.[field]?.bytes !== body.length || item.files?.[field]?.sha256 !== sha256) throw new Error(`Unverified or changed file: ${item.id}/${field}`);
  const kind = field === 'thumb' ? 'thumbnail' : field;
  const extension = field === 'thumb' ? 'webp' : field;
  return { assetId: item.id, kind, bucket, key: `${item.topic}/${item.id}.${kind}.${sha256.slice(0, 16)}.${extension}`, path: relative(process.cwd(), path), bytes: body.length, sha256 };
}));
validateBatch(batch);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(batch, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ output, artworks: art.length, objects: batch.length, bytes: batch.reduce((sum, item) => sum + item.bytes, 0), mode: pilot ? 'unapproved-preview' : 'published-artwork', remoteWrites: 0 }, null, 2));
