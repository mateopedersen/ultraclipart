/// <reference lib="webworker" />
import {
  prepareCategorySearch,
  scoreCategory,
  type PreparedCategory,
} from '../lib/category-search';
const scope = self as unknown as DedicatedWorkerGlobalScope;
let source = '';
let prepared: Promise<PreparedCategory[]> | undefined;
function records(): Promise<PreparedCategory[]> {
  return (prepared ??= (async () => {
    const url = new URL(source, scope.location.origin);
    if (
      url.origin !== scope.location.origin ||
      !/^\/category-search\/[a-f0-9]{64}\.json$/.test(url.pathname)
    )
      throw Error('Invalid subject index');
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw Error('Subject index unavailable');
    const data = await response.json();
    if (data.version !== 1 || !Array.isArray(data.subjects) || data.subjects.length > 10000)
      throw Error('Invalid subject index');
    const ids = new Set<string>();
    return data.subjects.map(
      (item: { id: string; name: string; groups: string; keywords: string }) => {
        if (
          !item ||
          typeof item.id !== 'string' ||
          ids.has(item.id) ||
          !/^[a-z0-9-]+$/.test(item.id) ||
          typeof item.name !== 'string' ||
          typeof item.groups !== 'string' ||
          typeof item.keywords !== 'string' ||
          item.keywords.length > 100000
        )
          throw Error('Invalid subject record');
        ids.add(item.id);
        return prepareCategorySearch(item);
      },
    );
  })().catch((error) => {
    prepared = undefined;
    throw error;
  }));
}
scope.addEventListener('message', async ({ data }) => {
  if (data.type === 'init') {
    source = data.url;
    void records().catch(() => {});
    return;
  }
  if (data.type !== 'search' || !Number.isInteger(data.id) || typeof data.query !== 'string')
    return;
  try {
    const entries = await records();
    const scores = entries.map((record) => [
      record.item.id,
      scoreCategory(data.query.slice(0, 160), record),
    ]);
    scope.postMessage({ type: 'result', id: data.id, scores });
  } catch {
    scope.postMessage({ type: 'error', id: data.id });
  }
});
