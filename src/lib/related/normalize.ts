import {
  BY_ID,
  BY_TOPIC,
  CATALOG_SUBJECTS,
  THEME_COLLECTIONS,
  mentions,
  words,
  TAXONOMY_VERSION,
  type Subject,
} from './taxonomy';
import { fingerprint } from '../cache-fingerprint';
export { fingerprint } from '../cache-fingerprint';

export const CLASSIFIER_VERSION = 'uc-metadata-4';
export type ColorMode = 'color' | 'monochrome' | 'unknown';
export type Depiction = 'natural_object' | 'character' | 'scene' | 'unknown';
export interface ArtworkInput {
  id: string;
  title: string;
  alt?: string;
  description?: string;
  topic?: string;
  style?: string;
  color?: string;
  revision?: number;
  createdAt?: string;
  published?: boolean;
  indexable?: boolean;
  recommendationEligible?: boolean;
  licenseStatus?: string;
  reviewStatus?: string;
  thumb?: string;
  thumbSrcSet?: string;
  webp?: string;
  pdf?: string | null;
  canonicalArtworkId?: string;
  files?: Record<string, { bytes: number; sha256: string }>;
  semanticReview?: {
    revision: number;
    subjectId: string;
    reviewer: string;
    evidence: string;
    depiction?: Depiction;
  };
}
export interface Profile {
  item: ArtworkInput;
  identity: string;
  subject?: Subject;
  secondary: string[];
  roles: { subject: string; role: 'primary' | 'secondary' }[];
  technique?: string;
  styleFamily?: string;
  composition: string[];
  depiction: Depiction;
  colorMode: ColorMode;
  status: 'verified' | 'auto_classified' | 'unclassified' | 'needs_review';
  eligible: boolean;
  publicationEligible: boolean;
  revision: number;
  fingerprint: string;
  evidence: {
    subject: string;
    technique: string;
    composition: string;
    depiction: string;
    colorMode: string;
  };
  provenance: string;
  versions: string;
  issues: string[];
}
const techniques: [string, string, RegExp][] = [
  ['crayon', 'textured_drawing', /\b(?:wax )?crayon\b/],
  ['pastel', 'textured_drawing', /\bpastel\b/],
  ['chalk', 'textured_drawing', /\bchalk\b/],
  ['colored_pencil', 'textured_drawing', /\bcolou?red pencil\b/],
  ['pencil', 'textured_drawing', /\bpencil\b/],
  ['watercolor', 'watermedia', /\bwatercolou?r\b/],
  ['gouache', 'watermedia', /\bgouache\b/],
  ['ink_wash', 'watermedia', /\bink wash\b/],
  ['oil_painting', 'painting', /\boil painting\b/],
  ['airbrush', 'painting', /\bairbrush\b/],
  ['marker', 'drawing', /\bmarker\b/],
  ['screenprint', 'printmaking', /\bscreen ?print(?:ing)?\b/],
  ['engraving', 'printmaking', /\bengraving\b/],
  ['woodcut', 'printmaking', /\bwoodcut\b/],
  ['linocut', 'printmaking', /\blinocut\b/],
  ['stipple', 'drawing', /\bstippl(?:e|ing)\b/],
  ['line_art', 'linework', /\b(?:line art|outline|coloring|colouring|line drawing)\b/],
  ['silhouette', 'silhouette', /\bsilhouette\b/],
  ['low_poly', 'geometric', /\blow poly\b/],
  ['flat', 'graphic', /\bflat\b/],
  ['papercut', 'paper', /\bpaper ?cut\b/],
  ['origami', 'paper', /\borigami\b/],
  ['quilling', 'paper', /\bquill(?:ed|ing)\b/],
  ['embroidery', 'textile', /\bembroider(?:ed|y)\b/],
  ['mosaic', 'decorative', /\bmosaic\b/],
  ['stained_glass', 'decorative', /\bstained glass\b/],
  ['folk_art', 'decorative', /\bfolk art\b/],
  ['pixel_art', 'graphic', /\bpixel art\b/],
  ['digital_painting', 'painting', /\bdigital paint(?:ing)?\b/],
  ['clay', 'sculpture', /\b(?:clay|plasticine)\b/],
  ['crochet', 'textile', /\bcrochet(?:ed)?\b/],
  ['cartoon', 'cartoon', /\b(?:cartoon|kawaii)\b/],
  ['realistic', 'realistic', /\b(?:realistic|photorealistic)\b/],
];
const compositionRules: [string, RegExp][] = [
  ['autumn_leaves', /\b(?:autumn|fall) leaves\b/],
  ['floral', /\b(?:flowers?|floral|blossoms?)\b/],
  ['wreath', /\bwreath\b/],
  ['open_wings', /\b(?:open|spread|outstretched) wings\b|\bwings (?:open|spread|outstretched)\b/],
  ['side_view', /\b(?:side view|profile view)\b/],
  ['flying', /\b(?:flying|in flight)\b/],
  ['perched', /\b(?:perched|perching)\b/],
  ['border', /\b(?:border|frame layout)\b/],
  ['geometric', /\b(?:geometric|low poly)\b/],
  ['whole_fruit', /\b(?:whole|uncut|intact|apples stand)\b/],
  ['dried_fruit', /\b(?:dried|dehydrated)\b/],
  ['fruit_rings', /\b(?:rings|wheels|rounds)\b/],
  ['sliced', /\b(?:slices?|sliced|wedges?|rings|wheels|cut fruit)\b/],
  ['half', /\b(?:half|halves|halved)\b/],
  ['basket', /\b(?:basket|crate)\b/],
  ['branch', /\bbranch\b/],
  ['bowl', /\bbowl\b/],
  ['single', /\b(?:single|one |solitary|alone)\b/],
  ['group', /\b(?:pair|trio|group|three|two|cluster)\b/],
];
export function safeAsset(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return (
    /^\/catalog\/[a-z0-9/_-]+\.(?:webp|pdf)$/.test(value) ||
    /^\/previews\/p\d+\/[a-f0-9]{24}-(?:96|220|440|960)\.webp$/.test(value) ||
    /^https:\/\/assets\.ultraclipart\.com\/[a-zA-Z0-9/_.%-]+\.(?:webp|pdf)$/.test(value)
  );
}
export function normalize(item: ArtworkInput): Profile {
  const revision = Number.isSafeInteger(item.revision) && item.revision! > 0 ? item.revision! : 0;
  const title = words(item.title),
    text = words(`${item.title} ${item.alt ?? ''}`);
  const titled = mentions(item.title),
    named = mentions(`${item.title} ${item.alt ?? ''}`);
  const topic = BY_TOPIC.get(item.topic ?? '') ?? CATALOG_SUBJECTS.get(item.topic ?? '');
  const catalogContext =
    topic?.domain === 'catalog' && topic.terms.some((term) => ` ${text} `.includes(` ${term} `));
  const issues: string[] = [];
  let subject = topic,
    status: Profile['status'] = 'auto_classified';
  let subjectEvidence = 'catalog topic + contextual title/alt (one metadata source)';
  if (!topic || THEME_COLLECTIONS.has(item.topic ?? '')) {
    const inferFromTitle = !item.topic || THEME_COLLECTIONS.has(item.topic);
    // An unmapped primary category may describe a new kind of object. Its title
    // can mention a color or decoration (e.g. a lime watch or cat-face watch).
    // Preserve that uncertainty instead of promoting a secondary word to subject.
    subject = inferFromTitle ? titled[0]?.subject : undefined;
    subjectEvidence = inferFromTitle
      ? 'contextual title; collection is not a subject'
      : 'unmapped catalog subject; title mentions are not primary-subject evidence';
    if (!inferFromTitle) issues.push('unknown_catalog_topic');
  }
  if (!subject) {
    status = 'unclassified';
    issues.push('unknown_subject');
  } else {
    const firstPrimaryCandidate =
      titled.find((m) => !['seasonal', 'object'].includes(m.subject.domain)) ?? titled[0];
    const topicMention = titled.find((m) => m.subject.id === topic?.id);
    const titlePrimary =
      topicMention &&
      (!firstPrimaryCandidate || topicMention.position < firstPrimaryCandidate.position)
        ? topicMention.subject
        : firstPrimaryCandidate?.subject;
    const topicEvidence = catalogContext || named.some((m) => m.subject.id === topic?.id);
    const speciesEquivalent = (a: string, b: string) =>
      a === b || (a === 'animal.mammal.elephant.young' && b === 'animal.mammal.elephant');
    if (topic && titlePrimary && !speciesEquivalent(topic.id, titlePrimary.id) && !topicEvidence) {
      status = 'needs_review';
      issues.push('topic_title_conflict');
    }
    const explicit =
      catalogContext || named.some((m) => speciesEquivalent(subject!.id, m.subject.id));
    // Category is useful evidence, not proof. Ambiguous bare words need a subject-specific context.
    const supportedTurkey =
      subject.topic === 'turkey' &&
      /\b(?:tom|poult|snood|wattle|gobbler|feathers?)\b/.test(text) &&
      !/\b(?:country|flag|map)\b/.test(text);
    if (!explicit && !supportedTurkey) {
      status = 'needs_review';
      issues.push('subject_without_context');
    }
  }
  if (catalogContext)
    subjectEvidence =
      'registered catalog collection + exact title/alt context; isolated collection identity';
  let depiction: Depiction = subject ? 'natural_object' : 'unknown';
  const otherDomains = named.filter(
    (m) => m.subject.id !== subject?.id && m.subject.domain !== subject?.domain,
  );
  if (
    subject?.domain === 'food' &&
    otherDomains.some(
      (m) =>
        ['animal', 'people', 'sport', 'object'].includes(m.subject.domain) &&
        !['leaves', 'gift'].includes(m.subject.topic),
    )
  )
    depiction = 'scene';
  else if (
    /\b(?:character|kawaii|smiling|waving|superhero|chef|reading|sunglasses|cartoon|anthropomorphic)\b/.test(
      title,
    )
  )
    depiction = 'character';
  else if (/\b(?:scene|with children|holding an? (?:apple|fruit)|human|player)\b/.test(text))
    depiction = 'scene';
  if (
    subject?.domain === 'food' &&
    named.some(
      (m) =>
        m.subject.domain === 'food' && m.subject.id !== subject?.id && m.subject.family === 'fruit',
    )
  )
    depiction = 'scene';
  const review = item.semanticReview;
  if (
    review &&
    review.revision === revision &&
    review.reviewer &&
    review.evidence &&
    BY_ID.has(review.subjectId)
  ) {
    subject = BY_ID.get(review.subjectId);
    status = 'verified';
    subjectEvidence = `review: ${review.evidence}`;
    if (review.depiction) depiction = review.depiction;
  } else if (review) {
    issues.push('stale_or_invalid_review');
  }
  // Prefer the technique named in the title. Color is not a drawing technique.
  const style =
    techniques.find(([, , regex]) => regex.test(title)) ??
    techniques.find(([, , regex]) => regex.test(text));
  const mono =
    /\b(?:black and white|black white|monochrome|grayscale|greyscale|outline|coloring|colouring|silhouette)\b/.test(
      words(`${item.style ?? ''} ${item.title}`),
    );
  const colorMode: ColorMode = mono
    ? 'monochrome'
    : /\bcolor\b/.test(words(item.style ?? '')) ||
        Boolean(item.color && item.color !== 'Black' && item.color !== 'White')
      ? 'color'
      : 'unknown';
  const composition = compositionRules
    .filter(
      ([tag, regex]) =>
        (!['whole_fruit', 'dried_fruit', 'fruit_rings', 'sliced', 'half'].includes(tag) ||
          subject?.domain === 'food') &&
        regex.test(text),
    )
    .map(([tag]) => tag);
  const asset = (kind: 'thumb' | 'webp' | 'pdf') =>
    safeAsset(item[kind]) && !!item.files?.[kind]?.sha256 && item.files[kind].bytes > 0;
  const publicationEligible =
    item.published === true &&
    item.indexable === true &&
    item.recommendationEligible !== false &&
    revision > 0 &&
    asset('thumb') &&
    asset('webp') &&
    item.licenseStatus === 'OWNER_APPROVED_PERSONAL_EDUCATIONAL_ONLY' &&
    item.reviewStatus === 'FORMAT_AND_PAIR_REVIEW_PASSED';
  const eligible =
    publicationEligible && !!subject && ['auto_classified', 'verified'].includes(status);
  const secondary = named.filter((m) => m.subject.id !== subject?.id).map((m) => m.subject.id);
  const profile = {
    item,
    identity: item.canonicalArtworkId ?? item.files?.webp?.sha256 ?? item.id,
    subject,
    secondary,
    roles: [
      ...(subject ? [{ subject: subject.id, role: 'primary' as const }] : []),
      ...secondary.map((id) => ({ subject: id, role: 'secondary' as const })),
    ],
    technique: style?.[0],
    styleFamily: style?.[1],
    composition,
    depiction,
    colorMode,
    status,
    eligible,
    publicationEligible,
    revision,
    evidence: {
      subject: subjectEvidence,
      technique: style ? 'title/alt rule' : 'unknown',
      composition: composition.length ? 'title/alt rule' : 'unknown',
      depiction: subject ? 'contextual metadata rule' : 'unknown',
      colorMode: colorMode === 'unknown' ? 'unknown' : 'catalog style/title',
    },
    provenance: 'owner catalog metadata; title and alt are not independent visual verification',
    versions: `${TAXONOMY_VERSION}/${CLASSIFIER_VERSION}`,
    issues,
  };
  return { ...profile, fingerprint: fingerprint(profile) };
}
