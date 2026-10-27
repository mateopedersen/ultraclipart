// Build-time catalog image metadata. No browser mutation, network or user storage.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { imageObject, absoluteImageUrl } from '../../src/lib/image-schema.ts';
import { previewUrls, previewIdentity } from '../preview-assets.mjs';

export function decodeHtml(value = '') {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, name) => {
    if (name[0] === '#') {
      const hex = name[1].toLowerCase() === 'x';
      const point = parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\ufffd';
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }[name.toLowerCase()];
  });
}

// Tokens for compiler-produced HTML: quoted > characters and raw-text elements
// are consumed together. JavaScript strings/comments/templates are not real images.
export function htmlElements(html, { headOnly = false } = {}) {
  const tags = /<!--[\s\S]*?-->|<![^>]*>|<\/?([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi;
  const elements = [];
  let token,
    templateDepth = 0;
  while ((token = tags.exec(html))) {
    if (!token[1]) continue;
    const name = token[1].toLowerCase(),
      closing = token[0][1] === '/';
    if (name === 'template') {
      templateDepth += closing ? -1 : 1;
      templateDepth = Math.max(0, templateDepth);
      continue;
    }
    if (closing) continue;
    const attributes = {};
    for (const match of token[2].matchAll(
      /([^\s=/'"<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s'"=<>`]+)))?/g,
    ))
      attributes[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
    let text = '';
    if (['script', 'style', 'textarea', 'title'].includes(name)) {
      const end = new RegExp(`</${name}\\s*>`, 'gi');
      end.lastIndex = tags.lastIndex;
      const close = end.exec(html);
      if (close) {
        text = html.slice(tags.lastIndex, close.index);
        tags.lastIndex = end.lastIndex;
      }
    }
    if (!templateDepth)
      elements.push({ name, attributes, text, index: token.index, end: tags.lastIndex });
    if (headOnly && !templateDepth && name === 'body') break;
  }
  return elements;
}

export function imageSchemas(value, result = []) {
  if (Array.isArray(value)) value.forEach((child) => imageSchemas(child, result));
  else if (value && typeof value === 'object') {
    if ([value['@type']].flat().includes('ImageObject')) result.push(value);
    Object.values(value).forEach((child) => imageSchemas(child, result));
  }
  return result;
}

export function createImageIndex(catalog, { publishedAssets = null, previewIndex = {} } = {}) {
  const index = new Map();
  function add(url, record) {
    if (!url) return;
    const key = absoluteImageUrl(url);
    const prior = index.get(key);
    if (prior && prior.item.id !== record.item.id)
      throw Error(`Ambiguous catalog image URL: ${key}`);
    index.set(key, { ...record, url: key });
  }
  for (const source of catalog.filter((item) => item.published && item.indexable)) {
    const urls = previewUrls(source),
      files = previewIndex[previewIdentity(source)]?.files ?? {};
    const item = {
      ...source,
      webp: publishedAssets?.[source.id]?.webp ?? source.webp,
      thumb: files[440] ? urls[440] : (publishedAssets?.[source.id]?.thumb ?? source.thumb),
    };
    for (const kind of ['webp', 'svg']) {
      add(source[kind], { item, width: source.width, height: source.height });
      add(publishedAssets?.[source.id]?.[kind], {
        item,
        width: source.width,
        height: source.height,
      });
    }
    // Original thumbnail dimensions are not inferred from the original image.
    add(source.thumb, { item, width: null, height: null });
    add(publishedAssets?.[source.id]?.thumb, { item, width: null, height: null });
    for (const [size, file] of Object.entries(files))
      add(urls[size], { item, width: file.width, height: file.height });
  }
  return index;
}

export const isNoindex = (elements) =>
  elements.some(
    ({ name, attributes: a }) =>
      name === 'meta' &&
      /^(robots|googlebot)$/i.test(a.name ?? '') &&
      /\b(noindex|none)\b/i.test(a.content ?? ''),
  );

export function renderedCatalogImages(elements, index) {
  const result = new Map();
  for (const { name, attributes: a } of elements) {
    if (name !== 'img' || !a.src || !a.alt?.trim()) continue;
    const record = index.get(absoluteImageUrl(a.src));
    if (!record) continue;
    result.set(record.url, record);
  }
  return [...result.values()];
}

export function attachImageMetadata(html, index) {
  // Re-running the hook must not accumulate duplicate graphs.
  html = html.replace(/<script\b[^>]*\bid="catalog-image-metadata"[^>]*>[\s\S]*?<\/script>/gi, '');
  html = deferLargeStructuredData(html);
  const elements = htmlElements(html);
  if (isNoindex(elements)) return { html, images: 0, added: 0, noindex: true };
  const known = new Set();
  for (const { name, attributes: a, text } of elements)
    if (name === 'script' && a.type === 'application/ld+json')
      for (const image of imageSchemas(JSON.parse(text))) known.add(image.contentUrl);
  const images = renderedCatalogImages(elements, index);
  const graph = images
    .filter((record) => !known.has(record.url))
    .map((record) =>
      imageObject(record.item, {
        contentUrl: record.url,
        width: record.width,
        height: record.height,
      }),
    );
  if (!graph.length) return { html, images: images.length, added: 0, noindex: false };
  const data = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  if (!html.includes('</body>'))
    throw Error('Cannot attach image metadata without a document body.');
  return {
    html: html.replace(
      '</body>',
      `<script id="catalog-image-metadata" type="application/ld+json">${data}</script></body>`,
    ),
    images: images.length,
    added: graph.length,
    noindex: false,
  };
}

// JSON-LD is supported in the document body. Keep large, non-rendering metadata
// after visible content so a slow connection can render the heading first.
// Preserve the exact script bytes, schemas and order; never move executable JS.
export function deferLargeStructuredData(html) {
  const elements = htmlElements(html, { headOnly: true });
  const body = elements.find((element) => element.name === 'body');
  if (!body) return html;
  const scripts = elements.filter(
    (element) =>
      element.index < body.index &&
      element.name === 'script' &&
      element.attributes.type === 'application/ld+json' &&
      element.text.length > 4096,
  );
  if (!scripts.length) return html;
  const closing = html.lastIndexOf('</body>');
  if (closing < body.index)
    throw Error('Cannot relocate metadata without a complete document body.');
  let output = '',
    cursor = 0;
  for (const script of scripts) {
    output += html.slice(cursor, script.index);
    cursor = script.end;
  }
  output += html.slice(cursor, closing);
  output += scripts.map((script) => html.slice(script.index, script.end)).join('');
  return output + html.slice(closing);
}

export function* htmlFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

export function buildImageMetadata({ root, directory, catalog, publishedAssets = null }) {
  const previewIndex = JSON.parse(readFileSync(join(root, '.astro/preview-assets.json'), 'utf8'));
  const index = createImageIndex(catalog, { publishedAssets, previewIndex });
  const summary = {
    date: new Date().toISOString(),
    buildDirectory: resolve(directory),
    pages: 0,
    indexablePages: 0,
    noindexPages: 0,
    catalogImageInstances: 0,
    addedSchemas: 0,
    changedPages: 0,
  };
  for (const file of htmlFiles(directory)) {
    const before = readFileSync(file, 'utf8');
    const result = attachImageMetadata(before, index);
    summary.pages++;
    if (summary.pages % 5000 === 0)
      console.log(`Image SEO metadata: ${summary.pages} pages scanned.`);
    summary[result.noindex ? 'noindexPages' : 'indexablePages']++;
    summary.catalogImageInstances += result.images;
    summary.addedSchemas += result.added;
    if (before !== result.html) {
      writeFileSync(file, result.html);
      summary.changedPages++;
    }
  }
  const out = join(root, 'reports/image-seo');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'build-metadata.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(`Image SEO: ${summary.pages} pages, ${summary.addedSchemas} catalog image schemas.`);
  return summary;
}
