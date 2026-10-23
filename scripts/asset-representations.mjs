/** An absent SVG never silently downgrades a layered artwork into a raster one. */
export function sourceTypeOf(item) {
  const type = item.sourceType ?? 'layered';
  if (!['layered', 'raster'].includes(type)) throw new Error('Unknown artwork source type');
  return type;
}

export function representationKinds(item) {
  return sourceTypeOf(item) === 'raster'
    ? ['webp', 'pdf', 'thumb']
    : ['svg', 'webp', 'pdf', 'thumb'];
}
