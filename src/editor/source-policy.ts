export interface VerifiedRepresentation {
  url: string;
  bytes: number;
  sha256: string;
}

/** Saved projects never supply URLs. Page-owned catalog records use this allowlist. */
export function verifiedSourceUrl(
  file: VerifiedRepresentation,
  kind: 'webp' | 'pdf',
  origin: string,
): URL {
  const url = new URL(file.url, origin);
  const safePath =
    /^\/[a-z0-9][a-z0-9/_\-.]+$/.test(url.pathname) &&
    !url.pathname.includes('..') &&
    !url.pathname.includes('//');
  const local = url.origin === origin && /^\/(catalog|pilot)\//.test(url.pathname);
  const remote = url.origin === 'https://assets.ultraclipart.com';
  if (
    !safePath ||
    (!local && !remote) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    /[%\\]/.test(file.url) ||
    !url.pathname.endsWith(`.${kind}`) ||
    !Number.isSafeInteger(file.bytes) ||
    file.bytes < 1 ||
    file.bytes > (kind === 'pdf' ? 1_000_000 : 16_000_000) ||
    !/^[a-f0-9]{64}$/.test(file.sha256)
  )
    throw new Error('The artwork source is not a verified catalog file.');
  return url;
}
