import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  realpathSync,
  existsSync,
} from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { templateRoutes } from './routes.mjs';
const root = resolve(import.meta.dirname, '../..'),
  releasePointer = resolve(root, process.env.PERFORMANCE_BUILD_DIR || 'work/performance-build'),
  release = realpathSync(releasePointer);
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local audit only');
const installedTool = join(root, 'work/performance-tools/node_modules');
const toolHome =
  process.env.LIGHTHOUSE_HOME ||
  (existsSync(join(installedTool, 'lighthouse/core/index.js')) ? installedTool : undefined);
const entry = toolHome
  ? resolve(toolHome, 'lighthouse/core/index.js')
  : createRequire(import.meta.url).resolve('lighthouse/core/index.js');
const req = createRequire(realpathSync(entry));
const { default: lighthouse } = await import(pathToFileURL(entry).href);
const { default: desktop } = await import(
  pathToFileURL(join(dirname(entry), 'config/desktop-config.js')).href
);
const { launch } = await import(pathToFileURL(req.resolve('chrome-launcher')).href);
const out = resolve(process.env.PERFORMANCE_OUT || 'reports/performance/catalog-current');
mkdirSync(out, { recursive: true });
const subjects = ['clipart', 'collection'].flatMap((folder) =>
  readdirSync(join(release, folder), { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(release, folder, e.name, 'index.html')))
    .map((e) => `/${folder}/${e.name}/`),
);
const all = [...new Set([...subjects, ...templateRoutes])];
const paths = process.env.PERFORMANCE_ROUTES ? process.env.PERFORMANCE_ROUTES.split(',') : all;
const targets = paths
  .map((path) => {
    const pathname = new URL(path, base).pathname;
    const file = pathname.endsWith('.html')
      ? join(release, pathname)
      : join(release, pathname, 'index.html');
    const bytes = readFileSync(file);
    return {
      path,
      htmlBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  })
  .sort((a, b) => b.htmlBytes - a.htmlBytes);
const devices = (process.env.PERFORMANCE_DEVICES || 'mobile,desktop').split(','),
  repeats = Number(process.env.PERFORMANCE_REPEATS || '1');
const plan = {
  experiment: process.env.PERFORMANCE_EXPERIMENT || null,
  lighthouse: JSON.parse(readFileSync(resolve(dirname(entry), '../package.json'))).version,
  base,
  release,
  subjects: subjects.length,
  routes: targets.length,
  devices,
  repeats,
  isolation: 'fresh-chrome-process-per-measurement',
  targets,
};
const planFile = join(out, 'plan.json');
if (existsSync(planFile)) {
  const old = JSON.parse(readFileSync(planFile));
  if (JSON.stringify(old) !== JSON.stringify(plan))
    throw Error(
      'Audit inputs changed. Use a new output folder so previous evidence remains bound to its release.',
    );
} else writeFileSync(planFile, JSON.stringify(plan, null, 2));
const rowsFile = join(out, 'summary.json'),
  rows = existsSync(rowsFile) ? JSON.parse(readFileSync(rowsFile)) : [];
const attemptsFile = join(out, 'attempts.json');
const attempts = existsSync(attemptsFile) ? JSON.parse(readFileSync(attemptsFile)) : [...rows];
const key = (row) => `${row.path}|${row.device}|${row.repeat}`;
const finished = new Set(rows.filter((r) => !r.error).map(key));
let chrome;
try {
  for (const target of targets)
    for (const device of devices)
      for (let repeat = 1; repeat <= repeats; repeat++) {
        if (realpathSync(releasePointer) !== release)
          throw Error(
            'Preview release changed during the audit; no mixed-release results will be reported.',
          );
        const row = { path: target.path, device, repeat, release, htmlSha256: target.sha256 };
        if (finished.has(key(row))) continue;
        const id = createHash('sha256').update(key(row)).digest('hex').slice(0, 16);
        try {
          chrome = await launch({
            chromePath: chromium.executablePath(),
            chromeFlags: ['--headless', '--no-sandbox'],
          });
          const result = await lighthouse(
            base + target.path,
            {
              port: chrome.port,
              output: 'json',
              logLevel: 'error',
              onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
            },
            device === 'desktop' ? desktop : undefined,
          );
          const lhr = result.lhr;
          if (lhr.runtimeError) throw Error(JSON.stringify(lhr.runtimeError));
          row.date = lhr.fetchTime;
          row.version = lhr.lighthouseVersion;
          row.scores = Object.fromEntries(
            Object.entries(lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]),
          );
          row.metrics = Object.fromEntries(
            [
              'first-contentful-paint',
              'largest-contentful-paint',
              'speed-index',
              'total-blocking-time',
              'cumulative-layout-shift',
            ].map((k) => [k, lhr.audits[k]?.numericValue]),
          );
          row.issues = Object.entries(lhr.audits)
            .filter(([, a]) => a.score !== null && a.score < 1)
            .map(([id, a]) => ({
              id,
              title: a.title,
              score: a.score,
              displayValue: a.displayValue,
            }));
          writeFileSync(join(out, id + '.json.gz'), gzipSync(JSON.stringify(lhr)));
          row.evidence = id + '.json.gz';
        } catch (error) {
          row.error = String(error);
        } finally {
          await chrome?.kill();
          chrome = undefined;
        }
        attempts.push(row);
        const prior = rows.findIndex((previous) => key(previous) === key(row));
        if (prior >= 0) rows[prior] = row;
        else rows.push(row);
        writeFileSync(attemptsFile, JSON.stringify(attempts, null, 2));
        writeFileSync(rowsFile, JSON.stringify(rows, null, 2));
        writeFileSync(
          join(out, 'progress.json'),
          JSON.stringify({
            release,
            completed: rows.filter((r) => !r.error).length,
            expected: targets.length * devices.length * repeats,
            errors: rows.filter((r) => r.error).length,
            last: row,
          }),
        );
        console.log(
          JSON.stringify({
            done: rows.filter((r) => !r.error).length,
            total: targets.length * devices.length * repeats,
            path: row.path,
            device,
            repeat,
            scores: row.scores,
            error: row.error,
          }),
        );
      }
} finally {
  await chrome?.kill();
}
if (rows.some((row) => row.error)) process.exitCode = 1;
