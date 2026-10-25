/** The static Astro preview has no Cloudflare bindings. Never pretend it generated an image. */
export function previewAiResponse(path, method) {
  const route = path.split('?')[0].replace(/\/$/, '');
  if (
    !['/api/ai/clipart/health', '/api/ai/clipart/quota', '/api/ai/clipart/generate'].includes(route)
  )
    return;
  const expected = route.endsWith('/generate') ? 'POST' : 'GET';
  if (method !== expected) return { status: 405, body: { error: 'method_not_allowed' } };
  return route.endsWith('/health')
    ? { status: 200, body: { enabled: false } }
    : { status: 503, body: { error: 'service_not_configured', enabled: false } };
}
export function aiPreviewNotice() {
  return {
    name: 'ultraclipart-ai-preview',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const result = previewAiResponse(request.url || '', request.method);
        if (!result) return next();
        response.statusCode = result.status;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify(result.body));
      });
    },
  };
}
