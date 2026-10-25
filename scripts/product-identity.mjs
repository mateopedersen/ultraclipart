// Product identity is an editorial decision grounded in pixels and primary sources.
// Filenames, release rumors and a matching color are never model evidence.
export function reviewedProductMetadata(record, { sourceSha256 } = {}) {
  if (
    !record ||
    record.reviewedFromPixels !== true ||
    !/^[a-f0-9]{64}$/.test(record.sourceSha256 ?? '')
  )
    throw new Error('A product needs a review tied to the actual source image');
  if (sourceSha256 && sourceSha256 !== record.sourceSha256)
    throw new Error('Product image changed after identity review');
  if (
    typeof record.sourcePath !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9/._-]+$/.test(record.sourcePath) ||
    record.sourcePath.split('/').includes('..')
  )
    throw new Error('Product review needs the project-relative source image path');
  if (
    !['recognized-product', 'product-family', 'imagined-concept', 'brand-scene'].includes(
      record.kind,
    )
  )
    throw new Error('Unsupported product identification level');
  if (!record.subject?.trim() || !record.caption?.trim() || !record.evidence?.trim())
    throw new Error('Product identification needs a title, visual description and evidence');
  const reference = new URL(record.reference);
  if (
    reference.protocol !== 'https:' ||
    !record.manufacturerDomains?.some(
      (domain) => reference.hostname === domain || reference.hostname.endsWith('.' + domain),
    )
  )
    throw new Error('Product names need a manufacturer reference');
  if (record.model && record.kind !== 'recognized-product')
    throw new Error('Ambiguous or fictional illustrations cannot claim an exact production model');
  if (record.kind === 'recognized-product' && !record.model)
    throw new Error('Recognized products need the reviewed model name');
  if (
    record.kind === 'imagined-concept' &&
    !/concept|imagined/i.test(record.subject + ' ' + record.caption)
  )
    throw new Error('An imagined design must be clearly described as a concept');
  return {
    subject: record.subject,
    caption: record.caption,
    productIdentity: {
      brand: record.brand,
      family: record.family,
      model: record.model ?? null,
      kind: record.kind,
      generation: record.generation ?? null,
      visibleFeatures: record.evidence,
      reference: record.reference,
      checkedAt: record.checkedAt,
    },
  };
}
