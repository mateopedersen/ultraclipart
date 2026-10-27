import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contentLink } from '../src/lib/content-link.ts';
import { auditLinkGraph, linkKind } from '../scripts/seo/audit-link-graph.mjs';

const document = (body, noindex = false) =>
  `<!doctype html><html><head><meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow'}"></head><body><main id="main">${body}</main></body></html>`;
function fixture(pages, run) {
  const root = mkdtempSync(join(tmpdir(), 'ultraclipart-link-audit-'));
  const directory = join(root, 'build');
  mkdirSync(join(root, 'public'), { recursive: true });
  writeFileSync(join(root, 'public/_redirects'), '/old/ /help/ 301\n');
  for (const [route, html] of Object.entries(pages)) {
    const file = join(
      directory,
      route === '/' ? 'index.html' : route.slice(1),
      route === '/' ? '' : 'index.html',
    );
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, html);
  }
  try {
    return run(auditLinkGraph({ root, directory, failOnError: false }), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test('ordinary internal and external references are not given blanket nofollow', () => {
  for (const href of ['/license/', 'https://www.w3.org/TR/WCAG22/']) {
    const link = contentLink(href);
    assert.equal(link.rel, undefined);
    assert.equal(link.href, href);
  }
  assert.equal(contentLink('/license/').external, false);
  assert.equal(contentLink('https://www.w3.org/TR/WCAG22/').external, true);
});
test('new tabs are protected; sponsored/UGC relationships and existing tokens are preserved', () => {
  assert.equal(contentLink('https://example.com', { target: '_blank' }).rel, 'noopener');
  assert.equal(
    contentLink('https://example.com', {
      target: '_blank',
      rel: 'ugc,nofollow',
      relationship: 'sponsored',
    }).rel,
    'ugc nofollow noopener sponsored',
  );
  assert.equal(contentLink('https://example.com', { relationship: 'ugc' }).rel, 'ugc');
});
test('authored references reject empty destinations, executable protocols and embedded credentials', () => {
  for (const href of [
    '',
    'javascript:alert(1)',
    'data:text/html,test',
    'https://name:secret@example.com',
    'http://example.com',
  ])
    assert.throws(() => contentLink(href));
  assert.doesNotThrow(() => contentLink('mailto:ultraclipart@gmail.com'));
});
test('owned media is not mistaken for a third-party editorial reference', () => {
  assert.equal(linkKind('https://assets.ultraclipart.com/a.webp').kind, 'owned-media');
  assert.equal(linkKind('/clipart/baby/').kind, 'internal');
  assert.equal(linkKind('https://www.w3.org/TR/WCAG22/').kind, 'external');
});
test('minified image-only anchors use their own alt; root paths and valid fragments resolve', () => {
  fixture(
    {
      '/': document(
        '<a href="/help/#files"><img src="/example.webp" alt="File format guide"></a><a href="#main">Main content</a>',
      ),
      '/help/': document('<h1 id="files">Files</h1><a href="/">Home</a>'),
    },
    (report) => {
      assert.deepEqual(report.errors, []);
      assert.equal(report.emptyNames, 0);
      assert.equal(report.maximumIndexableDepth, 1);
      assert.equal(report.checkedCrossDocumentFragments, 1);
    },
  );
});
test('the release gate detects broken destinations, stale fragments and unnamed links', () => {
  fixture(
    {
      '/': document(
        '<a href="/missing/">Missing</a><a href="#absent">Section</a><a href="/help/#old">Old section</a><a href="/help/"></a>',
      ),
      '/help/': document('<h1 id="current">Help</h1>'),
    },
    (report) => {
      const kinds = new Set(report.errors.map((e) => e.kind));
      for (const kind of [
        'missing-internal-target',
        'missing-same-page-fragment',
        'missing-cross-page-fragment',
        'empty-link-name',
      ])
        assert.ok(kinds.has(kind));
    },
  );
});
test('indexable pages cannot depend entirely on noindex bridge pages for discovery', () => {
  fixture(
    {
      '/': document('<a href="/bridge/">Tools</a>'),
      '/bridge/': document('<a href="/hidden/">Hidden page</a>', true),
      '/hidden/': document('<h1>Hidden</h1>'),
    },
    (report) => {
      assert.deepEqual(report.unreachable, ['/hidden/']);
      assert.deepEqual(report.orphans, []);
    },
  );
});
test('redirects are reported without confusing them with missing pages; new-tab protection is checked', () => {
  fixture(
    {
      '/': document(
        '<a href="/old/">Old</a><a href="/help/">Help</a><a href="https://example.com/" target="_blank">Reference</a>',
      ),
      '/help/': document('<h1>Help</h1>'),
    },
    (report) => {
      assert.equal(report.redirected.length, 1);
      assert.ok(report.warnings.some((i) => i.kind === 'internal-redirect'));
      assert.ok(report.errors.some((i) => i.kind === 'new-tab-missing-opener-protection'));
      assert.ok(!report.errors.some((i) => i.kind === 'missing-internal-target'));
    },
  );
});
test('the two Builder policy links use section IDs present in the shared policy source', () => {
  const source = readFileSync('src/pages/ai-clipart-generator.astro', 'utf8');
  const pages = JSON.parse(readFileSync('data/trust-pages.json', 'utf8')).pages;
  for (const page of ['privacy', 'terms']) {
    assert.ok(source.includes(`/${page}/#builder`));
    assert.ok(pages[page].sections.some((section) => section.id === 'builder'));
  }
});
