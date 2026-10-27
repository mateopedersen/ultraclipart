import type { APIRoute } from 'astro';
import { art, topics } from '../lib/catalog';
import { sitemapDocuments } from '../lib/sitemaps';
const documents = sitemapDocuments(art, topics);

export function getStaticPaths() {
  return documents.map((document) => ({
    params: { kind: document.kind },
  }));
}

export const GET: APIRoute = ({ params }) =>
  new Response(documents.find((document) => document.kind === params.kind)?.xml ?? 'Not found', {
    status: documents.some((document) => document.kind === params.kind) ? 200 : 404,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
