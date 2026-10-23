import type { APIRoute } from 'astro';
import { getSearchBuild } from '../../lib/search-build';
export const prerender = true;
export async function getStaticPaths() {
  return [...(await getSearchBuild()).files].map(([path, data]) => ({
    params: { path },
    props: { data },
  }));
}
export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
