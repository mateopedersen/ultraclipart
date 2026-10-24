const canonical = /^\/(art|edit)\/([a-z0-9]+(?:-[a-z0-9]+)*)(\/?)$/;

/** Serve reviewed HTML from private R2 while retaining static Pages routes for the
 * existing catalog. An absent object must never be treated as an empty page. */
export async function handleCatalogPage(request, env, fallback, options = {}) {
  const url = new URL(request.url);
  const match = canonical.exec(url.pathname);
  if (!match) return fallback.fetch(request, env);
  const [, section, id, slash] = match;
  if (id.length > 128) return new Response('Not found', { status: 404 });
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  if (options.withdrawnIds?.includes(id)) return fallback.fetch(request, env);
  if (!slash) {
    url.pathname += '/';
    return Response.redirect(url, 308);
  }
  if (!env.CATALOG_PAGES) return fallback.fetch(request, env);
  if (!/^[a-f0-9]{40}$/.test(options.revision ?? '')) return fallback.fetch(request, env);

  const key = `html/${options.revision}/${section}/${id}/index.html`;
  let object;
  try {
    object =
      request.method === 'HEAD'
        ? await env.CATALOG_PAGES.head(key)
        : await env.CATALOG_PAGES.get(key);
  } catch {
    return new Response('Catalog page temporarily unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (!object) return fallback.fetch(request, env);

  const headers = new Headers(section === 'edit' ? options.editorHeaders : options.pageHeaders);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=300');
  headers.set('ETag', object.httpEtag);
  if (section === 'edit') headers.set('X-Robots-Tag', 'noindex');
  if (request.headers.get('If-None-Match') === object.httpEtag)
    return new Response(null, { status: 304, headers });
  return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
}
