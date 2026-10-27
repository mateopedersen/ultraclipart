import {
  verifiedSourceUrl,
  type VerifiedRepresentation as Representation,
} from './source-policy.ts';
class StaleRepresentation extends Error {}
async function loadVerified(
  file: Representation,
  kind: 'webp' | 'pdf',
  origin = location.origin,
  signal?: AbortSignal,
) {
  const url = verifiedSourceUrl(file, kind, origin);
  const load = async (cache: RequestCache) => {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      cache,
      priority: 'high',
      redirect: 'error',
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
    });
    const mime = kind === 'pdf' ? 'application/pdf' : 'image/webp';
    if (
      !response.ok ||
      response.headers.get('content-type')?.split(';')[0] !== mime ||
      !response.body
    )
      throw new Error('The artwork could not be loaded. Reconnect and refresh to retry.');
    const buffer = new Uint8Array(file.bytes),
      reader = response.body.getReader();
    let offset = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (offset + value.byteLength > buffer.length) {
          await reader.cancel();
          throw new StaleRepresentation('Artwork source exceeds its verified size.');
        }
        buffer.set(value, offset);
        offset += value.byteLength;
      }
    } finally {
      reader.releaseLock();
    }
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('');
    if (offset !== file.bytes || hash !== file.sha256)
      throw new StaleRepresentation(
        'Artwork source verification failed. No edits or exports have been changed.',
      );
    return buffer;
  };
  try {
    return await load('default');
  } catch (error) {
    if (!(error instanceof StaleRepresentation)) throw error;
    // An old browser copy is repaired once, and the new bytes must still verify.
    return load('reload');
  }
}

// The head bootstrap can begin the same page-owned request while the larger
// editor module is still loading. Consume it once instead of fetching twice.
const prefetched = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();
function sourceKey(file: Representation, kind: 'webp' | 'pdf', origin: string) {
  const url = verifiedSourceUrl(file, kind, origin);
  return `${url.href}|${file.bytes}|${file.sha256}`;
}
export function prefetchVerified(
  file: Representation,
  kind: 'webp' | 'pdf',
  origin = location.origin,
  ready?: Promise<void>,
) {
  const key = sourceKey(file, kind, origin);
  if (!prefetched.has(key)) {
    const pending = ready
      ? ready.then(() => loadVerified(file, kind, origin))
      : loadVerified(file, kind, origin);
    prefetched.set(key, pending);
    // The editor owns the visible failure state. Avoid an unhandled rejection
    // before its module has consumed the same promise.
    void pending.catch(() => {});
  }
}
export async function readVerified(
  file: Representation,
  kind: 'webp' | 'pdf',
  origin = location.origin,
  signal?: AbortSignal,
) {
  if (signal) return loadVerified(file, kind, origin, signal);
  const key = sourceKey(file, kind, origin);
  const pending = prefetched.get(key);
  prefetched.delete(key);
  return pending ?? loadVerified(file, kind, origin);
}
