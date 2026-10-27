const SITE = 'https://ultraclipart.com';
export type LinkRelationship = 'reference' | 'sponsored' | 'ugc';
/** Shared authoring policy; ordinary editorial links remain ordinary links. */
export function contentLink(
  href: string,
  options: {
    target?: string | null;
    rel?: string | null;
    relationship?: LinkRelationship;
  } = {},
) {
  if (!href.trim()) throw Error('A content link needs a destination.');
  const url = new URL(href, SITE);
  if (!['https:', 'mailto:', 'tel:'].includes(url.protocol) || url.username || url.password)
    throw Error(`Unsupported content link destination: ${href}`);
  const external =
    url.protocol === 'https:' &&
    !['ultraclipart.com', 'www.ultraclipart.com', 'assets.ultraclipart.com'].includes(url.hostname);
  const rel = new Set(
    (options.rel ?? '')
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean),
  );
  if (options.target === '_blank') rel.add('noopener');
  if (options.relationship === 'sponsored' || options.relationship === 'ugc')
    rel.add(options.relationship);
  return {
    href,
    target: options.target ?? undefined,
    rel: rel.size ? [...rel].join(' ') : undefined,
    external,
  };
}
