export type SourceType = 'layered' | 'raster';
export type RepresentationKind = 'svg' | 'webp' | 'pdf' | 'thumb';
export interface CatalogSource {
  id?: string;
  sourceType?: string;
  width?: number;
  height?: number;
  svg?: string | null;
  webp?: string;
  pdf?: string;
  thumb?: string;
  files?: Partial<Record<RepresentationKind, { bytes: number; sha256: string }>>;
}

/** Missing vector files are errors, never implicit conversions to image layers. */
export function sourceTypeOf(item: Pick<CatalogSource, 'sourceType'>): SourceType {
  const type = item.sourceType ?? 'layered';
  if (type !== 'layered' && type !== 'raster') throw new Error('Unknown artwork source type');
  return type;
}

export function representationKinds(item: Pick<CatalogSource, 'sourceType'>): RepresentationKind[] {
  return sourceTypeOf(item) === 'raster'
    ? ['webp', 'pdf', 'thumb']
    : ['svg', 'webp', 'pdf', 'thumb'];
}

/** Both the site build and the publication pipeline require an editor-compatible source.
 * Topics do not choose capabilities: the verified source representation does.
 */
export function validateEditorSource(item: CatalogSource): SourceType {
  const type = sourceTypeOf(item);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id ?? ''))
    throw new Error('Invalid editor artwork identity');
  if (![item.width, item.height].every((n) => Number.isInteger(n) && n! > 0 && n! <= 4096))
    throw new Error(`Invalid editor canvas dimensions: ${item.id}`);
  if (type === 'raster' && (item.svg != null || item.files?.svg != null))
    throw new Error('Raster artwork must not advertise a fabricated SVG source');
  for (const kind of representationKinds(item)) {
    const file = item.files?.[kind],
      path = item[kind];
    const cap = kind === 'webp' ? 16_000_000 : 1_000_000;
    if (
      typeof path !== 'string' ||
      !path ||
      !file ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 1 ||
      file.bytes > cap ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    )
      throw new Error(`Missing or invalid editor source: ${item.id}/${kind}`);
  }
  return type;
}
