import { categorySearchJson, categorySearchVersion } from '../../lib/category-search-index';
import type { APIRoute } from 'astro';
export const prerender = true;
export function getStaticPaths() {
  return [{ params: { version: categorySearchVersion } }];
}
export const GET: APIRoute = () =>
  new Response(categorySearchJson, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
