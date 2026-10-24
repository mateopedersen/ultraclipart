import { cuteSurpriseIndex } from '../lib/surprise-catalog';
export function GET() {
  return new Response(JSON.stringify({ version: 1, items: cuteSurpriseIndex }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
