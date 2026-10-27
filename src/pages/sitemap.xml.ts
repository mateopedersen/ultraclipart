import type { APIRoute } from 'astro';
import { art, topics } from '../lib/catalog';
import { sitemapIndex } from '../lib/sitemaps';

export const GET: APIRoute = () =>
  new Response(sitemapIndex(art, topics), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
