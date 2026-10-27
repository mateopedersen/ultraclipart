import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  IMAGE_SITE,
  IMAGE_LICENSE,
  IMAGE_COPYRIGHT,
  absoluteImageUrl,
} from '../../src/lib/image-schema.ts';
import {
  createImageIndex,
  htmlFiles,
  htmlElements,
  imageSchemas,
  isNoindex,
  renderedCatalogImages,
  decodeHtml,
} from './image-seo.mjs';
import { imageFileSignature } from './image-file-signature.mjs';
import { readReviewedImportCatalog } from '../reviewed-imports.mjs';

export function auditImageSeo({ root, directory, catalog, publishedAssets = null }) {
  const eligible = catalog.filter((a) => a.published && a.indexable);
  const index = createImageIndex(catalog, {
    publishedAssets,
    previewIndex: JSON.parse(readFileSync(join(root, '.astro/preview-assets.json'), 'utf8')),
  });
  const errors = [],
    rows = [],
    sourceFiles = new Set(),
    metadata = new Set();
  const counts = {
    htmlPages: 0,
    indexablePages: 0,
    noindexPages: 0,
    imageInstances: 0,
    informativeImages: 0,
    decorativeImages: 0,
    catalogImageInstances: 0,
    imageSchemas: 0,
    indexableCatalogImages: 0,
    licensedRenderedImages: 0,
    srcsetCandidates: 0,
    localImageSignatures: 0,
  };
  // V8 substring views can keep a complete HTML document alive. Retained report
  // values must own their short strings rather than retaining gigabytes of HTML.
  const detached = (value) =>
    typeof value === 'string' ? Buffer.from(value).toString('utf8') : value;
  const fail = (page, field, value) => errors.push({ page, field, value: detached(value) });
  for (const file of htmlFiles(directory)) {
    const page = relative(directory, file),
      before = errors.length;
    const elements = htmlElements(readFileSync(file, 'utf8'));
    const noindex = isNoindex(elements);
    counts.htmlPages++;
    counts[noindex ? 'noindexPages' : 'indexablePages']++;
    const canonical = elements.find((e) => e.name === 'link' && e.attributes.rel === 'canonical')
      ?.attributes.href;
    if (!canonical?.startsWith(IMAGE_SITE)) fail(page, 'canonical', canonical);
    if (!noindex) {
      const robots = elements.find((e) => e.name === 'meta' && e.attributes.name === 'robots')
        ?.attributes.content;
      if (!robots?.includes('max-image-preview:large'))
        fail(page, 'large image preview permission', robots);
    }
    const schemas = [];
    for (const { name, attributes: a, text } of elements) {
      if (name !== 'script' || a.type !== 'application/ld+json') continue;
      try {
        imageSchemas(JSON.parse(text), schemas);
      } catch {
        fail(page, 'invalid JSON-LD', a.id || 'unnamed script');
      }
    }
    const schemaUrls = new Set();
    for (const node of schemas) {
      counts.imageSchemas++;
      const record = index.get(node.contentUrl);
      if (!record) continue; // Do not assign clipart rights to portraits or guide screenshots.
      schemaUrls.add(node.contentUrl);
      const item = record.item;
      if (
        node.name !== item.title ||
        node.description !== item.description ||
        node.caption !== item.alt
      )
        fail(page, 'catalog schema wording', item.id);
      if (
        node.creator?.['@type'] !== 'Organization' ||
        node.creator.name !== 'UltraClipart' ||
        node.creator.url !== IMAGE_SITE ||
        node.creditText !== 'UltraClipart' ||
        node.copyrightNotice !== IMAGE_COPYRIGHT ||
        node.license !== IMAGE_LICENSE ||
        node.acquireLicensePage !== IMAGE_LICENSE
      )
        fail(page, 'catalog image rights metadata', item.id);
      if (!node['@id'] || !node.url?.startsWith(IMAGE_SITE + 'art/'))
        fail(page, 'image identity', item.id);
      const expectedType = /\.svg(?:$|[?#])/i.test(node.contentUrl)
        ? 'image/svg+xml'
        : 'image/webp';
      if (node.encodingFormat !== expectedType) fail(page, 'image encoding format', item.id);
      if (record.width && (node.width !== record.width || node.height !== record.height))
        fail(page, 'schema pixel dimensions', item.id);
    }
    let pageImages = 0;
    for (const { name, attributes: a } of elements) {
      if (name !== 'img') continue;
      counts.imageInstances++;
      pageImages++;
      if (!Object.hasOwn(a, 'alt')) fail(page, 'missing alt attribute', a.src);
      if (a.alt?.trim()) {
        counts.informativeImages++;
        if (!a.title?.trim()) fail(page, 'missing title', a.src);
      } else counts.decorativeImages++;
      if (!a.src || a.src.startsWith('data:')) continue;
      const url = absoluteImageUrl(a.src),
        record = index.get(url);
      if (!Number(a.width) || !Number(a.height)) fail(page, 'missing image dimensions', a.src);
      sourceFiles.add(url);
      if (record && a.alt?.trim()) {
        counts.catalogImageInstances++;
        if (a.alt !== record.item.alt || a.title !== record.item.title)
          fail(page, 'rendered image wording', record.item.id);
      }
      if (a.srcset && record) {
        for (const candidate of a.srcset.split(',')) {
          const [path, descriptor] = candidate.trim().split(/\s+/);
          const variant = index.get(absoluteImageUrl(path));
          counts.srcsetCandidates++;
          if (!variant || variant.item.id !== record.item.id || descriptor !== `${variant.width}w`)
            fail(page, 'responsive image source or width', candidate);
          sourceFiles.add(absoluteImageUrl(path));
        }
        if (!a.sizes) fail(page, 'missing responsive sizes', a.src);
      }
    }
    const rendered = renderedCatalogImages(elements, index);
    if (!noindex)
      for (const image of rendered) {
        counts.indexableCatalogImages++;
        if (!schemaUrls.has(image.url))
          fail(page, 'rendered catalog image lacks license schema', image.url);
        else counts.licensedRenderedImages++;
        metadata.add(image.item.id);
      }
    if (noindex && elements.some((e) => e.attributes.id === 'catalog-image-metadata'))
      fail(page, 'generated image graph on noindex page', canonical);
    rows.push({
      page,
      canonical: detached(canonical),
      indexable: !noindex,
      images: pageImages,
      catalogImages: rendered.length,
      imageSchemas: schemas.length,
      errors: errors.length - before,
    });
    if (counts.htmlPages % 5000 === 0)
      console.log(
        `Image SEO audit: ${counts.htmlPages} pages, ${errors.length} errors, ${Math.round(process.memoryUsage().heapUsed / 1048576)} MiB heap.`,
      );
  }
  for (const value of sourceFiles) {
    const url = new URL(value);
    if (url.origin !== new URL(IMAGE_SITE).origin) continue;
    const path = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const asset = existsSync(join(directory, path))
      ? join(directory, path)
      : join(root, 'public', path);
    if (!existsSync(asset)) fail('(assets)', 'missing local image or responsive candidate', value);
    else {
      counts.localImageSignatures++;
      if (!imageFileSignature(asset).valid)
        fail('(assets)', 'image bytes do not match filename format', value);
    }
  }
  const xml = readFileSync(join(directory, 'sitemap-images.xml'), 'utf8');
  const imageLocations = [...xml.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((m) =>
    decodeHtml(m[1]),
  );
  const expected = new Set(
    eligible.map((a) => absoluteImageUrl(publishedAssets?.[a.id]?.webp ?? a.webp)),
  );
  if (imageLocations.length !== eligible.length || new Set(imageLocations).size !== eligible.length)
    fail('(sitemap-images.xml)', 'image count or duplicate original URL', imageLocations.length);
  for (const url of imageLocations)
    if (!expected.has(url)) fail('(sitemap-images.xml)', 'unexpected original', url);
  if (/<image:(caption|title|license|geo_location)>/.test(xml))
    fail('(sitemap-images.xml)', 'deprecated image sitemap field', 'found');
  const pageMap = readFileSync(join(directory, 'sitemap-pages.xml'), 'utf8');
  const sitemapPages = [...pageMap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decodeHtml(m[1]));
  const indexed = new Map(rows.map((r) => [r.canonical, r]));
  for (const url of sitemapPages)
    if (!indexed.get(url)?.indexable)
      fail('(sitemap-pages.xml)', 'missing or noindex destination', url);
  for (const item of eligible) {
    const url = new URL(`art/${encodeURIComponent(item.id)}/`, IMAGE_SITE).href;
    if (!indexed.get(url)?.indexable) fail('(catalog)', 'missing indexable detail page', item.id);
    if (!metadata.has(item.id))
      fail('(catalog)', 'artwork never represented in indexable HTML', item.id);
  }
  const report = {
    date: new Date().toISOString(),
    buildDirectory: resolve(directory),
    mode: publishedAssets ? 'published-cdn' : 'local',
    scope:
      'Exhaustive compiled HTML, catalog schema, responsive source and sitemap consistency. Not a visual review of every image or a Google indexing guarantee.',
    ...counts,
    uniqueLocalAndRemoteSources: sourceFiles.size,
    eligibleArtwork: eligible.length,
    imageSitemapOriginals: imageLocations.length,
    pageSitemapEntries: sitemapPages.length,
    errors,
  };
  const out = join(root, 'reports/image-seo');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'audit.json'), JSON.stringify(report, null, 2) + '\n');
  const csv = (cells) =>
    cells.map((s) => '"' + String(s ?? '').replaceAll('"', '""') + '"').join(',');
  writeFileSync(
    join(out, 'sayfa-denetimi.csv'),
    '\ufeff' +
      csv([
        'Sayfa',
        'Kanonik URL',
        'Indekslenebilir',
        'Gorsel',
        'Katalog gorseli',
        'Gorsel semasi',
        'Hata',
      ]) +
      '\n' +
      rows
        .map((r) =>
          csv([
            r.page,
            r.canonical,
            r.indexable ? 'Evet' : 'Hayir',
            r.images,
            r.catalogImages,
            r.imageSchemas,
            r.errors,
          ]),
        )
        .join('\n'),
  );
  console.log(
    `Image SEO audit: ${counts.htmlPages} pages, ${eligible.length} artwork, ${errors.length} errors.`,
  );
  if (errors.length)
    throw Error(
      `Image SEO audit failed: ${errors.length} errors. See reports/image-seo/audit.json`,
    );
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(import.meta.dirname, '../..');
  const catalog = readReviewedImportCatalog(root);
  let publishedAssets = null;
  if (process.env.CF_PAGES === '1') {
    const { readPublication } = await import('../publication-policy.mjs');
    publishedAssets = readPublication(root).assetUrls;
  }
  auditImageSeo({
    root,
    directory: resolve(root, process.env.METADATA_BUILD_DIR || 'dist'),
    catalog,
    publishedAssets,
  });
}
