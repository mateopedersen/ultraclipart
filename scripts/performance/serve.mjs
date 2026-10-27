// Local static release preview; compression is also supplied by the production CDN.
import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync, realpathSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { handleCookieRegion } from '../../server/cookies/region.mjs';
import { previewAiResponse } from '../ai-preview.mjs';
const root = resolve(import.meta.dirname, '../..');
const built = resolve(root, process.env.PERFORMANCE_BUILD_DIR || 'work/performance-build');
const publicRoot = resolve(root, 'public');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.wasm': 'application/wasm',
  '.csv': 'text/csv; charset=utf-8',
  '.gz': 'application/gzip',
};
const compressed = new Map();
let compressedBytes = 0;
const compressionBudget = 64 * 1024 * 1024;
createServer(async (req, res) => {
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  const aiPreview = previewAiResponse(path, req.method);
  if (aiPreview) {
    res.writeHead(aiPreview.status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(aiPreview.body));
    return;
  }
  if (path === '/api/cookie-region.json') {
    // Execute the real handler. With no edge country on localhost it uses its
    // existing unknown-country notice policy; this is not IP geolocation.
    const response = handleCookieRegion(
      new Request('http://127.0.0.1' + path, { method: req.method }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  let file;
  const reportRequest =
    path === '/__seo-report/' ||
    path.startsWith('/__seo-evidence/') ||
    path === '/__performance-report/' ||
    path.startsWith('/__performance-evidence/') ||
    path === '/__image-seo-report/' ||
    path.startsWith('/__image-seo-evidence/');
  // Resolve once per request so an atomic release switch cannot mix files.
  const activeBuild = existsSync(built) ? realpathSync(built) : built;
  let roots = [activeBuild, publicRoot];
  // Tabs opened before a release switch may still request their previous hashed
  // modules. Retain those assets without serving old HTML routes as fallbacks.
  const releases = resolve(root, 'work/performance-releases');
  if (path.startsWith('/_astro/') && existsSync(releases)) {
    roots.push(
      ...readdirSync(releases, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => resolve(releases, entry.name))
        .filter((directory) => directory !== activeBuild),
    );
  }
  if (reportRequest) {
    const coreSeo = path === '/__seo-report/' || path.startsWith('/__seo-evidence/');
    const imageSeo = path === '/__image-seo-report/' || path.startsWith('/__image-seo-evidence/');
    path =
      path === '/__performance-report/' ||
      path === '/__image-seo-report/' ||
      (coreSeo && path === '/__seo-report/')
        ? '/rapor.html'
        : path.slice(
            coreSeo
              ? '/__seo-evidence'.length
              : imageSeo
                ? '/__image-seo-evidence'.length
                : '/__performance-evidence'.length,
          );
    roots = [
      resolve(
        root,
        coreSeo ? 'reports/seo-final' : imageSeo ? 'reports/image-seo' : 'reports/performance',
      ),
    ];
  }
  for (const base of roots) {
    let candidate = resolve(base, '.' + path);
    if (candidate !== base && !candidate.startsWith(base + '/')) continue;
    if (existsSync(candidate) && statSync(candidate).isDirectory())
      candidate = resolve(candidate, 'index.html');
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      file = candidate;
      break;
    }
  }
  let status = 200;
  if (!file) {
    const notFound = resolve(activeBuild, '404.html');
    if (!reportRequest && existsSync(notFound)) {
      file = notFound;
      status = 404;
    } else {
      res.writeHead(404).end('Not found');
      return;
    }
  }
  const type = mime[extname(file)] || 'application/octet-stream';
  const stat = statSync(file);
  const shouldZip =
    /text|json|xml|svg/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '');
  const key = file + ':' + stat.mtimeMs;
  let bytes;
  if (shouldZip) {
    bytes = compressed.get(key);
    if (!bytes) {
      bytes = gzipSync(readFileSync(file));
      if (bytes.length <= compressionBudget) {
        while (compressedBytes + bytes.length > compressionBudget) {
          const oldest = compressed.keys().next().value;
          compressedBytes -= compressed.get(oldest).length;
          compressed.delete(oldest);
        }
        compressed.set(key, bytes);
        compressedBytes += bytes.length;
      }
    } else {
      compressed.delete(key);
      compressed.set(key, bytes);
    }
  } else bytes = readFileSync(file);
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': bytes.length,
    Vary: 'Accept-Encoding',
    ...(shouldZip ? { 'Content-Encoding': 'gzip' } : {}),
    'Cache-Control': /^\/category-search\/[a-f0-9]{64}\.json$/.test(path)
      ? 'public, max-age=31536000, immutable'
      : ['/surprise-picks.json', '/collection-feed.json'].includes(path)
        ? 'no-store'
        : reportRequest || /\.html$|\.json$/.test(file)
          ? 'no-cache'
          : 'public, max-age=31536000',
  });
  res.end(req.method === 'HEAD' ? undefined : bytes);
}).listen(Number(process.env.PORT || 4326), '127.0.0.1', () =>
  console.log(`Local production preview: http://127.0.0.1:${Number(process.env.PORT || 4326)}`),
);
