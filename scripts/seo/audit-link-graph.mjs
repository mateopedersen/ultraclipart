import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { htmlFiles, htmlElements, decodeHtml, isNoindex } from './image-seo.mjs';
const SITE = 'https://ultraclipart.com';
const own = new Set(['ultraclipart.com', 'www.ultraclipart.com']);
const detach = (text) => Buffer.from(text ?? '').toString('utf8');
const csv = (values) =>
  values.map((value) => '"' + String(value ?? '').replaceAll('"', '""') + '"').join(',');
const fileRoute = (built, file) =>
  '/' +
  relative(built, file)
    .replaceAll('\\', '/')
    .replace(/index\.html$/, '');
export function linkKind(href, route = '/') {
  let url;
  try {
    url = new URL(href, SITE + route);
  } catch {
    return { kind: 'invalid', href };
  }
  if (url.protocol === 'mailto:' || url.protocol === 'tel:') return { kind: 'contact', url };
  if (!['http:', 'https:'].includes(url.protocol)) return { kind: 'unsafe', url };
  if (url.username || url.password) return { kind: 'unsafe', url };
  if (own.has(url.hostname)) return { kind: 'internal', url };
  if (url.hostname === 'assets.ultraclipart.com') return { kind: 'owned-media', url };
  return { kind: 'external', url };
}
export function anchorName(html, token, elements) {
  const attrs = token.attributes;
  if (attrs['aria-label']?.trim()) return attrs['aria-label'].trim();
  const end = html.indexOf('</a>', token.end);
  const inside = end < 0 ? '' : html.slice(token.end, end);
  const text = decodeHtml(inside.replace(/<svg\b[\s\S]*?<\/svg>/gi, '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  if (text) return text;
  const image = elements.find((e) => e.name === 'img' && e.index >= token.end && e.index < end);
  return image?.attributes.alt?.trim() || attrs.title?.trim() || '';
}
export function auditLinkGraph({ root, directory, failOnError = true }) {
  const out = join(root, 'reports/linking');
  mkdirSync(out, { recursive: true });
  const files = [...htmlFiles(directory)];
  const pages = new Map(
    files.map((file) => {
      const route = fileRoute(directory, file);
      return [
        route,
        {
          route,
          file,
          indexable: false,
          targets: new Set(),
          mainTargets: new Set(),
          internal: 0,
          external: 0,
          fragments: 0,
          incoming: 0,
          mainIncoming: 0,
          depth: null,
        },
      ];
    }),
  );
  const paths = new Map(),
    external = new Map(),
    fragments = new Map(),
    issueMap = new Map();
  const stats = {
    htmlPages: files.length,
    anchors: 0,
    internalAnchors: 0,
    externalAnchors: 0,
    ownedMediaAnchors: 0,
    contactAnchors: 0,
    sameDocumentFragments: 0,
    checkedCrossDocumentFragments: 0,
    emptyNames: 0,
    runtimeDownloads: 0,
  };
  function issue(kind, target, page, severity = 'error') {
    const key = `${kind}:${target}`;
    const prior = issueMap.get(key);
    if (prior) {
      prior.instances++;
      if (prior.examples.length < 4 && !prior.examples.includes(page))
        prior.examples.push(detach(page));
    } else
      issueMap.set(key, {
        kind,
        target: detach(target),
        severity,
        instances: 1,
        examples: [detach(page)],
      });
  }
  let cursor = 0;
  for (const page of pages.values()) {
    const html = readFileSync(page.file, 'utf8'),
      elements = htmlElements(html);
    page.indexable = !isNoindex(elements);
    const main = elements.find((e) => e.name === 'main'),
      mainEnd = main ? html.indexOf('</main>', main.end) : -1;
    const ids = new Set(elements.map((e) => e.attributes.id).filter(Boolean));
    for (const token of elements) {
      if (token.name !== 'a') continue;
      const attrs = token.attributes,
        href = attrs.href;
      stats.anchors++;
      if (href === undefined) {
        issue('anchor-without-href', '(missing)', page.route);
        continue;
      }
      if (!href.trim()) {
        if (attrs.download !== undefined || attrs['aria-disabled'] === 'true') {
          stats.runtimeDownloads++;
          continue;
        }
        issue('empty-href', '(empty)', page.route);
        continue;
      }
      const result = linkKind(href, page.route);
      if (result.kind === 'invalid' || result.kind === 'unsafe') {
        issue('unsafe-or-invalid-href', href, page.route);
        continue;
      }
      const name = anchorName(html, token, elements);
      if (!name) {
        stats.emptyNames++;
        issue('empty-link-name', href, page.route);
      }
      const inMain = main && token.index > main.end && token.index < mainEnd;
      if (result.kind === 'contact') {
        stats.contactAnchors++;
        continue;
      }
      const url = result.url,
        rel = new Set((attrs.rel ?? '').toLowerCase().split(/[\s,]+/));
      if (attrs.target === '_blank' && !rel.has('noopener') && !rel.has('noreferrer'))
        issue('new-tab-missing-opener-protection', url.href, page.route);
      if (result.kind === 'owned-media') {
        stats.ownedMediaAnchors++;
        continue;
      }
      if (result.kind === 'external') {
        stats.externalAnchors++;
        page.external++;
        const key = detach(url.href);
        let entry = external.get(key);
        if (!entry) {
          entry = {
            url: key,
            instances: 0,
            pages: [],
            labels: [],
            newTab: attrs.target === '_blank',
            rel: [...rel].filter(Boolean),
          };
          external.set(key, entry);
        }
        entry.instances++;
        if (entry.pages.length < 8 && !entry.pages.includes(page.route))
          entry.pages.push(detach(page.route));
        if (entry.labels.length < 5 && !entry.labels.includes(name))
          entry.labels.push(detach(name));
        if (url.protocol !== 'https:') issue('insecure-external-link', key, page.route);
        continue;
      }
      stats.internalAnchors++;
      page.internal++;
      let path, fragment;
      try {
        path = detach(decodeURIComponent(url.pathname));
        fragment = detach(decodeURIComponent(url.hash.slice(1)));
      } catch {
        issue('invalid-url-encoding', href, page.route);
        continue;
      }
      if (!paths.has(path))
        paths.set(path, { path, firstSeenOn: page.route, label: detach(name), count: 0 });
      paths.get(path).count++;
      if (path !== page.route) {
        page.targets.add(path);
        if (inMain) page.mainTargets.add(path);
      }
      if (fragment) {
        page.fragments++;
        if (path === page.route) {
          stats.sameDocumentFragments++;
          if (!ids.has(fragment))
            issue('missing-same-page-fragment', `${path}#${fragment}`, page.route);
        } else {
          const key = `${path}#${fragment}`;
          if (!fragments.has(key)) fragments.set(key, { path, fragment, firstSeenOn: page.route });
        }
      }
      if (own.has(url.hostname) && url.hostname !== 'ultraclipart.com')
        issue('noncanonical-site-host', url.href, page.route, 'warning');
      if (rel.has('nofollow')) issue('internal-nofollow', href, page.route, 'warning');
    }
    if (++cursor % 5000 === 0)
      console.log(
        `Link audit: ${cursor} pages, ${stats.anchors} anchors, ${issueMap.size} issue groups.`,
      );
  }
  const redirects = readFileSync(join(root, 'public/_redirects'), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(/\s+/));
  const redirected = [],
    dynamic = [];
  for (const [path, info] of paths) {
    if (path.startsWith('/api/') || path.startsWith('/share/')) {
      dynamic.push(info);
      continue;
    }
    const redirect = redirects.find(
      ([from]) => from === path || (from.endsWith('*') && path.startsWith(from.slice(0, -1))),
    );
    if (redirect) {
      redirected.push({ ...info, destination: redirect[1] });
      issue('internal-redirect', path, info.firstSeenOn, 'warning');
      continue;
    }
    const present = [directory, join(root, 'public')].some((dir) => {
      const target = resolve(dir, '.' + path);
      return (
        (target === dir || target.startsWith(dir + '/')) &&
        existsSync(target) &&
        (statSync(target).isFile() || existsSync(join(target, 'index.html')))
      );
    });
    if (!present) issue('missing-internal-target', path, info.firstSeenOn);
  }
  const requestedFragments = new Map();
  for (const entry of fragments.values()) {
    const list = requestedFragments.get(entry.path) ?? [];
    list.push(entry);
    requestedFragments.set(entry.path, list);
  }
  for (const [path, entries] of requestedFragments) {
    const destination = pages.get(path);
    if (!destination) continue;
    const ids = new Set(
      htmlElements(readFileSync(destination.file, 'utf8'))
        .map((e) => e.attributes.id)
        .filter(Boolean),
    );
    for (const entry of entries) {
      stats.checkedCrossDocumentFragments++;
      if (!ids.has(entry.fragment))
        issue('missing-cross-page-fragment', `${path}#${entry.fragment}`, entry.firstSeenOn);
    }
  }
  for (const page of pages.values()) {
    for (const target of page.targets) if (pages.has(target)) pages.get(target).incoming++;
    for (const target of page.mainTargets) if (pages.has(target)) pages.get(target).mainIncoming++;
  }
  const home = pages.get('/'),
    queue = home ? [home] : [];
  if (home) home.depth = 0;
  for (let i = 0; i < queue.length; i++)
    for (const target of queue[i].targets) {
      const child = pages.get(target);
      if (child?.indexable && child.depth === null) {
        child.depth = queue[i].depth + 1;
        queue.push(child);
      }
    }
  const indexable = [...pages.values()].filter((p) => p.indexable);
  const orphans = indexable.filter((p) => p.route !== '/' && p.incoming === 0).map((p) => p.route);
  const unreachable = indexable.filter((p) => p.depth === null).map((p) => p.route);
  for (const page of orphans) issue('orphan-indexable-page', page, page);
  for (const page of unreachable) issue('no-indexable-crawl-path', page, page);
  const issues = [...issueMap.values()];
  const report = {
    date: new Date().toISOString(),
    buildDirectory: directory,
    scope:
      'Every compiled HTML anchor and its local destination/fragment; indexable-only crawl graph. Not a live HTTP test of all destinations or a semantic review of every link.',
    ...stats,
    distinctInternalPaths: paths.size,
    uniqueExternalUrls: external.size,
    indexablePages: indexable.length,
    orphans,
    unreachable,
    maximumIndexableDepth: Math.max(
      ...indexable.filter((p) => p.depth !== null).map((p) => p.depth),
    ),
    depthCounts: Object.fromEntries(
      [...new Set(indexable.map((p) => p.depth))].map((d) => [
        String(d),
        indexable.filter((p) => p.depth === d).length,
      ]),
    ),
    errors: issues.filter((i) => i.severity === 'error'),
    warnings: issues.filter((i) => i.severity === 'warning'),
    redirected,
    dynamic,
  };
  writeFileSync(join(out, 'audit.json'), JSON.stringify(report, null, 2));
  writeFileSync(
    join(out, 'external-inventory.json'),
    JSON.stringify([...external.values()], null, 2),
  );
  writeFileSync(
    join(out, 'sayfa-baglantilari.csv'),
    '\ufeff' +
      csv([
        'Sayfa',
        'İndekslenebilir',
        'İç bağlantı',
        'Dış bağlantı',
        'Farklı hedef sayfa',
        'Gelen sayfa',
        'İçerikten gelen sayfa',
        'İndekslenebilir tıklama derinliği',
      ]) +
      '\n' +
      [...pages.values()]
        .map((p) =>
          csv([
            p.route,
            p.indexable ? 'Evet' : 'Hayır',
            p.internal,
            p.external,
            p.targets.size,
            p.incoming,
            p.mainIncoming,
            p.depth,
          ]),
        )
        .join('\n'),
  );
  console.log(
    JSON.stringify({
      pages: files.length,
      anchors: stats.anchors,
      externalUrls: external.size,
      errors: report.errors.length,
      warnings: report.warnings.length,
      orphans: orphans.length,
      unreachable: unreachable.length,
    }),
  );
  if (failOnError && report.errors.length)
    throw Error(
      `Link audit failed; see reports/linking/audit.json (${report.errors.length} groups).`,
    );
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(import.meta.dirname, '../..');
  auditLinkGraph({
    root,
    directory: resolve(root, process.env.LINK_BUILD_DIR || 'work/performance-build'),
    failOnError: process.env.LINK_BASELINE !== '1',
  });
}
