import { studioCompositionPreviews } from '../../lib/studio-composition-previews';
import type { APIRoute } from 'astro';
export const prerender = true;
export function getStaticPaths() {
  return studioCompositionPreviews.map((preview) => ({
    params: { id: preview.filename.replace(/\.svg$/, '') },
    props: { svg: preview.svg },
  }));
}
export const GET: APIRoute = ({ props }) =>
  new Response(props.svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
