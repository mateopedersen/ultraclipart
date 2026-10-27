import { chromium, webkit, firefox, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { contactTopics, contactFormLink } from '../../src/lib/contact.ts';
import { contactContentSecurityPolicy } from '../../scripts/contact-security.mjs';
import { inspectLayout } from '../helpers/layout-audit.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw Error('Local only');
const out = process.env.EVIDENCE_DIR || 'reports/contact/final';
mkdirSync(out, { recursive: true });
const liveGoogle = process.env.CONTACT_GOOGLE_LIVE === '1';
const engines = process.env.UC_BROWSER
  ? { [process.env.UC_BROWSER]: { chromium, webkit, firefox }[process.env.UC_BROWSER] }
  : { chromium, webkit };
const report = {
  started: new Date().toISOString(),
  scope:
    'Local Contact page. Real Google form read-only checks are opt-in. No response submission by this regression test; no physical device test.',
  liveGoogle,
  states: [],
  checks: [],
  failures: [],
};
const basePolicy = readFileSync('public/_headers', 'utf8').match(
  /^  Content-Security-Policy: (.+)$/m,
)[1];
for (const [engine, launcher] of Object.entries(engines)) {
  assert.ok(launcher);
  const browser = await launcher.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  // Exercise the same Contact CSP helper as normal packaging, with this HTML's exact inline hashes.
  await context.route(base + '/contact/', async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter(
        (m) =>
          !(
            /\bsrc\s*=/.test(m[1]) ||
            /type="application\/(?:ld\+)?json"/.test(m[1]) ||
            !m[2].trim()
          ),
      )
      .map((m) => `'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);
    const policy = contactContentSecurityPolicy(
      basePolicy.replace("script-src 'self'", `script-src 'self' ${hashes.join(' ')}`),
    );
    await route.fulfill({
      response,
      body: html,
      headers: { ...response.headers(), 'content-security-policy': policy },
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  try {
    assert.equal((await page.goto(base + '/contact/')).status(), 200);
    await expect(page.locator('h1')).toHaveText('Contact UltraClipart');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://ultraclipart.com/contact/',
    );
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute('content', /noindex/);
    await expect(page.locator('[data-contact-page]')).toHaveAttribute('data-contact-ready', 'true');
    const cookie = page.locator('[data-cookie-choice="necessary"]:visible').first();
    if (await cookie.count()) await cookie.click();
    for (const img of await page.locator('.contact-page img').all()) {
      await img.scrollIntoViewIfNeeded();
      await img.evaluate((img) => img.decode());
    }
    assert.equal(await page.locator('iframe').count(), 0);
    assert.ok(
      !requests.some((url) => /https:\/\/[^/]*google/.test(url)),
      'No Google request before explicit load',
    );
    for (const width of [320, 360, 390, 414, 600, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => scrollTo(0, 0));
      const layout = await page.evaluate(inspectLayout);
      assert.equal(layout.horizontalOverflow, false, `${width} overflow`);
      assert.deepEqual(layout.clipped, [], `${width} clipped`);
      assert.deepEqual(layout.escaped, [], `${width} escaped`);
      const heights = await page
        .locator('.contact-topic')
        .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().height));
      assert.ok(Math.max(...heights) - Math.min(...heights) < 2, 'equal topic cards');
      const axe = await new AxeBuilder({ page })
        .include('.contact-page')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      assert.deepEqual(
        axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, reason: n.failureSummary })),
        })),
        [],
        `${width} accessibility`,
      );
      if ([320, 390, 768, 1440].includes(width))
        await page.screenshot({ path: `${out}/${engine}-${width}.png`, fullPage: true });
      if (width === 1440)
        await page.locator('.contact-hero').screenshot({ path: `${out}/${engine}-hero.png` });
      report.states.push({ engine, width, passed: true, accessibilityViolations: 0 });
    }
    for (const topic of contactTopics) {
      await page.locator(`[data-contact-topic="${topic.id}"]`).click();
      await expect(page.locator('[data-contact-selected]')).toHaveText(topic.title);
      await expect(page.locator('[data-contact-help-link]')).toHaveAttribute('href', topic.href);
      assert.equal(
        await page.locator('[data-contact-direct]').getAttribute('href'),
        contactFormLink(topic.id),
      );
      assert.equal((await page.request.get(base + topic.href)).status(), 200, topic.href);
    }
    report.checks.push({
      engine,
      check:
        'Seven topic choices update guidance and valid official pre-filled links; help destinations return 200',
      passed: true,
    });
    await page.locator('details').first().locator('summary').click();
    await expect(page.locator('details').first()).toHaveAttribute('open', '');
    if (!liveGoogle)
      await context.route('https://docs.google.com/forms/**', (r) =>
        r.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html lang="en"><title>Google Forms UI fixture</title><body><label>Draft <input id="draft"></label></body></html>',
        }),
      );
    await page.locator('[data-contact-topic="downloads"]').click();
    await page.locator('[data-contact-load]').click();
    const frameElement = page.locator('.contact-frame-host iframe');
    await expect(frameElement).toHaveCount(1);
    await expect(frameElement).toHaveAttribute('src', contactFormLink('downloads', true));
    const frame = await (await frameElement.elementHandle()).contentFrame();
    if (liveGoogle) {
      await expect(
        frame.getByRole('heading', { name: 'Contact UltraClipart', exact: true }),
      ).toBeVisible({ timeout: 30000 });
      await expect(
        frame.getByRole('radio', { name: 'Download or printing problem', exact: true }),
      ).toBeChecked();
      const inputs = frame.getByRole('textbox');
      await expect(inputs).toHaveCount(4);
      await inputs.nth(0).fill('not-an-email');
      await inputs.nth(1).fill('Local UI test only; this draft is not submitted.');
      await frame.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(
        frame.getByText('Enter a valid reply email, such as name@example.com.', { exact: true }),
      ).toBeVisible();
      await inputs.nth(0).fill('qa@example.com');
      await page.locator('[data-contact-topic="studio"]').click();
      await expect(inputs.nth(1)).toHaveValue('Local UI test only; this draft is not submitted.');
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        assert.equal(
          await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          'Google Form fits its frame',
        );
        await expect(inputs.nth(1)).toHaveValue('Local UI test only; this draft is not submitted.');
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `${out}/${engine}-form-390.png`, fullPage: true });
      report.checks.push({
        engine,
        check:
          'Real Google Forms loaded anonymously inside the Contact CSP, correct topic pre-filled, required email validation displayed, changing tips preserved draft; no response submitted',
        passed: true,
      });
    } else {
      await frame.locator('#draft').fill('keep this draft');
      await page.locator('[data-contact-topic="studio"]').click();
      await expect(frame.locator('#draft')).toHaveValue('keep this draft');
      report.checks.push({
        engine,
        check:
          'Iframe mount and draft-preservation UI fixture only; real Google delivery not exercised in this run',
        passed: true,
      });
    }
    assert.equal(await frameElement.getAttribute('src'), contactFormLink('downloads', true));
    const plain = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    try {
      const p = await plain.newPage();
      assert.equal((await p.goto(base + '/contact/')).status(), 200);
      await expect(p.locator('.contact-no-script')).toBeVisible();
      await expect(p.locator('.contact-no-script')).toContainText('Google Form');
      assert.equal(
        await p.locator('[data-contact-direct]').getAttribute('href'),
        contactFormLink(),
      );
      assert.equal(await p.locator('iframe').count(), 0);
      await expect(p.locator('[data-contact-load]')).toBeHidden();
    } finally {
      await plain.close();
    }
    // Leave the visitor's filled form intact while inspecting the privacy destination.
    const privacy = await context.newPage();
    await privacy.goto(base + '/privacy/');
    await expect(privacy.locator('#providers')).toContainText('Google Forms contact form');
    for (const width of [320, 390, 768, 1440]) {
      await privacy.setViewportSize({ width, height: 900 });
      assert.equal(
        await privacy.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
    }
    const privacyScan = await new AxeBuilder({ page: privacy })
      .include('.trust-page')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    assert.deepEqual(
      privacyScan.violations.map((v) => v.id),
      [],
    );
    report.checks.push({
      engine,
      check: 'Updated Google Forms privacy disclosure, four widths and automated accessibility',
      passed: true,
    });
    await privacy.close();
    assert.deepEqual(errors, []);
    report.checks.push({
      engine,
      check: 'No-script form/email fallback and page runtime',
      passed: true,
    });
  } catch (error) {
    report.failures.push({ engine, error: error.stack, pageErrors: errors });
    await page.screenshot({ path: `${out}/${engine}-failure.png`, fullPage: true }).catch(() => {});
  } finally {
    await context.close();
    await browser.close();
  }
}
report.finished = new Date().toISOString();
writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
assert.deepEqual(report.failures, []);
