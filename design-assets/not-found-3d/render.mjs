// Offline art renderer. Three.js and Playwright never enter the production site.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
const root = process.cwd();
const here = resolve(root, 'design-assets/not-found-3d');
const vendor = resolve(root, 'work/not-found-3d/package');
const catalog = JSON.parse(readFileSync(resolve(root, 'data/art.json')));
const images = {
  heart: 'floral-heart-roses-wreath-clipart',
  strawberry: 'strawberry-fruit-trio-realistic-clipart',
};
const textureData = {};
const sources = [];
for (const [key, id] of Object.entries(images)) {
  const record = catalog.find((a) => a.id === id);
  const data = readFileSync(resolve(root, 'public' + record.thumb));
  const sha = createHash('sha256').update(data).digest('hex');
  if (sha !== record.files.thumb.sha256) throw Error('Catalog texture hash mismatch');
  textureData['/art/' + key] = data;
  sources.push({
    id,
    sha256: sha,
    usage: 'Unmodified source texture placed on a modeled picture card; originals unchanged',
  });
}
const html = `<!doctype html><html><head><style>html,body{margin:0;background:transparent}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/vendor/build/three.module.js","three/addons/":"/vendor/examples/jsm/"}}</script></head><body><script type="module" src="/scene.mjs"></script></body></html>`;
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
    return;
  }
  if (textureData[path]) {
    res.writeHead(200, { 'Content-Type': 'image/webp' }).end(textureData[path]);
    return;
  }
  let file;
  if (path === '/scene.mjs') file = resolve(here, 'scene.mjs');
  else if (path.startsWith('/vendor/')) {
    file = resolve(vendor, path.slice(8));
    if (!file.startsWith(vendor + '/')) {
      res.writeHead(403).end();
      return;
    }
  }
  if (!file) {
    res.writeHead(404).end();
    return;
  }
  try {
    res
      .writeHead(200, {
        'Content-Type': extname(file) === '.json' ? 'application/json' : 'text/javascript',
      })
      .end(readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader'] });
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1280 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => console.error(e));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error(m.text());
  });
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => window.render404Ready, {}, { timeout: 90000 });
  await page
    .locator('canvas')
    .screenshot({ path: resolve(here, 'render.png'), omitBackground: true });
  const image = readFileSync(resolve(here, 'render.png'));
  const meta = {
    createdAt: new Date().toISOString(),
    method: 'Local offline Three.js geometry renderer, not image generation',
    three: JSON.parse(readFileSync(resolve(root, 'work/not-found-3d/three-package.json'))),
    sourceArt: sources,
    sceneSha256: createHash('sha256')
      .update(readFileSync(resolve(here, 'scene.mjs')))
      .digest('hex'),
    renderSha256: createHash('sha256').update(image).digest('hex'),
    dimensions: [1600, 1280],
    note: 'No runtime WebGL or Three.js dependency is shipped to visitors.',
  };
  writeFileSync(resolve(here, 'provenance.json'), JSON.stringify(meta, null, 2));
  console.log(JSON.stringify({ file: resolve(here, 'render.png'), bytes: image.length }));
} finally {
  await browser.close();
  server.close();
}
