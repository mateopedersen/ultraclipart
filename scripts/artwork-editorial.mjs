import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import boilerplate from '../data/editorial/boilerplate.json' with { type: 'json' };
import sentenceReplacements from '../data/editorial/sentence-replacements.json' with { type: 'json' };
import subjectContexts from '../data/editorial/subject-contexts.json' with { type: 'json' };

const removedSentences = new Set(boilerplate);
const fields = ['title', 'alt', 'description'];
const sha = (text) => createHash('sha256').update(text).digest('hex');
export const metadataSignature = (item) => sha(JSON.stringify(fields.map((key) => item[key])));
export const sourceSignature = (item) => item.files?.svg?.sha256 ?? item.files?.webp?.sha256;
const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
const split = (text) => [...segmenter.segment(text)].map((s) => s.segment.trim());

/** Only delete explicitly reviewed boilerplate. Never derive facts from a filename. */
export function cleanLegacyCopy(item) {
  const parts = split(item.description);
  const description = parts
    .filter((part) => !removedSentences.has(part))
    .map((part) => sentenceReplacements[part] ?? part)
    .join(' ');
  if (!description) throw new Error(`No visual description remains: ${item.id}`);
  const titlePrefix = item.title.replace(/[.!?]+$/, '') + '. ';
  const alt =
    item.alt.startsWith(titlePrefix) && item.alt.length > titlePrefix.length + 20
      ? item.alt.slice(titlePrefix.length)
      : item.alt;
  return { title: item.title, alt, description };
}

export function copyIssues(copy, { reviewed = false } = {}) {
  const issues = [];
  for (const key of fields) {
    if (typeof copy[key] !== 'string' || !copy[key].trim()) {
      issues.push(`${key}:missing`);
      continue;
    }
    if (/&#(?:x[\da-f]+|\d+);|&nbsp;|\s{2,}|\u00a0/i.test(copy[key]))
      issues.push(`${key}:encoding-or-spacing`);
    if (/\b(?:handmade|hand-painted by|human-created|expert-approved)\b/i.test(copy[key]))
      issues.push(`${key}:unsupported-authorship`);
    if (/\b(?:webp|cmyk|dpi|ppi)\b/i.test(copy[key])) issues.push(`${key}:file-jargon`);
  }
  if (/^(?:Illustration showing|Outline drawing showing)\b/i.test(copy.description))
    issues.push('description:filename-template');
  if (/\b(?:is|with|and|of|in|on|a|an|the)\.$/i.test(copy.description))
    issues.push('description:unfinished');
  if (split(copy.description).some((s) => removedSentences.has(s)))
    issues.push('description:boilerplate');
  if (
    split(copy.description).some((s) =>
      /^(?:use (?:it|this)|arrange it|add it to|perfect for|ideal for|great for|download (?:the|a)|choose (?:the|a) (?:image|transparent))\b/i.test(
        s,
      ),
    )
  )
    issues.push('description:generic-instruction');
  if (/\b(?:download|choose)\b[^.!?]*\b(?:image|pdf|transparent)\b/i.test(copy.description))
    issues.push('description:download-instruction');
  // Short legacy captions need a human look, not padding to an arbitrary word count.
  // An image-reviewed, specific sentence may legitimately be shorter than this.
  if (!reviewed && (copy.description?.length ?? 0) < 55)
    issues.push('description:needs-detail-review');
  if ((copy.alt?.length ?? 0) > 300) issues.push('alt:too-long');
  if ((copy.title?.length ?? 0) > 140) issues.push('title:too-long');
  return issues;
}

/** Check claims in public-figure drawings without treating them as event evidence. */
export function publicFigureCopyIssues(copy, depiction) {
  if (!depiction) return [];
  if (
    depiction.kind !== 'public-figure-illustration' ||
    depiction.sceneNature !== 'imagined-illustration' ||
    typeof depiction.fictionalRole !== 'boolean' ||
    !Array.isArray(depiction.people) ||
    !depiction.people.length ||
    depiction.people.some((name) => typeof name !== 'string' || !name.trim())
  )
    return ['depiction:invalid-context'];
  const issues = [];
  for (const name of depiction.people) {
    const parts = name.toLowerCase().split(/\s+/);
    if (fields.some((field) => parts.some((part) => !copy[field]?.toLowerCase().includes(part))))
      issues.push('depiction:inconsistent-person');
  }
  if (
    /\b(?:won|wins|election results?|official(?:ly)? endors(?:ed|ement)|signed into law|enacted|record-breaking|documentary photograph|actual photograph|historic photograph)\b/i.test(
      fields.map((key) => copy[key]).join(' '),
    )
  )
    issues.push('depiction:unsupported-event-claim');
  if (
    depiction.fictionalRole &&
    !/\b(?:imagined|fictional|fantasy|cartoon|costume)\b/i.test(copy.description)
  )
    issues.push('depiction:unqualified-fictional-role');
  return issues;
}

export function validateEditorialReview(item, record) {
  const fail = (message) => {
    throw new Error(`Editorial review ${item.id}: ${message}`);
  };
  if (record?.id !== item.id || record.status !== 'reviewed-from-image')
    fail('actual image review required');
  if (
    record.sourceSha256 !== sourceSignature(item) ||
    record.imageSha256 !== item.files?.webp?.sha256
  )
    fail('image changed; inspect the replacement');
  if (record.inputMetadataSha256 !== metadataSignature(item))
    fail('source metadata changed; reconcile review');
  if (!Number.isFinite(Date.parse(record.reviewedAt))) fail('review date required');
  if (
    !Array.isArray(record.observations) ||
    record.observations.length < 2 ||
    record.observations.some((x) => typeof x !== 'string' || x.trim().length < 8)
  )
    fail('visible evidence required');
  if (!record.inspectedImage || record.inspectedImage !== item.webp) fail('wrong inspected image');
  if (!Array.isArray(record.references))
    fail('references must be recorded (empty for ordinary subjects)');
  const context = subjectContexts[item.topic];
  if (
    context &&
    (record.depiction?.kind !== context.kind ||
      record.depiction?.sceneNature !== context.sceneNature ||
      !record.depiction?.people?.includes(context.requiredPerson) ||
      record.depiction.people.some((person) => !context.allowedPeople.includes(person)))
  )
    fail('the registered subject context must be preserved');
  if (record.depiction && !record.references.length)
    fail('public-figure identity requires a primary reference');
  for (const ref of record.references) {
    if (!ref.publisher || !ref.reason || !/^https:\/\//.test(ref.url))
      fail('invalid factual reference');
  }
  const issues = [
    ...copyIssues(record.copy, { reviewed: true }),
    ...publicFigureCopyIssues(record.copy, record.depiction),
  ];
  if (issues.length) fail(issues.join(', '));
  if (!record.copy.alt || record.copy.alt === record.copy.title)
    fail('alt must describe the image');
  // Protect established identity constraints; editorial prose must not erase them.
  if (/\bconcept\b/i.test(item.title) && !/\bconcept\b/i.test(record.copy.title))
    fail('keep concept qualification');
  const identity = item.productIdentity;
  if (identity) {
    if (
      !record.references.some(
        (ref) => new URL(ref.url).hostname === new URL(identity.reference).hostname,
      )
    )
      fail('compare the approved manufacturer source');
    const name = identity.model || identity.family;
    if (name && fields.some((key) => !record.copy[key].toLowerCase().includes(name.toLowerCase())))
      fail('keep the reviewed product identity consistent');
  }
  // A copy record cannot replace an ID, source, license, or publication property.
  if (Object.keys(record.copy).some((key) => !fields.includes(key))) fail('unexpected copy field');
  return Object.fromEntries(fields.map((key) => [key, record.copy[key]]));
}

/** One result feeds visible headings, metadata, image schema, search and Studio. */
export function resolveArtworkCopy(item, review) {
  return review ? validateEditorialReview(item, review) : cleanLegacyCopy(item);
}

export function verifyEditorialCatalog(catalog, baseline, registry) {
  if (
    baseline?.schema !== 1 ||
    baseline.status !== 'legacy-text-not-a-new-visual-review' ||
    registry?.schema !== 1
  )
    throw new Error('Unsupported editorial registry');
  const reviews = new Map();
  for (const record of registry.artworks) {
    if (reviews.has(record.id)) throw new Error(`Duplicate editorial review: ${record.id}`);
    reviews.set(record.id, record);
  }
  const ids = new Set();
  const rows = catalog.map((item) => {
    if (ids.has(item.id)) throw new Error(`Duplicate artwork: ${item.id}`);
    ids.add(item.id);
    const review = reviews.get(item.id);
    if (!review) {
      const old = baseline.records[item.id];
      if (
        !old ||
        old.sourceSha256 !== sourceSignature(item) ||
        old.imageSha256 !== item.files?.webp?.sha256 ||
        old.metadataSha256 !== metadataSignature(item)
      ) {
        throw new Error(
          `Artwork ${item.id} is new or changed. Image-specific editorial review required before publication.`,
        );
      }
    }
    const copy = resolveArtworkCopy(item, review);
    return {
      id: item.id,
      topic: item.topic,
      status: review ? 'reviewed-from-image' : 'legacy-awaiting-image-review',
      issues: copyIssues(copy, { reviewed: Boolean(review) }),
      changed: fields.some((key) => copy[key] !== item[key]),
    };
  });
  for (const id of reviews.keys())
    if (!ids.has(id)) throw new Error(`Orphan editorial review: ${id}`);
  return {
    total: rows.length,
    reviewed: reviews.size,
    awaitingImageReview: rows.length - reviews.size,
    changed: rows.filter((row) => row.changed).length,
    flagged: rows.filter((row) => row.issues.length).length,
    rows,
  };
}

export function readEditorialAudit(root) {
  const read = (file) => JSON.parse(readFileSync(resolve(root, file), 'utf8'));
  return verifyEditorialCatalog(
    read('data/art.json'),
    read('data/editorial/legacy-baseline.json'),
    read('data/editorial/reviews.json'),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { rows, ...summary } = readEditorialAudit(resolve(import.meta.dirname, '..'));
  const { readCollectionAudit } = await import('./collection-editorial.mjs');
  console.log(
    JSON.stringify(
      {
        ...summary,
        collections: readCollectionAudit(resolve(import.meta.dirname, '..')),
        ...(process.argv.includes('--details') ? { rows } : {}),
      },
      null,
      2,
    ),
  );
}
