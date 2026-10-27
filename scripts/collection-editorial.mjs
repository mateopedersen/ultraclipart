import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import legacyBaseline from '../data/editorial/legacy-baseline.json' with { type: 'json' };

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
  return verifyCollectionEditorial(read('data/art.json'), readCollectionRegistries(root));
}

/** Protect every new topic without rewriting unfinished legacy topic prose. */
export function requiredCollectionIntroductions(catalog, registry) {
  if (registry?.schema !== 1 || !registry.topics) throw Error('Invalid collection registry');
  const legacyTopics = new Set(
    catalog.filter((item) => legacyBaseline.records[item.id]).map((item) => item.topic),
  );
  const groups = new Map();
  for (const item of catalog.filter((item) => item.published && item.indexable)) {
    const group = groups.get(item.topic) ?? [];
    group.push(item);
    groups.set(item.topic, group);
  }
  const result = new Map(),
    texts = new Set();
  for (const [topic, items] of groups) {
    const record = registry.topics[topic];
    if (!record && legacyTopics.has(topic)) continue;
    const text = validateCollectionCopy(topic, items, record);
    if (texts.has(text.toLowerCase())) throw Error('Repeated collection introduction: ' + topic);
    texts.add(text.toLowerCase());
    result.set(topic, text);
  }
  for (const topic of Object.keys(registry.topics))
    if (!groups.has(topic)) throw Error('Orphan collection review: ' + topic);
  return result;
}

/** Read the committed per-collection records produced by concurrent importers. */
export function readCollectionRegistries(root = process.cwd()) {
  const directory = resolve(root, 'data/editorial'),
    topics = {};
  for (const name of readdirSync(directory)
    .filter((name) => name === 'collections.json' || /-collections?\.json$/.test(name))
    .sort()) {
    const registry = JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
    if (registry.schema !== 1 || !registry.topics)
      throw Error('Invalid collection review file: ' + name);
    for (const [topic, record] of Object.entries(registry.topics)) {
      if (topics[topic] && JSON.stringify(topics[topic]) !== JSON.stringify(record))
        throw Error('Conflicting collection reviews: ' + topic);
      topics[topic] = record;
    }
  }
  return { schema: 1, topics };
}

export function readRequiredCollectionIntroductions(catalog, root = process.cwd()) {
  return requiredCollectionIntroductions(catalog, readCollectionRegistries(root));
}
