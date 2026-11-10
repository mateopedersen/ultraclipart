import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
const out = resolve(process.env.EVIDENCE_DIR ?? 'reports/editor-recovery-quota');
mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4335';
const source = process.env.UC_EXPECTED_SOURCE;
const before = process.env.UC_EXPECT_RECOVERY_MISMATCH === '1';
const report = {
  status: 'RUNNING',
  scope:
    'Fresh isolated temporary Playwright contexts, actual app UI. Targeted storage failures are an explicit test model. Only the exact editor recovery localStorage setItem is synthetically quota-failed. No browser profile/user storage, backend mutations, global storage clearing, real quota flooding or app-source changes.',
  source: source ?? 'unasserted-local-source',
  inputs: Object.fromEntries(
    ['src/editor/editor.ts', 'src/editor/smart/storage.ts'].map((p) => [
      p,
      createHash('sha256').update(readFileSync(p)).digest('hex'),
    ]),
  ),
  cases: [],
  errors: [],
};
const saveReport = () => writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
async function snapshot(page, key) {
  return page.evaluate(async (key) => {
    let local;
    try {
      const raw = localStorage.getItem(key);
      local = raw ? JSON.parse(raw) : null;
    } catch {}
    const idb = await new Promise((resolve) => {
      const request = (window.__quotaFault?.nativeOpen ?? indexedDB.open.bind(indexedDB))(
        'ultraclipart-studio',
      );
      request.onupgradeneeded = () => {
        request.transaction.abort();
        resolve(null);
      };
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('projects')) {
          db.close();
          return resolve(null);
        }
        const read = db.transaction('projects').objectStore('projects').get(key);
        read.onsuccess = () => {
          db.close();
          resolve(read.result ?? null);
        };
        read.onerror = () => {
          db.close();
          resolve(null);
        };
      };
    });
    return {
      localLayers: local?.layers?.length ?? null,
      idbLayers: idb?.layers?.length ?? null,
      faults: window.__quotaFault?.attempts ?? [],
      canvasLayers: document.querySelectorAll('.uc-canvas [data-layer]').length,
    };
  }, key);
}
for (const engine of process.env.UC_BROWSER ? [process.env.UC_BROWSER] : ['chromium', 'webkit']) {
  const browser = await { chromium, webkit }[engine].launch(
    engine === 'chromium' && process.env.UC_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.UC_CHROMIUM_EXECUTABLE_PATH }
      : {},
  );
  try {
    for (let round = 1; round <= 2; round++)
      for (const scenario of before
        ? ['baseline', 'quota-immediate-old', 'quota-settled-old', 'quota-settled-empty']
        : [
            'baseline',
            'quota-immediate-old',
            'quota-settled-old',
            'quota-settled-empty',
            'both-write-fail',
            'both-write-hang',
            'revision-limit',
            'idb-read-hang-local',
          ]) {
        const row = { engine, round, scenario, status: 'RUNNING', errors: [] };
        report.cases.push(row);
        const c = await browser.newContext({
          acceptDownloads: true,
          viewport: { width: 1440, height: 1000 },
        });
        await c.addInitScript(() => {
          const native = Storage.prototype.setItem;
          const nativeOpen = indexedDB.open.bind(indexedDB),
            nativePut = IDBObjectStore.prototype.put;
          window.__quotaFault = {
            active: false,
            key: null,
            attempts: [],
            nativeOpen,
            writeFail: false,
            openHang: false,
          };
          indexedDB.open = function (name, ...args) {
            if (
              name === 'ultraclipart-studio' &&
              (window.__quotaFault.openHang ||
                sessionStorage.getItem('qa-recovery-read-hang') === '1')
            )
              return {};
            return nativeOpen(name, ...args);
          };
          IDBObjectStore.prototype.put = function (value, key) {
            if (
              this.name === 'projects' &&
              key === window.__quotaFault.key &&
              window.__quotaFault.writeFail
            )
              throw new DOMException('Targeted synthetic IDB quota', 'QuotaExceededError');
            return nativePut.call(this, value, key);
          };
          Storage.prototype.setItem = function (key, value) {
            const s = window.__quotaFault;
            if (this === window.localStorage && s.active && key === s.key) {
              s.attempts.push({ at: performance.now(), key, bytes: String(value).length });
              throw new DOMException('Targeted synthetic quota test', 'QuotaExceededError');
            }
            return native.call(this, key, value);
          };
        });
        const p = await c.newPage();
        p.on('pageerror', (e) => row.errors.push(e.message));
        try {
          const response = await p.goto(base + '/edit/pumpkin-hot-air-balloon/', {
            waitUntil: 'domcontentloaded',
          });
          assert.equal(response.status(), 200);
          if (source) assert.equal(response.headers()['x-uc-revision'], source);
          row.source = response.headers()['x-uc-revision'];
          row.root = response.headers()['x-uc-snapshot'];
          await expect(p.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', {
            timeout: 15000,
          });
          await expect(p.locator('.uc-canvas [data-layer]')).toHaveCount(1);
          const key = await p
            .locator('.uc-editor')
            .evaluate((e) => 'ultraclipart:editor:v1:' + e.dataset.artId);
          row.key = key;
          const cookie = p.getByRole('button', { name: 'Necessary Only', exact: true });
          if (await cookie.isVisible()) await cookie.click();
          await p.locator('button[data-work-mode=edit]').click();
          const textPanel = p.locator('[data-panel=text]').filter({ visible: true }).first();
          await textPanel.click();
          await p.locator('[data-text]').fill('Recovery diagnostic');
          await p.locator('[data-action=text]').click();
          await expect(p.locator('.uc-canvas [data-layer]')).toHaveCount(2);
          // Seed through real edit/undo UI, not a fabricated stored project.
          await p.locator('[data-action=undo]').filter({ visible: true }).first().click();
          await expect(p.locator('.uc-canvas [data-layer]')).toHaveCount(1);
          await expect.poll(async () => (await snapshot(p, key)).idbLayers).toBe(1);
          row.seed = await snapshot(p, key);
          if (scenario === 'quota-settled-empty') {
            await p.evaluate((key) => localStorage.removeItem(key), key);
            row.removedOnlyOwnRecoveryKey = true;
          }
          if (
            scenario !== 'baseline' &&
            scenario !== 'revision-limit' &&
            scenario !== 'idb-read-hang-local'
          )
            await p.evaluate((key) => {
              window.__quotaFault.key = key;
              window.__quotaFault.active = true;
            }, key);
          if (scenario === 'both-write-fail')
            await p.evaluate(() => (window.__quotaFault.writeFail = true));
          if (scenario === 'both-write-hang' || scenario === 'idb-read-hang-local')
            await p.evaluate(() => (window.__quotaFault.openHang = true));
          if (scenario === 'revision-limit')
            await p.evaluate((key) => {
              const doc = JSON.parse(localStorage.getItem(key));
              doc._ucRecovery = {
                format: 'ultraclipart-editor-recovery-v1',
                revision: Number.MAX_SAFE_INTEGER - 1,
                writer: 'qa-limit',
              };
              localStorage.setItem(key, JSON.stringify(doc));
            }, key);
          await textPanel.click();
          await p.locator('[data-text]').fill('Recovery diagnostic ' + round);
          await p.locator('[data-action=text]').click();
          await expect(p.locator('.uc-canvas [data-layer]')).toHaveCount(2);
          await p.locator('[data-panel=create]').filter({ visible: true }).first().click();
          const menu = p.locator('.wb-file-menu');
          if (!(await menu.evaluate((e) => e.open))) await menu.locator('summary').click();
          const downloadPromise = p.waitForEvent('download', { timeout: 10000 });
          row.lastActionAt = Date.now();
          await p.evaluate(() => {
            document.querySelector('[data-shape=star]').click();
          });
          await expect(p.locator('.uc-canvas [data-layer]')).toHaveCount(3);
          if (scenario.includes('settled'))
            await expect.poll(async () => (await snapshot(p, key)).idbLayers).toBe(3);
          row.beforeSave = await snapshot(p, key);
          await menu.locator('[data-action=save]').click();
          const download = await downloadPromise;
          row.saveStatus = await p.locator('[data-status]').innerText();
          row.beforeReload = await snapshot(p, key);
          row.editToReloadMs = Date.now() - row.lastActionAt;
          if (scenario === 'idb-read-hang-local')
            await p.evaluate(() => sessionStorage.setItem('qa-recovery-read-hang', '1'));
          await p.reload({ waitUntil: 'domcontentloaded' });
          await expect(p.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', {
            timeout: 15000,
          });
          row.afterReload = await snapshot(p, key);
          const stream = await download.createReadStream();
          const chunks = [];
          for await (const b of stream) chunks.push(b);
          const bytes = Buffer.concat(chunks),
            project = JSON.parse(bytes);
          assert.equal('_ucRecovery' in project, false);
          row.downloadLayers = project.layers.length;
          row.downloadBytes = bytes.length;
          assert.equal(row.downloadLayers, 3);
          row.recoveredLayers = row.afterReload.canvasLayers;
          const fallback = ['both-write-fail', 'both-write-hang', 'revision-limit'].includes(
            scenario,
          );
          if (fallback) {
            assert.match(row.saveStatus, /Browser recovery is unavailable/);
            assert.equal(row.recoveredLayers, 1);
            row.status = 'PORTABLE_BACKUP_DOWNLOADED_WITH_EXPLICIT_RECOVERY_WARNING';
          } else if (before && scenario.includes('-old')) {
            assert.equal(row.recoveredLayers, 1);
            row.status = 'EXPECTED_OLD_RECOVERY_MISMATCH_REPRODUCED';
          } else {
            assert.equal(row.recoveredLayers, 3);
            row.status = 'RECOVERY_MATCHED_DOWNLOADED_PROJECT';
          }
          if (scenario.startsWith('quota-') || scenario.startsWith('both-'))
            assert(row.beforeReload.faults.length > 0);
          await p.screenshot({ path: join(out, `${engine}-${round}-${scenario}.png`) });
        } catch (e) {
          row.status = 'HARNESS_OR_PRODUCT_FAILURE';
          row.error = String(e);
          report.errors.push({ engine, round, scenario, error: String(e) });
          await p
            .screenshot({ path: join(out, `${engine}-${round}-${scenario}-failure.png`) })
            .catch(() => {});
        } finally {
          await c.close();
          saveReport();
        }
        console.log(
          JSON.stringify({
            engine,
            round,
            scenario,
            status: row.status,
            recovered: row.recoveredLayers,
            download: row.downloadLayers,
            before: row.beforeReload,
            ms: row.editToReloadMs,
          }),
        );
      }
  } finally {
    await browser.close();
  }
}
report.passed = !report.errors.length;
report.status = report.passed
  ? before
    ? 'NEGATIVE_BASELINE_REPRODUCED'
    : 'RECOVERY_AND_PORTABLE_BACKUP_REGRESSION_PASSED'
  : 'REGRESSION_FAILURE';
saveReport();
console.log(report.status);
assert(report.passed);
