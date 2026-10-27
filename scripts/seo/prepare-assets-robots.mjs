import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..');
export function assetsRobotsPlan(body) {
  if (typeof body !== 'string' || body.includes('\uFEFF') || Buffer.byteLength(body) > 4096)
    throw new Error('Expected a small UTF-8 robots.txt without a BOM');
  const rules = body
    .split(/\r?\n/)
    .map((line) => line.split('#')[0].trim())
    .filter(Boolean);
  // A deliberately small allow-all policy: no unsupported Index or Noindex syntax,
  // separate crawler overrides, external sitemap, or accidental Disallow survives.
  if (
    JSON.stringify(rules) !==
    JSON.stringify(['User-agent: *', 'Allow: /', 'Sitemap: https://ultraclipart.com/sitemap.xml'])
  )
    throw new Error('Assets robots policy must allow all crawlers and use the production sitemap');
  return {
    schema: 1,
    mode: 'local-preparation-only',
    targetUrl: 'https://assets.ultraclipart.com/robots.txt',
    expectedBucket: 'ultraclipart-media',
    verifyBeforeWrite: 'Confirm the assets.ultraclipart.com custom domain belongs to this bucket.',
    objectKey: 'robots.txt',
    contentType: 'text/plain; charset=utf-8',
    cacheControl: 'public, max-age=300, must-revalidate',
    bytes: Buffer.byteLength(body),
    sha256: createHash('sha256').update(body).digest('hex'),
    source: 'config/assets/robots.txt',
    discovery: {
      directory: 'https://ultraclipart.com/library-index/',
      sitemapIndex: 'https://ultraclipart.com/sitemap.xml',
      pages: 'https://ultraclipart.com/sitemap-pages.xml',
      images: 'https://ultraclipart.com/sitemap-images.xml',
      updates: 'Generated from the published catalog in every normal site build.',
      note: 'The HTML directory is linked by the page sitemap; Sitemap directives point to XML, never HTML.',
    },
    deployment: 'Separate R2 root object; a Pages deployment does not publish this file.',
    purgeAfterAuthorizedPublication: ['https://assets.ultraclipart.com/robots.txt'],
    verifyAfterPublication: [
      'HTTP 200',
      'Exact UTF-8 body and SHA256',
      'text/plain',
      'No restrictive X-Robots-Tag',
      'Cache-Control does not retain the old 404',
    ],
    requiresPublicationAuthorization: true,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const body = readFileSync(resolve(root, 'config/assets/robots.txt'), 'utf8');
  const plan = assetsRobotsPlan(body);
  const directory = resolve(root, 'work/assets-indexing');
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, 'robots.txt'), body);
  writeFileSync(resolve(directory, 'deployment-plan.json'), JSON.stringify(plan, null, 2) + '\n');
  console.log(JSON.stringify(plan, null, 2));
}
