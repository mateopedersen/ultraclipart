import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCatalogPage } from '../server/catalog/pages.mjs';

const html = '<!doctype html><title>Book artwork</title>';
const revision = 'a'.repeat(40);
const key = `html/${revision}/art/book-reading/index.html`;
const object = () => ({ httpEtag: '"reviewed-1"', body: new Response(html).body });

function setup() {
  const calls = [];
  const env = {
    CATALOG_PAGES: {
      async get(path) {
        calls.push(['get', path]);
        return [key, `html/${revision}/edit/book-reading/index.html`].includes(path)
          ? object()
          : null;
      },
      async head(path) {
        calls.push(['head', path]);
        return [key, `html/${revision}/edit/book-reading/index.html`].includes(path)
          ? object()
          : null;
      },
    },
  };
  const fallback = {
    async fetch(request) {
      calls.push(['fallback', new URL(request.url).pathname]);
      return new Response('static or 404', { status: 404 });
    },
  };
  const options = {
    pageHeaders: { 'Content-Security-Policy': "default-src 'self'" },
    editorHeaders: { 'Content-Security-Policy': "default-src 'self'; frame-src 'self'" },
    withdrawnIds: ['old-book'],
    revision,
  };
  const run = (path, init) =>
    handleCatalogPage(new Request('https://ultraclipart.com' + path, init), env, fallback, options);
  return { calls, run };
}

test('reviewed R2 HTML retains the canonical URL, SEO content and security headers', async () => {
  const { calls, run } = setup();
  const response = await run('/art/book-reading/');
  assert.equal(response.status, 200);
  assert.equal(await response.text(), html);
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(response.headers.get('Content-Security-Policy'), "default-src 'self'");
  assert.equal(response.headers.get('ETag'), '"reviewed-1"');
  assert.deepEqual(calls, [['get', key]]);
});

test('HEAD and conditional requests avoid downloading HTML', async () => {
  const { calls, run } = setup();
  const head = await run('/art/book-reading/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const cached = await run('/art/book-reading/', { headers: { 'If-None-Match': '"reviewed-1"' } });
  assert.equal(cached.status, 304);
  assert.deepEqual(calls, [
    ['head', key],
    ['get', key],
  ]);
});

test('missing and withdrawn records use the existing reviewed 404 policy', async () => {
  const { calls, run } = setup();
  assert.equal((await run('/art/unknown/')).status, 404);
  assert.equal((await run('/art/old-book/')).status, 404);
  assert.deepEqual(calls, [
    ['get', `html/${revision}/art/unknown/index.html`],
    ['fallback', '/art/unknown/'],
    ['fallback', '/art/old-book/'],
  ]);
});

test('canonical slash and editor controls are preserved', async () => {
  const { run } = setup();
  const redirect = await run('/art/book-reading?x=1');
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('Location'), 'https://ultraclipart.com/art/book-reading/?x=1');
  const invalid = await run('/art/book-reading/', { method: 'POST' });
  assert.equal(invalid.status, 405);
  const editor = await run('/edit/book-reading/');
  assert.equal(editor.status, 200);
  assert.equal(editor.headers.get('X-Robots-Tag'), 'noindex');
  assert.match(editor.headers.get('Content-Security-Policy'), /frame-src/);
});

test('R2 failures do not fall through to possibly stale static artwork', async () => {
  const { run } = setup();
  const failing = {
    CATALOG_PAGES: {
      async get() {
        throw Error('offline');
      },
    },
  };
  const response = await handleCatalogPage(
    new Request('https://ultraclipart.com/art/book-reading/'),
    failing,
    {
      async fetch() {
        throw Error('must not be called');
      },
    },
    { revision },
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await run('/art/' + 'a'.repeat(129) + '/')).status, 404);
});
