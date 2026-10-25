import { createHash } from 'node:crypto';

/** Bind editorial identity and visible-subject metadata to the bytes actually inspected. */
export function validateIdentification({ artwork, sourceBytes, record }) {
  const fail = (reason) => {
    throw new Error(`Identification review rejected for ${artwork.id}: ${reason}`);
  };
  if (!record || record.id !== artwork.id || record.status !== 'PASS') fail('missing approval');
  const digest = createHash('sha256').update(sourceBytes).digest('hex');
  if (record.sourceSha256 !== digest) fail('source changed after inspection');
  if (
    ![
      'character-family',
      'product-family',
      'recognized-product',
      'branded-scene',
      'imagined-concept',
    ].includes(record.level)
  )
    fail('unsupported identity level');
  if (!record.identity?.trim() || !Number.isFinite(Date.parse(record.reviewedAt)))
    fail('incomplete identity');
  if (
    !Array.isArray(record.observedFeatures) ||
    record.observedFeatures.length < 2 ||
    record.observedFeatures.some((feature) => typeof feature !== 'string' || !feature.trim())
  )
    fail('missing observed features');
  if (!Array.isArray(record.officialSources) || !record.officialSources.length)
    fail('missing primary sources');
  for (const source of record.officialSources) {
    let url;
    try {
      url = new URL(source.url);
    } catch {
      fail('invalid primary source');
    }
    if (url.protocol !== 'https:' || !source.publisher?.trim() || source.kind !== 'official')
      fail('invalid primary source');
  }
  for (const key of ['title', 'alt', 'description']) {
    if (record.metadata?.[key] !== artwork[key] || !artwork[key]?.includes(record.identity))
      fail(`unreviewed ${key}`);
  }
  if (record.level === 'imagined-concept' && !/concept/i.test(artwork.title))
    fail('concept not identified in title');
  return { identity: record.identity, sourceSha256: digest, level: record.level };
}
