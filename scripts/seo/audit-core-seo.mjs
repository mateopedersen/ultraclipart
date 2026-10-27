import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { htmlFiles, htmlElements, decodeHtml } from './image-seo.mjs';

const SITE = 'https://ultraclipart.com';
const own = (value = '') => Buffer.from(value).toString('utf8');
const strip = (value = '') =>
  decodeHtml(value.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
const urlEntries = (xml) =>
  [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((m) => decodeHtml(m[1]));

export function auditCoreSeo({ root, directory }) {
  const errors = [],
    pages = [],
    indexable = new Map(),
    titleGroups = new Map();
  const fail = (page, field, detail) =>
    errors.push({ page: own(page), field, detail: own(detail) });
  const documentFor = (pathname) =>
    pathname.endsWith('.html')
      ? join(directory, pathname)
      : join(directory, pathname, 'index.html');
  const localFile = (pathname) =>
    existsSync(join(directory, pathname))
      ? join(directory, pathname)
      : join(root, 'public', pathname);
  let homeElements = [];
  for (const file of htmlFiles(directory)) {
    const page = relative(directory, file),
      html = readFileSync(file, 'utf8');
    const elements = htmlElements(html),
      before = errors.length;
    const metas = (name, attribute = 'name') =>
      elements.filter((e) => e.name === 'meta' && e.attributes[attribute] === name);
    const bodyStart = elements.find((e) => e.name === 'body')?.index ?? html.length;
    const titles = elements.filter((e) => e.name === 'title' && e.index < bodyStart);
    const canonicals = elements.filter(
      (e) => e.name === 'link' && e.attributes.rel === 'canonical',
    );
    const robots = metas('robots')
      .map((e) => e.attributes.content || '')
      .join(',');
    const noindex = /(?:^|[\s,])noindex(?:$|[\s,])/i.test(robots);
    const title = own(strip(titles[0]?.text)),
      description = own(metas('description')[0]?.attributes.content);
    const canonical = own(canonicals[0]?.attributes.href);
    if (titles.length !== 1 || !title)
      fail(page, 'title', 'Exactly one descriptive title is required');
    if (metas('description').length !== 1 || !description.trim())
      fail(page, 'description', 'Exactly one nonempty description is required');
    if (elements.filter((e) => e.name === 'h1').length !== 1)
      fail(page, 'h1', 'Exactly one main heading is required');
    if (metas('robots').length !== 1)
      fail(page, 'robots', 'Exactly one explicit robots policy is required');
    if (!elements.some((e) => e.name === 'html' && /^en(?:-US)?$/i.test(e.attributes.lang || '')))
      fail(page, 'language', 'Expected English page language');
    if (!metas('viewport').some((e) => /width=device-width/.test(e.attributes.content)))
      fail(page, 'viewport', 'Responsive viewport missing');
    let url;
    try {
      url = new URL(canonical);
      if (url.origin !== SITE || url.search || url.hash || canonicals.length !== 1) throw Error();
      if (!noindex && resolve(documentFor(url.pathname)) !== resolve(file)) throw Error();
    } catch {
      fail(page, 'canonical', canonical || 'Missing canonical');
    }
    if (!noindex && url) {
      if (indexable.has(url.href)) fail(page, 'duplicate canonical', url.href);
      indexable.set(url.href, page);
      const key = title.toLocaleLowerCase('en-US');
      const group = titleGroups.get(key) || [];
      group.push(page);
      titleGroups.set(key, group);
      if (!robots.includes('max-image-preview:large'))
        fail(page, 'image preview', 'Large image previews not enabled');
    }
    for (const name of [
      'og:title',
      'og:description',
      'og:url',
      'og:site_name',
      'og:image',
      'og:image:alt',
    ])
      if (
        metas(name, 'property').length !== 1 ||
        !metas(name, 'property')[0].attributes.content?.trim()
      )
        fail(page, name, 'Missing or repeated Open Graph field');
    if (metas('og:url', 'property')[0]?.attributes.content !== canonical)
      fail(page, 'og:url', 'Open Graph URL differs from canonical');
    for (const name of [
      'twitter:card',
      'twitter:title',
      'twitter:description',
      'twitter:image',
      'twitter:image:alt',
    ])
      if (!metas(name)[0]?.attributes.content?.trim()) fail(page, name, 'Missing social metadata');
    for (const element of elements.filter(
      (e) => e.name === 'script' && e.attributes.type === 'application/ld+json',
    )) {
      try {
        JSON.parse(element.text);
      } catch {
        fail(page, 'JSON-LD', 'Invalid structured data JSON');
      }
    }
    if (page === 'index.html') homeElements = elements;
    pages.push({ page, title, description, canonical, noindex, errors: errors.length - before });
    if (pages.length % 5000 === 0) console.log(`Core SEO scanned ${pages.length} HTML pages`);
  }
  const robots = readFileSync(localFile('/robots.txt'), 'utf8');
  if (!/^Sitemap:\s*https:\/\/ultraclipart\.com\/sitemap\.xml\s*$/m.test(robots))
    fail('robots.txt', 'sitemap discovery', 'Canonical sitemap index is missing');
  if (/^Disallow:\s*\/\s*$/m.test(robots))
    fail('robots.txt', 'crawl block', 'The whole site is blocked');
  const indexXml = readFileSync(join(directory, 'sitemap.xml'), 'utf8');
  const children = [...indexXml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)].map((m) =>
    decodeHtml(m[1]),
  );
  const sitemapPages = new Set(),
    sitemapImages = new Set(),
    sitemaps = [];
  for (const child of children) {
    const url = new URL(child);
    if (url.origin !== SITE || url.search || url.hash) {
      fail('sitemap.xml', 'foreign sitemap', child);
      continue;
    }
    const file = join(directory, url.pathname);
    if (!existsSync(file)) {
      fail('sitemap.xml', 'missing child', child);
      continue;
    }
    const bytes = readFileSync(file),
      xml = bytes.toString(),
      entries = urlEntries(xml);
    const image = xml.includes('xmlns:image=');
    if (entries.length > 50000 || bytes.length > 50 * 1024 ** 2)
      fail(url.pathname, 'sitemap limit', `${entries.length} URLs, ${bytes.length} bytes`);
    if (!entries.length) fail(url.pathname, 'empty sitemap', child);
    const seen = new Set();
    for (const loc of entries) {
      if (seen.has(loc)) fail(url.pathname, 'duplicate URL', loc);
      seen.add(loc);
      if (!indexable.has(loc)) fail(url.pathname, 'noncanonical or noindex URL', loc);
      if (!image && sitemapPages.has(loc))
        fail(url.pathname, 'URL repeated across page sitemaps', loc);
      (image ? sitemapImages : sitemapPages).add(loc);
    }
    sitemaps.push({ url: child, image, urls: entries.length, bytes: bytes.length });
  }
  for (const url of indexable.keys())
    if (!sitemapPages.has(url)) fail(indexable.get(url), 'sitemap omission', url);
  const pngIcon = homeElements.find(
    (e) => e.name === 'link' && e.attributes.rel === 'icon' && e.attributes.type === 'image/png',
  );
  if (!pngIcon) fail('index.html', 'favicon', 'A square PNG favicon is missing');
  else {
    const name = pngIcon.attributes.href,
      file = localFile(name);
    if (!existsSync(file)) fail('index.html', 'favicon file', name);
    else {
      const bytes = readFileSync(file);
      if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
        fail('index.html', 'favicon format', 'Declared PNG is not PNG');
      else if (bytes.readUInt32BE(16) !== bytes.readUInt32BE(20) || bytes.readUInt32BE(16) < 48)
        fail('index.html', 'favicon dimensions', 'Use a square icon at least 48px');
    }
  }
  const duplicateTitles = [...titleGroups]
    .filter(([, group]) => group.length > 1)
    .map(([title, pages]) => ({ title, pages }));
  const report = {
    date: new Date().toISOString(),
    buildDirectory: directory,
    publication: 'LOCAL_ONLY',
    scope:
      'Every compiled HTML page: technical metadata, canonical/noindex policy, structured JSON, social metadata, favicon and complete sitemap membership. This is not a fresh visual/content review or a Google indexing guarantee.',
    htmlPages: pages.length,
    indexablePages: indexable.size,
    noindexPages: pages.length - indexable.size,
    sitemapPages: sitemapPages.size,
    imageLandingPages: sitemapImages.size,
    sitemaps,
    errors,
    duplicateTitleReview: duplicateTitles,
  };
  const out = join(root, 'reports/seo-final');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'audit.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(out, 'pages.json'), JSON.stringify(pages));
  console.log(
    `Core SEO: ${pages.length} HTML, ${indexable.size} indexable, ${errors.length} errors, ${duplicateTitles.length} duplicate-title review groups`,
  );
  if (errors.length)
    throw Error(
      `Core SEO gate failed with ${errors.length} errors; see reports/seo-final/audit.json`,
    );
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  auditCoreSeo({
    root: resolve(import.meta.dirname, '../..'),
    directory: resolve(process.argv[2] || 'dist'),
  });
