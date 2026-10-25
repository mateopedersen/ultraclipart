/** Use edge-provided country data, never a country supplied by the browser. */
export function cookieRegion(request) {
  return { showNotice: request.cf?.country !== 'US' };
}

export function handleCookieRegion(request) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
  if (!['GET', 'HEAD'].includes(request.method))
    return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
  return new Response(request.method === 'HEAD' ? null : JSON.stringify(cookieRegion(request)), {
    headers,
  });
}
