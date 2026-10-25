import { catalogStatistics } from '../lib/catalog-statistics';

export const prerender = true;
export function GET() {
  return new Response(JSON.stringify(catalogStatistics), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
