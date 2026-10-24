import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const built = existsSync(dist);
function list(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? list(join(dir, e.name)) : [join(dir, e.name)],
  );
}
const pages = built ? list(dist).filter((path) => path.endsWith('.html')) : [];
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, 'i'))?.[2];
const tags = (text, tag) =>
  [...text.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))].map((match) => match[0]);
const routeExists = (pathname) =>
  existsSync(join(dist, pathname)) ||
  existsSync(join(dist, pathname, 'index.html')) ||
  existsSync(join(dist, `${pathname}.html`));

test(
  'every built page has English language, one H1 and consistent metadata',
  { skip: !built },
  () => {
    for (const file of pages) {
      const html = readFileSync(file, 'utf8');
      const label = relative(dist, file);
      assert.match(html, /<html\b[^>]*lang=["']en(?:-US)?["']/i, label);
      assert.equal([...html.matchAll(/<h1\b/gi)].length, 1, `one H1: ${label}`);
      assert.match(html, /<title>[^<]{8,}<\/title>/i, `title: ${label}`);
      assert.ok(
        tags(html, 'meta').some(
          (tag) =>
            attribute(tag, 'name') === 'description' &&
            (attribute(tag, 'content')?.length ?? 0) > 20,
        ),
        `description: ${label}`,
      );
      const canonicals = tags(html, 'link').filter((tag) => attribute(tag, 'rel') === 'canonical');
      assert.equal(canonicals.length, 1, `one canonical: ${label}`);
      const url = new URL(attribute(canonicals[0], 'href'));
      assert.equal(url.origin, 'https://ultraclipart.com', `canonical domain: ${label}`);
      assert.equal(url.search, '', `parameterless canonical: ${label}`);
      assert.equal(url.hash, '', `fragmentless canonical: ${label}`);
    }
  },
);

test('built internal links and images resolve to real output files', { skip: !built }, () => {
  for (const file of pages) {
    const html = readFileSync(file, 'utf8');
    const label = relative(dist, file);
    for (const tag of tags(html, 'a')) {
      const href = attribute(tag, 'href');
      if (!href?.startsWith('/') || href.startsWith('//')) continue;
      const url = new URL(href.replaceAll('&amp;', '&'), 'https://ultraclipart.com');
      assert.ok(routeExists(decodeURIComponent(url.pathname)), `broken link ${href} in ${label}`);
    }
    for (const tag of tags(html, 'img')) {
      assert.notEqual(attribute(tag, 'alt'), undefined, `missing ALT in ${label}`);
      assert.ok(
        Number(attribute(tag, 'width')) > 0 && Number(attribute(tag, 'height')) > 0,
        `missing dimensions in ${label}`,
      );
      const src = attribute(tag, 'src');
      assert.ok(src, `missing image source in ${label}`);
      if (src.startsWith('/') && !src.startsWith('//'))
        assert.ok(
          routeExists(new URL(src, 'https://ultraclipart.com').pathname),
          `broken image ${src} in ${label}`,
        );
    }
    for (const script of [
      ...html.matchAll(
        /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
      ),
    ]) {
      assert.doesNotThrow(() => JSON.parse(script[1]), `invalid JSON-LD: ${label}`);
    }
  }
});

test(
  'unfinished topic/art pages and search are noindex and absent from sitemaps',
  { skip: !built },
  () => {
    const topics = JSON.parse(readFileSync(join(root, 'data/topics.json'))).topics;
    const art = JSON.parse(readFileSync(join(root, 'data/art.json')));
    const sitemaps = list(dist)
      .filter((file) => /sitemap.*\.xml$/.test(file))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const noindex = (route) => {
      const file = join(dist, route, 'index.html');
      assert.ok(existsSync(file), `missing required route ${route}`);
      const html = readFileSync(file, 'utf8');
      assert.ok(
        tags(html, 'meta').some(
          (tag) =>
            attribute(tag, 'name') === 'robots' && /noindex/.test(attribute(tag, 'content') ?? ''),
        ),
        `unfinished page must be noindex: ${route}`,
      );
      assert.ok(
        !sitemaps.includes(`https://ultraclipart.com${route}`),
        `unfinished route in sitemap: ${route}`,
      );
    };
    noindex('/search/');
    for (const topic of topics) {
      const items = art.filter((item) => item.topic === topic.slug);
      if (!items.length) {
        assert.ok(
          !existsSync(join(dist, `clipart/${topic.slug}/index.html`)),
          `empty topic must not be published: ${topic.slug}`,
        );
      } else if (!items.some((item) => item.indexable)) noindex(`/clipart/${topic.slug}/`);
    }
    for (const item of art) if (!item.indexable) noindex(`/art/${item.id}/`);
  },
);
