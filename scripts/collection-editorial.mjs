import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function collectionSourceSignature(items) {
  return createHash('sha256')
    .update(
      JSON.stringify(
        items
          .map((item) => [item.id, item.title, item.alt, item.files.webp.sha256])
          .sort((a, b) => a[0].localeCompare(b[0], 'en')),
      ),
    )
    .digest('hex');
}

export function validateCollectionCopy(topic, items, record) {
  const fail = (reason) => {
    throw new Error(`Collection ${topic}: ${reason}`);
  };
  if (
    !record ||
    record.status !== 'checked-against-catalog' ||
    record.sourceSha256 !== collectionSourceSignature(items)
  )
    fail('missing or stale topic-specific editorial summary');
  if (
    typeof record.intro !== 'string' ||
    !record.intro.trim() ||
    record.intro.split(/\s+/).length > 80
  )
    fail('provide one concise, useful paragraph');
  if (/\b(?:webp|cmyk|icc|gracol|dpi|ppi|E-E-A-T)\b|https?:|\n|<[^>]+>/i.test(record.intro))
    fail('remove technical filler, links or markup from the introduction');
  if (/\b(?:handmade|expert-approved|human-created|guaranteed ranking)\b/i.test(record.intro))
    fail('unsupported authority or authorship claim');
  if (!Number.isFinite(Date.parse(record.checkedAt))) fail('missing editorial date');
  if (!Array.isArray(record.evidence) || record.evidence.length < Math.min(2, items.length))
    fail('identify the actual catalog examples');
  const ids = new Set();
  for (const proof of record.evidence) {
    const item = items.find((item) => item.id === proof.id);
    if (!item || ids.has(proof.id) || proof.imageSha256 !== item.files.webp.sha256)
      fail('invalid or replaced example');
    ids.add(proof.id);
  }
  return record.intro;
}

export function verifyCollectionEditorial(catalog, registry) {
  if (registry?.schema !== 1) throw new Error('Unsupported collection editorial registry');
  const groups = new Map();
  for (const item of catalog.filter((item) => item.published && item.indexable)) {
    const group = groups.get(item.topic) ?? [];
    group.push(item);
    groups.set(item.topic, group);
  }
  const texts = new Set();
  for (const [topic, items] of groups) {
    const text = validateCollectionCopy(topic, items, registry.topics[topic]);
    if (texts.has(text.toLowerCase()))
      throw new Error(`Repeated collection introduction: ${topic}`);
    texts.add(text.toLowerCase());
  }
  for (const topic of Object.keys(registry.topics))
    if (!groups.has(topic))
      throw new Error(`No published artwork for collection summary: ${topic}`);
  return { topics: groups.size, uniqueIntroductions: texts.size };
}

export function readCollectionAudit(root) {
  const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  return verifyCollectionEditorial(read('data/art.json'), read('data/editorial/collections.json'));
}
