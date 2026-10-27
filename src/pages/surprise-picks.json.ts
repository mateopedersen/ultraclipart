import { cuteSurpriseIndex } from '../lib/surprise-catalog';
import { SURPRISE_INDEX_VERSION } from '../lib/cute-discovery';
export function GET() {
  return new Response(
    JSON.stringify({ version: SURPRISE_INDEX_VERSION, items: cuteSurpriseIndex }),
    {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    },
  );
}
