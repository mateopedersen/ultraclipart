import { mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import { templateRoutes } from './routes.mjs';
// Install lighthouse in the audit environment or supply its node_modules directory.
const dependency = (name) =>
  process.env.LIGHTHOUSE_HOME
    ? pathToFileURL(resolve(process.env.LIGHTHOUSE_HOME, name)).href
    : name;
const { default: lighthouse } = await import(dependency('lighthouse/core/index.js'));
const { default: desktop } = await import(dependency('lighthouse/core/config/desktop-config.js'));
const lighthouseRequire = createRequire(
  realpathSync(
    process.env.LIGHTHOUSE_HOME
      ? resolve(process.env.LIGHTHOUSE_HOME, 'lighthouse/core/index.js')
      : createRequire(import.meta.url).resolve('lighthouse/core/index.js'),
  ),
);
const { launch } = await import(pathToFileURL(lighthouseRequire.resolve('chrome-launcher')).href);
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw Error('This audit is local only');
const routes = (
  process.env.PERFORMANCE_ROUTES ||
  (process.env.PERFORMANCE_SCOPE === 'templates'
    ? templateRoutes.join(',')
    : '/,/clipart/baby/,/art/classic-white-volleyball-realistic-clipart/,/privacy/,/library-index/,/create/')
).split(',');
const devices = (process.env.PERFORMANCE_DEVICES || 'mobile,desktop').split(',');
const out = resolve(process.env.PERFORMANCE_OUT || 'reports/performance/before');
mkdirSync(out, { recursive: true });
const rows = [];
for (const path of routes)
  for (const device of devices) {
    const id =
      (path === '/'
        ? 'home'
        : path
            .replaceAll('/', '-')
            .replace(/^-|-$/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')) +
      '-' +
      device;
    const chrome = await launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ['--headless', '--no-sandbox'],
    });
    try {
      const result = await lighthouse(
        base + path,
        {
          port: chrome.port,
          output: ['json', 'html'],
          logLevel: 'error',
          onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        },
        device === 'desktop' ? desktop : undefined,
      );
      const lhr = result.lhr;
      writeFileSync(resolve(out, id + '.json.gz'), gzipSync(JSON.stringify(lhr)));
      writeFileSync(resolve(out, id + '.html'), result.report[1]);
      const row = {
        path,
        device,
        date: lhr.fetchTime,
        version: lhr.lighthouseVersion,
        scores: Object.fromEntries(
          Object.entries(lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]),
        ),
        metrics: Object.fromEntries(
          [
            'first-contentful-paint',
            'largest-contentful-paint',
            'speed-index',
            'total-blocking-time',
            'cumulative-layout-shift',
          ].map((k) => [k, lhr.audits[k]?.numericValue]),
        ),
        issues: Object.entries(lhr.audits)
          .filter(([, v]) => v.score !== null && v.score < 1)
          .map(([id, a]) => ({ id, title: a.title, score: a.score, displayValue: a.displayValue })),
        error: lhr.runtimeError,
      };
      rows.push(row);
      console.log(JSON.stringify(row));
    } catch (error) {
      rows.push({ path, device, error: error.message });
      console.log(JSON.stringify(rows.at(-1)));
    } finally {
      await chrome.kill();
      writeFileSync(resolve(out, 'summary.json'), JSON.stringify(rows, null, 2) + '\n');
    }
  }
if (rows.some((r) => r.error)) process.exitCode = 1;
