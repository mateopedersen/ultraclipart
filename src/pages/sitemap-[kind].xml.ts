import type { APIRoute } from 'astro';
import { art, topics } from '../lib/catalog';
import { approvedArt, imageSitemap, pageSitemap } from '../lib/sitemaps';

export function getStaticPaths() {
  return ['pages', ...(approvedArt(art).length ? ['images'] : [])].map((kind) => ({
    params: { kind },
  }));
}

export const GET: APIRoute = ({ params }) =>
  new Response(params.kind === 'images' ? imageSitemap(art) : pageSitemap(art, topics), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
