import { chromium, webkit } from '@playwright/test';
import { checkSearchSuggestions } from '../helpers/search-suggestions-browser.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4323';
const out = process.env.EVIDENCE_DIR || 'reports/mobile-search-navigation';
const report = { base, engines: [] };
try {
  for (const [engine, launcher] of Object.entries({ chromium, webkit })) {
    const b = await launcher.launch();
    try {
      report.engines.push({
        engine,
        checks: await checkSearchSuggestions(b, base, engine),
        status: 'passed',
      });
    } finally {
      await b.close();
    }
  }
} finally {
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
