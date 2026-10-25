import type { APIRoute } from 'astro';

// Static/local previews have no trusted edge country. Unknown regions show the notice.
// The production worker handles this exact path using request.cf.country.
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ showNotice: true }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
