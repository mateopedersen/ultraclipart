import { chromium } from '@playwright/test';
import {
  readdirSync,
  mkdirSync,
  writeFileSync,
  appendFileSync,
  readFileSync,
  statSync,
  existsSync,
  copyFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { inspectLayout } from '../helpers/layout-audit.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw Error('Local only');
const built = 'work/performance-build';
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
const htmlFiles = walk(built).filter((p) => p.endsWith('.html'));
const paths = htmlFiles.map((p) => '/' + relative(built, p).replace(/index\.html$/, ''));
const inventory = process.env.UC_MAX ? paths.slice(0, Number(process.env.UC_MAX)) : paths;
const out = process.env.EVIDENCE_DIR || 'reports/performance/all-route-layout';
mkdirSync(out, { recursive: true });
let previous;
const complete = new Set();
if (process.env.UC_RESUME === '1' && existsSync(out + '/report.json')) {
  previous = JSON.parse(readFileSync(out + '/report.json', 'utf8'));
  if (
    previous.total !== inventory.length ||
    htmlFiles.some((file) => statSync(file).mtimeMs > Date.parse(previous.started))
  )
    throw Error('The build changed since the recorded scan; a fresh scan is required.');
  const widths = new Map();
  for (const line of readFileSync(out + '/pages.ndjson', 'utf8')
    .trim()
    .split('\n')) {
    const row = JSON.parse(line);
    if (!row.passed) continue;
    const found = widths.get(row.route) || new Set();
    found.add(row.width);
    widths.set(row.route, found);
  }
  for (const [route, found] of widths) if (found.has(320) && found.has(1440)) complete.add(route);
  copyFileSync(out + '/report.json', out + '/previous-checkpoint.json');
} else writeFileSync(out + '/pages.ndjson', '');
const routes = inventory.filter((route) => !complete.has(route));
const report = {
  started: previous?.started || new Date().toISOString(),
  resumedAt: previous ? new Date().toISOString() : undefined,
  retainedCompletedRoutes: complete.size,
  total: inventory.length,
  visited: complete.size,
  states: complete.size * 2,
  scope:
    'Every generated HTML URL navigated in Chromium at 320/1440. JavaScript disabled: server-rendered structural layout only, not interactive or Lighthouse coverage. Images and fonts load normally.',
  issues: [],
  errors: [],
};
const browser = await chromium.launch();
let cursor = 0,
  screenshots = 0;
try {
  await Promise.all(
    Array.from(
      { length: Math.min(8, Math.max(1, Number(process.env.UC_WORKERS || 4))) },
      async () => {
        const context = await browser.newContext({
          javaScriptEnabled: false,
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        for (;;) {
          const index = cursor++;
          if (index >= routes.length) break;
          const route = routes[index];
          try {
            await page.setViewportSize({ width: 320, height: 900 });
            const response = await page.goto(base + route, { waitUntil: 'load', timeout: 30000 });
            await page.evaluate(() => document.fonts.ready);
            const rows = [];
            for (const width of [320, 1440]) {
              await page.setViewportSize({ width, height: 900 });
              const layout = await page.evaluate(inspectLayout);
              const details = await page.evaluate(() => {
                const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
                const repeated = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
                return {
                  h1: document.querySelectorAll('main h1').length,
                  main: !!document.querySelector('main'),
                  repeated,
                };
              });
              const issues = {
                overflow: layout.horizontalOverflow,
                clipped: layout.clipped,
                escaped: layout.escaped,
                ...details,
              };
              const failed =
                layout.horizontalOverflow ||
                layout.clipped.length ||
                layout.escaped.length ||
                !details.main ||
                details.h1 !== 1 ||
                details.repeated.length ||
                response.status() >= 400;
              rows.push({ route, width, status: response.status(), passed: !failed });
              report.states++;
              if (failed) {
                const entry = { route, width, status: response.status(), ...issues };
                if (screenshots++ < 20) {
                  entry.screenshot = `issue-${screenshots}.png`;
                  await page.screenshot({ path: out + '/' + entry.screenshot });
                }
                report.issues.push(entry);
              }
            }
            appendFileSync(
              out + '/pages.ndjson',
              rows.map((r) => JSON.stringify(r)).join('\n') + '\n',
            );
            report.visited++;
          } catch (error) {
            report.errors.push({ route, message: error.message });
          }
          if (index % 250 === 0) {
            writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
            console.log(
              JSON.stringify({
                visited: report.visited,
                total: report.total,
                issues: report.issues.length,
                errors: report.errors.length,
              }),
            );
          }
        }
        await context.close();
      },
    ),
  );
} finally {
  await browser.close();
  report.finished = new Date().toISOString();
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      visited: report.visited,
      total: report.total,
      states: report.states,
      issues: report.issues.length,
      errors: report.errors.length,
    }),
  );
}
if (report.issues.length || report.errors.length || report.visited !== report.total)
  process.exitCode = 1;
