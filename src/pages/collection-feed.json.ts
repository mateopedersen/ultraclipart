import { collectionFeed } from '../lib/collection-feed';
export function GET() {
  return new Response(JSON.stringify(collectionFeed), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
