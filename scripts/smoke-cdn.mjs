#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { readPublication } from './publication-policy.mjs';

const root = resolve(import.meta.dirname, '..');
const base = process.env.ASSET_BASE;
if (base && new URL(base).protocol !== 'https:') throw new Error('ASSET_BASE must use HTTPS');
const publication = readPublication(root);
const origin = process.env.SITE_ORIGIN ?? 'https://ultraclipart.com';
const art = JSON.parse(readFileSync(resolve(root, 'data/art.json'), 'utf8'));
const output = resolve(process.env.REPORT_DIR ?? resolve(root, 'reports/live'));
mkdirSync(output, { recursive: true });
const queue = art.flatMap((item) =>
  ['svg', 'webp', 'pdf', 'thumb'].map((kind) => ({
    id: item.id,
    kind,
    url: base
      ? new URL(basename(item[kind]), base.replace(/\/?$/, '/')).href
      : publication.assetUrls[item.id][kind],
    expected: item.files[kind],
  })),
);
const report = {
  date: new Date().toISOString(),
  base: base ?? 'verified per-file publication map',
  origin,
  status: 'running',
  objects: [],
  failures: [],
};
async function verify(item) {
  const result = {
    id: item.id,
    kind: item.kind,
    url: item.url,
    status: 0,
    bytes: 0,
    sha256: '',
    issues: [],
  };
  try {
    const response = await fetch(item.url, {
      headers: { Origin: origin },
      signal: AbortSignal.timeout(20000),
    });
    result.status = response.status;
    result.headers = Object.fromEntries(
      [
        'content-type',
        'cache-control',
        'access-control-allow-origin',
        'etag',
        'cf-cache-status',
      ].map((name) => [name, response.headers.get(name)]),
    );
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    result.bytes = body.length;
    result.sha256 = createHash('sha256').update(body).digest('hex');
    if (result.bytes !== item.expected.bytes)
      result.issues.push(`Byte length ${result.bytes} differs from ${item.expected.bytes}`);
    if (result.sha256 !== item.expected.sha256)
      result.issues.push('SHA-256 differs from verified source');
    const expectedType =
      item.kind === 'svg'
        ? 'image/svg+xml'
        : item.kind === 'pdf'
          ? 'application/pdf'
          : 'image/webp';
    if (!result.headers['content-type']?.toLowerCase().startsWith(expectedType))
      result.issues.push(`Expected MIME ${expectedType}`);
    if (![origin, '*'].includes(result.headers['access-control-allow-origin']))
      result.issues.push('Origin is not allowed by observed CORS response');
    if (!/max-age=\d+/.test(result.headers['cache-control'] ?? ''))
      result.issues.push('Missing explicit cache lifetime');
    if (item.kind === 'pdf' && body.length > 1_000_000)
      result.issues.push('Standard PDF exceeds 1,000,000 bytes');
  } catch (error) {
    result.issues.push(error.message);
  }
  report.objects.push(result);
  if (result.issues.length) report.failures.push({ url: item.url, issues: result.issues });
}
const pending = [...queue];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (pending.length) await verify(pending.shift());
  }),
);
report.objects.sort((a, b) => a.url.localeCompare(b.url));
report.status = report.failures.length ? 'failed' : 'passed';
report.verifiedObjects = report.objects.filter((item) => !item.issues.length).length;
report.verifiedBytes = report.objects
  .filter((item) => !item.issues.length)
  .reduce((sum, item) => sum + item.bytes, 0);
writeFileSync(resolve(output, 'cdn.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      status: report.status,
      objects: report.objects.length,
      verifiedObjects: report.verifiedObjects,
      verifiedBytes: report.verifiedBytes,
      failures: report.failures,
    },
    null,
    2,
  ),
);
if (report.status !== 'passed') process.exitCode = 1;
