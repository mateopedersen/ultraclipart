// Real suggestion controller with deliberately held synthetic repository replies.
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { chromium, firefox, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = resolve(process.env.EVIDENCE_DIR ?? 'reports/suggestion-escape');
mkdirSync(out, { recursive: true });
const stub = `const manifest={version:'a'.repeat(64)};const entries=[{kind:'topic',id:'topic:camera',title:'Camera Clipart',description:'Explicit fixture',href:'/clipart/camera/',text:'camera'}];window.releaseDirectory=()=>{};export class SearchRepository{clear(){}manifest(){return Promise.resolve(manifest)}sourceDirectory(){return Promise.resolve(entries)}siteEntries(){return Promise.resolve(entries)}search(){return this.searchAtSnapshot()}searchAtSnapshot(){window.searchReads=(window.searchReads??0)+1;const result={manifest,items:[]};if(window.holdArtwork)return new Promise(r=>window.releaseArtwork=()=>r(result));window.releaseArtwork=()=>{};return Promise.resolve(result)}}`;
const code = await build({
  stdin: {
    contents: `import{initSearchSuggestions}from'./src/scripts/search-suggestions.ts';initSearchSuggestions()`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: 'esm',
  write: false,
  plugins: [
    {
      name: 'explicit-held-repository',
      setup(b) {
        b.onResolve({ filter: /search-remote$/ }, () => ({
          path: 'repository',
          namespace: 'fixture',
        }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: stub, loader: 'js' }));
      },
    },
  ],
});
const server = createServer((req, res) =>
  req.url === '/controller.js'
    ? res.writeHead(200, { 'content-type': 'text/javascript' }).end(code.outputFiles[0].contents)
    : res
        .writeHead(200, { 'content-type': 'text/html' })
        .end(
          '<!doctype html><meta name="catalog-snapshot" content="' +
            'a'.repeat(64) +
            '"><form action="/search/"><input type="search" name="q"></form><h1 id="outside">Results</h1><input id="native-search" type="search"><script type="module" src="/controller.js"></script>',
        ),
);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const report = {
  scope:
    'Actual public controller; explicit synthetic repository replies; browser key-cancellation semantics and simulated composition events',
  passed: false,
  cases: [],
  errors: [],
};
try {
  const types = { chromium, firefox, webkit };
  const engines = process.env.UC_BROWSER
    ? [[process.env.UC_BROWSER, types[process.env.UC_BROWSER]]]
    : Object.entries(types);
  assert.ok(
    engines.every(([, type]) => type),
    'Unknown browser engine',
  );
  for (const [engine, type] of engines) {
    const browser = await type.launch(
      engine === 'chromium' && process.env.UC_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.UC_CHROMIUM_EXECUTABLE_PATH }
        : {},
    );
    try {
      for (let round = 1; round <= 2; round++)
        for (const scenario of [
          'pending-debounce',
          'pending-reply',
          'open-panel',
          'composing-closed',
          'closed-native-escape',
          'outside-pointer',
        ]) {
          const page = await browser.newPage();
          const row = { engine, round, scenario, passed: false };
          page.on('pageerror', (e) => report.errors.push(e.message));
          try {
            await page.goto('http://127.0.0.1:' + server.address().port);
            await expect(page.locator('form')).toHaveAttribute('data-suggestions-ready', 'true');
            const input = page.locator('form input[name=q]'),
              panel = page.locator('.search-suggestions');
            await page.evaluate((hold) => {
              window.holdArtwork = hold;
            }, scenario === 'pending-reply');
            if (scenario === 'closed-native-escape') {
              const native = page.locator('#native-search');
              await native.fill('x');
              await native.press('Escape');
              row.nativeControlValue = await native.inputValue();
              await input.fill('x');
              await expect(panel).toBeHidden();
              await input.press('Escape');
              await expect(input).toHaveValue(row.nativeControlValue);
            } else if (scenario === 'outside-pointer') {
              await input.fill('camera');
              await expect(panel).toBeVisible();
              await page.locator('#outside').click();
              await expect(input).toHaveValue('camera');
            } else if (scenario === 'pending-debounce' || scenario === 'composing-closed') {
              const cancelled = await input.evaluate((el, composing) => {
                if (composing)
                  el.dispatchEvent(
                    new CompositionEvent('compositionstart', { bubbles: true, data: 'カ' }),
                  );
                el.value = 'camera';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                const event = new KeyboardEvent('keydown', {
                  key: 'Escape',
                  bubbles: true,
                  cancelable: true,
                  isComposing: composing,
                });
                el.dispatchEvent(event);
                return event.defaultPrevented;
              }, scenario === 'composing-closed');
              assert.equal(
                cancelled,
                false,
                'Closed panel must preserve native Escape/IME cancellation',
              );
            } else {
              await input.fill('camera');
              await expect
                .poll(() => page.evaluate(() => typeof window.releaseArtwork))
                .toBe('function');
              if (scenario === 'open-panel') {
                await page.evaluate(() => window.releaseDirectory());
                await expect(page.locator('a[href="/clipart/camera/"]')).toBeVisible();
                await input.press('ArrowDown');
              }
              if (scenario === 'open-panel') {
                await input.press('Escape');
                await expect(input).toHaveValue('camera');
              } else {
                const cancelled = await input.evaluate((el) => {
                  const event = new KeyboardEvent('keydown', {
                    key: 'Escape',
                    bubbles: true,
                    cancelable: true,
                  });
                  el.dispatchEvent(event);
                  return event.defaultPrevented;
                });
                assert.equal(cancelled, true, 'Open panel consumes Escape');
              }
            }
            await page.evaluate(() => {
              window.releaseDirectory?.();
              window.releaseArtwork?.();
            });
            await page.waitForTimeout(250);
            await expect(panel).toBeHidden();
            await expect(input).toHaveAttribute('aria-expanded', 'false');
            assert.equal(await input.getAttribute('aria-activedescendant'), null);
            if (scenario === 'pending-debounce')
              assert.equal(await page.evaluate(() => window.searchReads ?? 0), 0);
            if (scenario === 'composing-closed') {
              assert.equal(await page.evaluate(() => window.searchReads ?? 0), 0);
              await input.evaluate((el) =>
                el.dispatchEvent(
                  new CompositionEvent('compositionend', { bubbles: true, data: 'camera' }),
                ),
              );
              await expect(page.locator('a[href="/clipart/camera/"]')).toBeVisible();
            }
            row.passed = true;
          } catch (e) {
            row.failure = String(e);
          } finally {
            report.cases.push(row);
            await page.close();
          }
        }
    } finally {
      await browser.close();
    }
  }
  report.passed = report.cases.every((r) => r.passed) && report.errors.length === 0;
} finally {
  server.close();
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      passed: report.passed,
      cases: report.cases.length,
      failures: report.cases.filter((r) => !r.passed),
    }),
  );
}
if (!report.passed) process.exitCode = 1;
