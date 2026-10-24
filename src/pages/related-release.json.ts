import { relatedIndex } from '../lib/related/service';
export function GET() {
  return new Response(JSON.stringify({ version: relatedIndex.version }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
