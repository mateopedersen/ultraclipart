/** Deleted Pages assets may remain cached. Route only unavailable collections
 * through a tiny explicit 404 handler; real pages/assets remain static/free. */
export function retirementPolicy(topics, artwork, withdrawn = {}) {
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
  const exclude = [
    ...existing.map((topic) => `/clipart/${topic.slug}/*`),
    ...[...activeClusters].map((cluster) => `/collection/${slug(cluster)}/*`),
  ];
  const artifactRoutes = withdrawnPages.map((path) => `${path.slice(0, -1)}*`);
  const assetRoutes = [
    ...new Set(withdrawnAssets.map((path) => path.slice(0, path.lastIndexOf('/') + 1) + '*')),
  ];
  const routes =
    exact.length <= exclude.length + 2
      ? { version: 1, include: exact, exclude: [] }
      : {
          version: 1,
          include: ['/clipart/*', '/collection/*', ...artifactRoutes, ...assetRoutes],
          exclude,
        };
  // Large future withdrawals can use two broad prefixes without exceeding Pages' limit.
  if (routes.include.length + routes.exclude.length > 100 && artifactRoutes.length) {
    routes.include = ['/clipart/*', '/collection/*', '/art/*', '/edit/*', ...assetRoutes];
    routes.exclude = exclude;
  }
  if (routes.include.length + routes.exclude.length > 100)
    throw new Error('Pages function route limit exceeded');
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
