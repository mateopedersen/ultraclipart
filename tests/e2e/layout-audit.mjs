import { chromium, webkit } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { inspectLayout } from '../helpers/layout-audit.mjs';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.BASE_URL || 'http://127.0.0.1:4323';
const engine = process.env.UC_BROWSER || 'chromium';
const scope = process.env.UC_AUDIT_SCOPE || 'core';
const out = process.env.EVIDENCE_DIR || `reports/layout-audit/${scope}-${engine}`;
mkdirSync(out, { recursive: true });
const json = (path) => JSON.parse(readFileSync(new URL('../../' + path, import.meta.url), 'utf8'));
const art = json('data/art.json').filter((a) => a.published && a.indexable);
const topics = [...json('data/topics.json').topics, ...json('data/extra-topics.json')].filter((t) =>
  art.some((a) => a.topic === t.slug),
);
const secondary = json('data/topic-clusters.json');
const clusters = [
  ...new Set(topics.flatMap((t) => [t.browseCluster || t.cluster, ...(secondary[t.slug] || [])])),
];
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const core = [
  '/',
  '/categories/',
  '/collections/',
  '/new/',
  '/black-and-white/',
  '/search/?q=flower',
  '/favorites/',
  '/create/',
  '/ai-clipart-generator/',
  '/print-size/',
  '/for-teachers/',
  '/guides/',
  '/guides/make-a-classroom-label/',
  '/guides/webp-pdf-and-editable-projects/',
  '/guides/turn-clipart-into-a-coloring-activity/',
  '/about/',
  '/cookies/',
  '/contact/',
  '/accessibility/',
  '/privacy/',
  '/terms/',
  '/license/',
  '/faq/',
  '/editorial-process/',
  '/copyright/',
  '/404/',
  '/clipart/heart/',
  '/collection/christmas-winter/',
  '/art/winter-arctic-fox-resting/',
  '/edit/winter-arctic-fox-resting/',
];
const selected = new Map();
const add = (a) => a && selected.set(a.id, a);
for (const topic of topics) {
  add(art.filter((a) => a.topic === topic.slug).sort((a, b) => b.title.length - a.title.length)[0]);
}
for (const key of ['title', 'description', 'alt'])
  [...art]
    .sort((a, b) => String(b[key] || '').length - String(a[key] || '').length)
    .slice(0, 15)
    .forEach(add);
for (const sign of [-1, 1])
  [...art]
    .sort((a, b) => sign * (a.width / a.height - b.width / b.height))
    .slice(0, 5)
    .forEach(add);
add(art.find((a) => a.sourceType !== 'raster'));
add(art.find((a) => a.sourceType === 'raster'));
const catalog = [
  ...topics.map((t) => `/clipart/${t.slug}/`),
  ...clusters.map((c) => `/collection/${slugify(c)}/`),
  ...[...selected.values()].map((a) => `/art/${a.id}/`),
];
const editors = [
  ...new Set([
    art.find((a) => a.sourceType !== 'raster')?.id,
    art.find((a) => a.sourceType === 'raster')?.id,
    ...[...selected.values()]
      .sort((a, b) => b.title.length - a.title.length)
      .slice(0, 3)
      .map((a) => a.id),
  ]),
]
  .filter(Boolean)
  .map((id) => `/edit/${id}/`);
const routes = process.env.UC_ROUTE_FILE
  ? JSON.parse(readFileSync(process.env.UC_ROUTE_FILE, 'utf8'))
  : process.env.UC_ROUTES
    ? JSON.parse(process.env.UC_ROUTES)
    : scope === 'catalog'
      ? catalog
      : [...core, ...editors];
const widths = process.env.UC_WIDTHS
  ? process.env.UC_WIDTHS.split(',').map(Number)
  : scope === 'catalog'
    ? [320, 1440]
    : [320, 390, 768, 1024, 1440];
const report = {
  date: new Date().toISOString(),
  base,
  engine,
  scope,
  checks: {
    layout: true,
    accessibility: process.env.UC_AXE === '1',
    screenshots: process.env.UC_VISUAL === '1',
  },
  inventory: {
    publicArtwork: art.length,
    subjects: topics.length,
    collections: clusters.length,
    allPublicRoutes: [
      ...new Set([
        ...core,
        ...topics.map((t) => `/clipart/${t.slug}/`),
        ...clusters.map((c) => `/collection/${slugify(c)}/`),
        ...art.flatMap((a) => [`/art/${a.id}/`, `/edit/${a.id}/`]),
      ]),
    ].length,
    selectedRoutes: routes.length,
    widths,
  },
  states: [],
  errors: [],
};
writeFileSync(out + '/inventory.json', JSON.stringify({ ...report.inventory, routes }, null, 2));
async function settleImages(page) {
  await page.evaluate(async () => {
    const visible = [...document.images].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    });
    await Promise.race([
      Promise.all(visible.map((img) => img.decode().catch(() => {}))),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
const browser = await { chromium, webkit }[engine].launch();
report.browserVersion = browser.version();
let cursor = 0;
try {
  await Promise.all(
    Array.from({ length: Number(process.env.UC_WORKERS || 2) }, async () => {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      await context.addCookies([
        {
          name: 'uc_cookie_choice',
          value: encodeURIComponent(
            JSON.stringify({ version: 1, choice: 'necessary', at: Date.now() }),
          ),
          url: base,
        },
      ]);
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (e) =>
        report.errors.push({ route: page.url().replace(base, ''), message: e.message }),
      );
      for (;;) {
        const i = cursor++;
        if (i >= routes.length) break;
        const route = routes[i];
        try {
          await page.setViewportSize({ width: widths[0], height: 900 });
          const response = await page.goto(base + route, {
            waitUntil: 'domcontentloaded',
            timeout: 90000,
          });
          await page.locator('main').waitFor();
          await page.evaluate(() => document.fonts.ready);
          const necessary = page.locator('[data-cookie-choice="necessary"]:visible').first();
          if (await necessary.count()) await necessary.click();
          // Wait for the actual mounted editor, without invoking inference or saving a project.
          if (route.startsWith('/edit/')) await page.locator('.uc-canvas').first().waitFor();
          for (const width of widths) {
            await page.setViewportSize({ width, height: 900 });
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
            const layout = await page.evaluate(inspectLayout);
            const state = { route, width, status: response.status(), ...layout };
            report.states.push(state);
            if (process.env.UC_AXE === '1') {
              const result = await new AxeBuilder({ page })
                .setLegacyMode(engine === 'webkit')
                .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
                .analyze();
              state.accessibility = result.violations.map((v) => ({
                id: v.id,
                impact: v.impact,
                nodes: v.nodes.map((n) => ({ target: n.target, reason: n.failureSummary })),
              }));
            }
            if (process.env.UC_VISUAL === '1') {
              const name =
                (route.replace(/[^a-z0-9]+/gi, '-').slice(0, 140) || 'home') + '-' + width;
              await settleImages(page);
              await page.screenshot({ path: out + '/' + name + '-top.png' });
              await page
                .locator('main')
                .evaluate((el) => window.scrollTo(0, el.offsetTop + el.offsetHeight * 0.5));
              await settleImages(page);
              await page.screenshot({ path: out + '/' + name + '-middle.png' });
              await page.locator('.site-footer').scrollIntoViewIfNeeded();
              await settleImages(page);
              await page.screenshot({ path: out + '/' + name + '-footer.png' });
              await page.evaluate(() => window.scrollTo(0, 0));
            }
            if (
              layout.horizontalOverflow ||
              layout.clipped.length ||
              (response.status() >= 400 && route !== '/404/')
            ) {
              const filename =
                (route.replace(/[^a-z0-9]+/gi, '-').slice(0, 140) || 'home') + '-' + width + '.png';
              await page.screenshot({ path: out + '/' + filename, fullPage: false });
              state.screenshot = filename;
            }
          }
          if (i % 10 === 0) {
            writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
            console.log(`${i + 1}/${routes.length}: ${route}`);
          }
        } catch (e) {
          report.errors.push({ route, message: e.message });
          console.log('ERROR ' + route + ' ' + e.message.slice(0, 200));
        }
      }
      await context.close();
    }),
  );
} finally {
  report.finished = new Date().toISOString();
  report.summary = {
    states: report.states.length,
    routes: new Set(report.states.map((s) => s.route)).size,
    overflow: report.states.filter((s) => s.horizontalOverflow).length,
    clipped: report.states.filter((s) => s.clipped.length).length,
    errors: report.errors.length,
    accessibility:
      process.env.UC_AXE === '1'
        ? report.states.filter((s) => s.accessibility?.length).length
        : null,
    failedResponses: report.states.filter((s) => s.status >= 400 && s.route !== '/404/').length,
  };
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary));
  await browser.close();
}

if (
  Object.entries(report.summary).some(
    ([key, value]) => !['states', 'routes'].includes(key) && value,
  )
)
  process.exitCode = 1;
