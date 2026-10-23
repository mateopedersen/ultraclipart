import { chromium } from '@playwright/test';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
const root = resolve(import.meta.dirname, '..'),
  base = process.env.BASE_URL ?? 'http://127.0.0.1:4322';
const catalog = JSON.parse(readFileSync(resolve(root, 'data/art.json'), 'utf8')),
  sample = catalog.find((item) => item.published && item.indexable);
if (!sample) throw new Error('A published artwork is required for the performance audit');
const paths = process.env.PERFORMANCE_ROUTES?.split(',') ?? [
  '/',
  `/clipart/${sample.topic}/`,
  `/art/${sample.id}/`,
  `/edit/${sample.id}/`,
];
if (paths.some((path) => !path.startsWith('/') || path.startsWith('//')))
  throw new Error('Performance routes must be relative to the audited website');
const report = {
  date: new Date().toISOString(),
  base,
  status: 'RUNNING',
  type: 'local controlled laboratory measurement; not field Core Web Vitals',
  environment: {
    browser: 'Chromium',
    runsPerRoute: 2,
    desktop: { width: 1440, height: 1000, network: 'unthrottled loopback', cpu: 'unthrottled' },
    mobile: {
      width: 390,
      height: 844,
      network: 'CDP emulated 1.6 Mbps down / 750 kbps up / 150ms latency',
      cpu: 'CDP 4x slowdown',
    },
  },
  measurements: [],
  payload: {},
  security: {},
  limitations: [
    'Local loopback/CDP lab measurements do not establish production/field performance.',
    'INP is not measured; representative interaction and field evidence required.',
    'No physical low-end phone or live production security test implied.',
    'Preview servers may ignore Cloudflare _headers; deployed-host header verification still required.',
    'Built files can change during concurrent development; timestamps and measured payload describe this run only.',
  ],
};
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(resolve(dir, e.name)) : [resolve(dir, e.name)],
  );
}
const all = files(resolve(root, 'dist')),
  assets = all.map((path) => ({
    path: relative(resolve(root, 'dist'), path),
    bytes: statSync(path).size,
  }));
const types = {};
for (const a of assets) {
  const e = extname(a.path) || '(none)';
  types[e] = (types[e] ?? 0) + a.bytes;
}
report.payload = {
  staticAssetCount: all.length,
  withinStaticAssetCountLimit: all.length < 20000,
  totalDistBytes: assets.reduce((s, a) => s + a.bytes, 0),
  largestAssets: [...assets].sort((a, b) => b.bytes - a.bytes).slice(0, 10),
  byExtension: types,
  js: assets
    .filter((a) => a.path.endsWith('.js'))
    .map((a) => ({
      ...a,
      gzipBytes: gzipSync(readFileSync(resolve(root, 'dist', a.path))).length,
    })),
};
const patterns = [
  [
    'token assignment',
    /(?:CLOUDFLARE_API_TOKEN|R2_SECRET_ACCESS_KEY|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*["'][^"'\s]{12,}["']/,
  ],
  ['AWS access-key ID', /AKIA[0-9A-Z]{16}/],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{30,}/],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];
const hits = [];
for (const file of all.filter((f) => /\.(?:html|js|json|css|txt)$/.test(f))) {
  const content = readFileSync(file, 'utf8');
  for (const [label, re] of patterns)
    if (re.test(content)) hits.push({ file: relative(root, file), pattern: label });
}
report.security.secretScan = {
  scope: 'built text assets; four conservative signatures; no secret values logged',
  findings: hits,
};
report.security.configuredHeaders = readFileSync(resolve(root, 'dist/_headers'), 'utf8');
const inlineFiles = [];
for (const file of all.filter((f) => f.endsWith('.html'))) {
  const text = readFileSync(file, 'utf8');
  const tags = [...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(
    (m) =>
      !/\bsrc\s*=/.test(m[1]) && !/type\s*=\s*["']application\/(?:ld\+json|json)["']/i.test(m[1]),
  );
  if (tags.length)
    inlineFiles.push({
      path: relative(resolve(root, 'dist'), file),
      executableInlineScripts: tags.length,
    });
}
report.security.inlineScripts = inlineFiles;
report.security.cspInlineConflict = {
  potentiallyBlocking:
    inlineFiles.length > 0 &&
    !/script-src[^;\n]*(?:'unsafe-inline'|'sha256-|nonce-)/.test(report.security.configuredHeaders),
  note: 'Configured CSP must permit exact inline hashes or scripts must be externalized. SimpleHTTP preview does not apply _headers.',
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_BIN ? { executablePath: process.env.CHROMIUM_BIN } : {}),
});
try {
  for (const device of ['desktop', 'mobile'])
    for (const path of paths)
      for (let run = 1; run <= 2; run++) {
        const context = await browser.newContext({
          viewport:
            device === 'desktop' ? { width: 1440, height: 1000 } : { width: 390, height: 844 },
          deviceScaleFactor: device === 'mobile' ? 2 : 1,
          isMobile: device === 'mobile',
          hasTouch: device === 'mobile',
        });
        const page = await context.newPage(),
          cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
        if (device === 'mobile') {
          await cdp.send('Network.emulateNetworkConditions', {
            offline: false,
            latency: 150,
            downloadThroughput: 200000,
            uploadThroughput: 93750,
          });
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        }
        await page.addInitScript(() => {
          window.__metrics = { lcp: 0, cls: 0, longTasks: [] };
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) window.__metrics.lcp = e.startTime;
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) if (!e.hadRecentInput) window.__metrics.cls += e.value;
          }).observe({ type: 'layout-shift', buffered: true });
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) window.__metrics.longTasks.push(e.duration);
          }).observe({ type: 'longtask', buffered: true });
        });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        const response = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1200);
        const result = await page.evaluate(() => {
          const n = performance.getEntriesByType('navigation')[0],
            r = performance.getEntriesByType('resource');
          return {
            ...window.__metrics,
            ttfb: n.responseStart - n.requestStart,
            domContentLoaded: n.domContentLoadedEventEnd,
            resourceCount: r.length,
            transferredBytes: r.reduce((s, x) => s + x.transferSize, n.transferSize),
            decodedBodyBytes: r.reduce((s, x) => s + x.decodedBodySize, n.decodedBodySize),
            jsBodyBytes: r
              .filter((x) => x.initiatorType === 'script')
              .reduce((s, x) => s + x.decodedBodySize, 0),
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
            mixedContent: r.filter(
              (x) => location.protocol === 'https:' && x.name.startsWith('http:'),
            ).length,
            insecureExecutableLinks: [...document.querySelectorAll('[href],[src]')].filter((e) =>
              /^javascript:/i.test(e.getAttribute('href') ?? e.getAttribute('src') ?? ''),
            ).length,
            externalResources: r
              .filter(
                (x) => new URL(x.name).origin !== location.origin && !x.name.startsWith('blob:'),
              )
              .map((x) => x.name),
          };
        });
        report.measurements.push({
          device,
          path,
          run,
          status: response?.status(),
          responseHeaders: response?.headers(),
          ...result,
          pageErrors: errors,
        });
        await context.close();
      }
  report.summary = paths.flatMap((path) =>
    ['desktop', 'mobile'].map((device) => {
      const rows = report.measurements.filter((r) => r.path === path && r.device === device),
        mean = (k) => Math.round((rows.reduce((s, r) => s + r[k], 0) / rows.length) * 100) / 100;
      return {
        path,
        device,
        lcpMsMean: mean('lcp'),
        lcpMsMax: Math.max(...rows.map((r) => r.lcp)),
        clsMax: Math.max(...rows.map((r) => r.cls)),
        transferredBytesMean: mean('transferredBytes'),
        jsBodyBytesMean: mean('jsBodyBytes'),
        labLcpWithin2500ms: rows.every((r) => r.lcp > 0 && r.lcp <= 2500),
        labClsWithin01: rows.every((r) => r.cls <= 0.1),
      };
    }),
  );
  report.status =
    report.measurements.every((r) => r.status === 200 && r.pageErrors.length === 0) &&
    hits.length === 0 &&
    !report.security.cspInlineConflict.potentiallyBlocking
      ? 'MEASURED'
      : 'ISSUES_FOUND';
} catch (e) {
  report.status = 'BLOCKED';
  report.error = e.message;
} finally {
  await browser.close();
  mkdirSync(resolve(root, 'reports'), { recursive: true });
  writeFileSync(
    resolve(root, 'reports/performance-security.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify(
    {
      status: report.status,
      payload: report.payload,
      summary: report.summary,
      error: report.error,
    },
    null,
    2,
  ),
);
