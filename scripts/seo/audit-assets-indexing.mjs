// Public GET/HEAD only. This audit has no credentials and cannot publish or purge.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const directory = resolve(root, 'reports/assets-indexing');
mkdirSync(directory, { recursive: true });
const publication = JSON.parse(readFileSync(resolve(root, 'data/publication.json'), 'utf8'));
const catalog = JSON.parse(readFileSync(resolve(root, 'data/art.json'), 'utf8'));
const publicIds = new Set(
  catalog.filter((item) => item.published && item.indexable).map((item) => item.id),
);
const records = publication.files.filter((file) => publicIds.has(file.assetId));
const sample = new Map();
for (const kind of ['webp', 'thumb', 'pdf', 'svg']) {
  const group = records.filter((file) => file.kind === kind);
  for (const file of [group[0], group[Math.floor(group.length / 2)], group.at(-1)].filter(Boolean))
    sample.set(file.url, file);
}
const report = {
  date: new Date().toISOString(),
  mode: 'read-only-live-audit',
  checks: [],
  errors: [],
  sampleSize: sample.size,
};
async function inspect(url, { method = 'GET', agent, save, body = false } = {}) {
  const response = await fetch(url, {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(30000),
    headers: agent ? { 'User-Agent': agent } : {},
  });
  const entry = {
    url,
    method,
    agent: agent || 'default',
    status: response.status,
    headers: Object.fromEntries(
      [
        'content-type',
        'cache-control',
        'x-robots-tag',
        'location',
        'cf-cache-status',
        'content-disposition',
        'access-control-allow-origin',
      ].map((key) => [key, response.headers.get(key)]),
    ),
  };
  if (body || save) {
    entry.body = await response.text();
    if (save) writeFileSync(resolve(directory, save), entry.body);
  } else await response.body?.cancel();
  report.checks.push(entry);
  return entry;
}
async function safe(run) {
  try {
    await run();
  } catch (error) {
    report.errors.push(error.message);
  }
}
await safe(async () => {
  await inspect('https://assets.ultraclipart.com/robots.txt', {
    body: true,
    save: 'live-assets-robots-body.txt',
  });
});
for (const agent of ['Googlebot-Image/1.0', 'bingbot/2.0'])
  await safe(async () => {
    await inspect('https://assets.ultraclipart.com/robots.txt', { agent });
  });
await safe(async () => {
  await inspect('https://ultraclipart.com/robots.txt', { body: true });
});
for (const name of ['sitemap.xml', 'sitemap-images.xml'])
  await safe(async () => {
    const entry = await inspect('https://ultraclipart.com/' + name, {
      body: true,
      save: 'live-' + name,
    });
    if (name === 'sitemap-images.xml' && entry.status === 200) {
      const images = [...entry.body.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((match) =>
        match[1].replaceAll('&amp;', '&'),
      );
      const approvedUrls = new Set(
        records.filter((file) => file.kind === 'webp').map((file) => file.url),
      );
      report.images = {
        count: images.length,
        unique: new Set(images).size,
        assetsHost: images.filter(
          (url) => new URL(url).origin === 'https://assets.ultraclipart.com',
        ).length,
        notInLocalManifest: images.filter((url) => !approvedUrls.has(url)),
        localPublishedCount: publicIds.size,
      };
    }
    delete entry.body;
  });
const additional = report.images?.notInLocalManifest || [];
for (const url of [
  additional[0],
  additional[Math.floor(additional.length / 2)],
  additional.at(-1),
].filter(Boolean)) {
  if (new URL(url).origin === 'https://assets.ultraclipart.com')
    sample.set(url, { url, kind: 'webp', contentType: 'image/webp' });
}
report.sampleSize = sample.size;
for (const file of sample.values())
  await safe(async () => {
    const entry = await inspect(file.url, { method: 'HEAD' });
    entry.kind = file.kind;
    entry.expectedContentType = file.contentType;
  });
report.summary = {
  robotsStatus: report.checks.find((c) => c.url === 'https://assets.ultraclipart.com/robots.txt')
    ?.status,
  sampledFiles: report.checks.filter((c) => c.kind).length,
  assetFailures: report.checks.filter(
    (c) =>
      c.kind &&
      (c.status !== 200 ||
        c.headers['content-type']?.split(';')[0] !== c.expectedContentType ||
        /\b(noindex|none|noimageindex)\b/i.test(c.headers['x-robots-tag'] || '')),
  ),
  errors: report.errors,
};
writeFileSync(resolve(directory, 'live-audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      summary: report.summary,
      images: report.images
        ? { ...report.images, notInLocalManifest: report.images.notInLocalManifest.length }
        : null,
    },
    null,
    2,
  ),
);
if (
  report.errors.length ||
  report.summary.robotsStatus !== 200 ||
  report.summary.assetFailures.length
)
  process.exitCode = 1;
