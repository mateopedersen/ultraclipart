// Shortest disjoint prefix cover that never includes a protected current path.
// A terminal path gets an exact rule when longer protected names share its prefix.
function prefixCover(wanted, protectedPaths, prefix = '') {
  if (!wanted.length) return [];
  if (!protectedPaths.length) return [prefix + '*'];
  const rules = wanted.includes('') ? [prefix] : [];
  if (wanted.includes('') && protectedPaths.includes(''))
    throw new Error('A retired route overlaps a current static route');
  const letters = [...new Set(wanted.filter(Boolean).map((path) => path[0]))].sort();
  for (const letter of letters)
    rules.push(
      ...prefixCover(
        wanted.filter((path) => path.startsWith(letter)).map((path) => path.slice(1)),
        protectedPaths.filter((path) => path.startsWith(letter)).map((path) => path.slice(1)),
        prefix + letter,
      ),
    );
  return rules;
}
const variants = (paths) => [
  ...new Set(paths.flatMap((path) => [path.replace(/\/$/, ''), path.replace(/\/$/, '') + '/'])),
];
const compilePattern = (pattern) =>
  new RegExp(
    '^' +
      pattern
        .split('*')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      '$',
  );
const matches = (pattern, path) => compilePattern(pattern).test(path);
function subjectRoutes(root, missing, current, compact = false) {
  // Pages also serves its generated index.html files directly. A compact
  // wildcard must never send those current assets through the 404 Function.
  const guarded = (names) => [
    ...new Set(names.flatMap((name) => [name, `${name}/`, `${name}/index.html`])),
  ];
  const cover = (wanted, protectedNames, pathRoot = root) =>
    compact
      ? compactCover(
          wanted,
          guarded(protectedNames).map((name) => pathRoot + name),
          guarded(protectedNames),
          pathRoot,
        )
      : prefixCover(variants(wanted), variants(protectedNames)).map((name) => pathRoot + name);
  if (!missing.length) return { include: [], exclude: [] };
  const positive = {
    include: cover(missing, current),
    exclude: [],
  };
  const negative = {
    include: [root + '*'],
    exclude: cover(current, missing),
  };
  const choices = [positive, negative];
  if (
    compact &&
    Math.min(positive.include.length, negative.include.length + negative.exclude.length) > 60
  ) {
    const partitioned = { include: [], exclude: [] };
    for (const letter of [...new Set(missing.map((name) => name[0]))].sort()) {
      const absent = missing.filter((name) => name.startsWith(letter)).map((name) => name.slice(1));
      const present = current
        .filter((name) => name.startsWith(letter))
        .map((name) => name.slice(1));
      const pathRoot = root + letter;
      const plus = { include: cover(absent, present, pathRoot), exclude: [] };
      const minus = {
        include: [pathRoot + '*'],
        exclude: cover(present, absent, pathRoot),
      };
      const selected =
        plus.include.length <= minus.include.length + minus.exclude.length ? plus : minus;
      partitioned.include.push(...selected.include);
      partitioned.exclude.push(...selected.exclude);
    }
    choices.push(partitioned);
  }
  return choices.sort(
    (a, b) => a.include.length + a.exclude.length - b.include.length - b.exclude.length,
  )[0];
}

// Preserve contiguous common runs; insert wildcards only where the two names
// differ. A bounded pair search proposes covers, never authorizes them.
function commonGlob(a, b) {
  const lengths = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lengths[i][j] =
        a[i] === b[j] ? 1 + lengths[i + 1][j + 1] : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
  let i = 0,
    j = 0,
    previousI = -1,
    previousJ = -1,
    pattern = '';
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      if (i !== previousI + 1 || j !== previousJ + 1) pattern += '*';
      pattern += a[i];
      previousI = i++;
      previousJ = j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++;
    else j++;
  }
  return pattern + '*';
}

function compactCover(ids, protectedPaths, protectedSuffixes, root = '/*/') {
  const requiredSuffixes = root === '/*/' ? ['', '/'] : ['', '/', '/index.html'];
  const requiredPaths = [
    ...new Set(ids.flatMap((id) => requiredSuffixes.map((suffix) => id + suffix))),
  ];
  const baseline = prefixCover(requiredPaths, protectedSuffixes).map((pattern) => root + pattern);
  const candidates = new Set(baseline),
    names = [...ids].sort();
  let pairs = 0;
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length && pairs++ < 8192; j++)
      if (names[i].length <= 128 && names[j].length <= 128)
        candidates.add(root + commonGlob(names[i], names[j]));
  const safe = [...candidates]
    .filter((pattern) => pattern.length <= 100)
    .map((pattern) => ({ pattern, matcher: compilePattern(pattern) }))
    .filter(({ matcher }) => !protectedPaths.some((path) => matcher.test(path)))
    .map((candidate) => ({
      ...candidate,
      ids: names.filter((id) =>
        requiredSuffixes.every((suffix) =>
          candidate.matcher.test((root === '/*/' ? '/art/' : root) + id + suffix),
        ),
      ),
    }));
  const remaining = new Set(names),
    chosen = [];
  while (remaining.size) {
    const next = safe
      .map((candidate) => ({
        ...candidate,
        gain: candidate.ids.filter((id) => remaining.has(id)).length,
      }))
      .sort(
        (a, b) =>
          b.gain - a.gain ||
          a.pattern.length - b.pattern.length ||
          (a.pattern < b.pattern ? -1 : a.pattern > b.pattern ? 1 : 0),
      )[0];
    if (!next?.gain) return baseline;
    chosen.push(next.pattern);
    next.ids.forEach((id) => remaining.delete(id));
  }
  return chosen.length < baseline.length ? chosen : baseline;
}

/** Deleted Pages assets may remain cached. Keep every current page/resource
 * outside Functions, including after the catalog grows beyond 100 artwork IDs. */
export function retirementPolicy(
  topics,
  artwork,
  withdrawn = {},
  staticPaths = [],
  maxRules = 100,
) {
  if (!Number.isInteger(maxRules) || maxRules < 1 || maxRules > 100)
    throw new Error('Invalid Pages route budget');
  const available = new Set(artwork.map((item) => item.topic));
  const slug = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const existing = topics.filter((topic) => available.has(topic.slug));
  const activeClusters = new Set(existing.map((topic) => topic.cluster));
  const retired = [
    ...topics
      .filter((topic) => !available.has(topic.slug))
      .map((topic) => `/clipart/${topic.slug}/`),
    ...[...new Set(topics.map((topic) => topic.cluster))]
      .filter((cluster) => !activeClusters.has(cluster))
      .map((cluster) => `/collection/${slug(cluster)}/`),
  ];
  const activeIds = new Set(artwork.map((item) => item.id));
  const withdrawnIds = (withdrawn.artworkIds ?? []).filter((id) => !activeIds.has(id));
  const withdrawnPages = withdrawnIds.flatMap((id) => [`/art/${id}/`, `/edit/${id}/`]);
  const withdrawnAssets = withdrawn.assetPaths ?? [];
  retired.push(...withdrawnPages, ...withdrawnAssets.map((path) => `${path}/`));
  if (!retired.length) return null;
  const exact = retired.flatMap((path) => [path, path.slice(0, -1)]);
  const protectedPaths = variants([
    ...staticPaths,
    ...existing.map((topic) => `/clipart/${topic.slug}`),
    ...[...activeClusters].map((cluster) => `/collection/${slug(cluster)}`),
    ...artwork.flatMap((item) => [
      `/art/${item.id}`,
      `/edit/${item.id}`,
      ...['svg', 'pdf', 'webp', 'thumb']
        .map((kind) => item[kind])
        .filter((path) => typeof path === 'string' && path.startsWith('/')),
    ]),
  ]);
  // The wildcard can span folders, so protect every current path suffix, not
  // just art IDs. This also guards guides, UI bundles and source representations.
  const suffixes = (paths) => [
    ...new Set(
      paths.flatMap((path) => {
        const suffixes = [];
        for (let index = path.indexOf('/', 1); index >= 0; index = path.indexOf('/', index + 1))
          if (index + 1 < path.length) suffixes.push(path.slice(index + 1));
        return suffixes;
      }),
    ),
  ];
  const protectedSuffixes = suffixes(protectedPaths);
  const artifactRoutes = compactCover(withdrawnIds, protectedPaths, protectedSuffixes);
  const assetRoutes = [
    ...new Set(withdrawnAssets.map((path) => path.slice(0, path.lastIndexOf('/') + 1) + '*')),
  ];
  const topicRoutes = subjectRoutes(
    '/clipart/',
    topics.filter((topic) => !available.has(topic.slug)).map((topic) => topic.slug),
    existing.map((topic) => topic.slug),
  );
  const clusterRoutes = subjectRoutes(
    '/collection/',
    [...new Set(topics.map((topic) => topic.cluster))]
      .filter((cluster) => !activeClusters.has(cluster))
      .map(slug),
    [...activeClusters].map(slug),
  );
  let routes = {
    version: 1,
    include: [...topicRoutes.include, ...clusterRoutes.include, ...artifactRoutes, ...assetRoutes],
    exclude: [...topicRoutes.exclude, ...clusterRoutes.exclude],
  };
  // Prefer cheap prefix covers. As subjects fill in, compact the subject
  // partitions too; every candidate is checked against the opposite partition
  // and the final policy is checked against all real static resources below.
  if (routes.include.length + routes.exclude.length > maxRules) {
    const compactTopics = subjectRoutes(
      '/clipart/',
      topics.filter((topic) => !available.has(topic.slug)).map((topic) => topic.slug),
      existing.map((topic) => topic.slug),
      true,
    );
    const compactClusters = subjectRoutes(
      '/collection/',
      [...new Set(topics.map((topic) => topic.cluster))]
        .filter((cluster) => !activeClusters.has(cluster))
        .map(slug),
      [...activeClusters].map(slug),
      true,
    );
    routes = {
      version: 1,
      include: [
        ...compactTopics.include,
        ...compactClusters.include,
        ...artifactRoutes,
        ...assetRoutes,
      ],
      exclude: [...compactTopics.exclude, ...compactClusters.exclude],
    };
  }
  if (exact.length < routes.include.length + routes.exclude.length)
    routes = { version: 1, include: exact, exclude: [] };
  if (
    routes.include.length + routes.exclude.length > maxRules ||
    [...routes.include, ...routes.exclude].some((route) => route.length > 100)
  )
    throw new Error('Pages function route limit exceeded');
  for (const path of protectedPaths)
    if (
      routes.include.some((pattern) => matches(pattern, path)) &&
      !routes.exclude.some((pattern) => matches(pattern, path))
    )
      throw new Error(`Current static route would consume a Functions invocation: ${path}`);
  for (const path of exact)
    if (
      !routes.include.some((pattern) => matches(pattern, path)) ||
      routes.exclude.some((pattern) => matches(pattern, path))
    )
      throw new Error(`Withdrawn route would bypass its current 404 handler: ${path}`);
  return { retired, routes };
}

// Self-contained: this function is serialized into the Pages advanced worker.
export function createRetiredHandler(paths, securityHeaders = {}) {
  const retired = new Set(paths);
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
      if (!retired.has(path)) return env.ASSETS.fetch(request);
      const headers = new Headers(securityHeaders);
      headers.set('Cache-Control', 'no-store');
      headers.set('X-Robots-Tag', 'noindex');
      if (!['GET', 'HEAD'].includes(request.method)) {
        headers.set('Allow', 'GET, HEAD');
        return new Response(null, { status: 405, headers });
      }
      const source = new URL('/404.html', url.origin);
      try {
        const page = await env.ASSETS.fetch(new Request(source, { method: 'GET' }));
        headers.set('Content-Type', 'text/html; charset=utf-8');
        return new Response(request.method === 'HEAD' ? null : page.body, { status: 404, headers });
      } catch {
        headers.set('Content-Type', 'text/plain; charset=utf-8');
        return new Response(
          request.method === 'HEAD' ? null : 'This page is temporarily unavailable.',
          { status: 503, headers },
        );
      }
    },
  };
}
