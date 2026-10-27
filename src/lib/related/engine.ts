import { artworkCardSummary, CARD_SUMMARY_VERSION } from './summaries';
import { normalize, safeAsset, type ArtworkInput, type Profile } from './normalize';
import { companionSubjects, REGISTERED_TOPICS, TAXONOMY_VERSION } from './taxonomy';
import { CLASSIFIER_VERSION } from './normalize';
export const ALGORITHM_VERSION = 'uc-related-5';
export const CANDIDATE_LIMIT = 240;
export const BUCKET_LIMIT = 96;
export const ALTERNATIVE_LIMIT = 56;
export const SNAPSHOT_LIMIT = ALTERNATIVE_LIMIT + 8;
export type Mode = 'best' | 'subject' | 'companions' | 'monochrome' | 'collection';
export interface RelatedCard {
  id: string;
  title: string;
  alt: string;
  thumb: string;
  thumbSrcSet?: string;
  webp: string;
  pdf?: string;
  href: string;
  reason: string;
  reasonCode: string;
  group: 'alternatives' | 'companions' | 'collection';
  monochrome: boolean;
  technique?: string;
}
export interface Ranked {
  profile: Profile;
  score: number;
  tier: number;
  reasons: string[];
}
export interface Snapshot {
  sourceId: string;
  revision: number;
  version: string;
  subject?: string;
  plural?: string;
  category: string;
  categoryLabel: string;
  alternatives: RelatedCard[];
  companions: RelatedCard[];
  collection: RelatedCard[];
  examined: number;
  algorithm: string;
}
function intersection(a: string[], b: string[]) {
  return a.filter((value) => b.includes(value));
}
function baseEligible(source: Profile, other: Profile) {
  return (
    source.eligible &&
    other.eligible &&
    source.item.id !== other.item.id &&
    source.identity !== other.identity
  );
}
export function rank(source: Profile, other: Profile, companion = false): Ranked | undefined {
  if (!baseEligible(source, other) || !source.subject || !other.subject) return;
  const sameSubject = source.subject.id === other.subject.id;
  const shared = intersection(source.composition, other.composition);
  const technique = !!source.technique && source.technique === other.technique;
  const family = !!source.styleFamily && source.styleFamily === other.styleFamily;
  const depiction = source.depiction !== 'unknown' && source.depiction === other.depiction;
  if (companion) {
    if (sameSubject || !companionSubjects(source.subject).some((s) => s.id === other.subject!.id))
      return;
    if (!depiction || source.depiction === 'scene') return;
    // "single" and "group" alone are too weak to call a different subject a companion.
    const meaningful = shared.filter((tag) => !['single', 'group', 'whole_fruit'].includes(tag));
    if (!(technique && meaningful.length >= 1) && !(family && meaningful.length >= 2)) return;
  } else {
    if (!sameSubject) return;
    if ((source.depiction === 'scene') !== (other.depiction === 'scene')) return;
    if (source.depiction === 'scene' && source.secondary.join('|') !== other.secondary.join('|'))
      return;
  }
  // Fixed denominator. Unknown attributes add zero, never renormalize to a perfect score.
  const composition =
    shared.length / Math.max(1, new Set([...source.composition, ...other.composition]).size);
  const score =
    (sameSubject ? 400 : 200) +
    (technique ? 240 : family ? 110 : 0) +
    Math.round(composition * 160) +
    (depiction ? 80 : 0) +
    (source.colorMode !== 'unknown' && source.colorMode === other.colorMode ? 60 : 0) +
    40 +
    (other.status === 'verified' ? 20 : 10);
  const reasons = [companion ? 'compatible_subject_same_style' : 'same_subject'];
  if (shared.length) reasons.push('similar_composition');
  if (technique || family) reasons.push(technique ? 'same_technique' : 'similar_style');
  return { profile: other, score, tier: depiction ? 0 : 1, reasons };
}
function keys(profile: Profile) {
  if (!profile.eligible || !profile.subject) return [];
  const base = profile.subject.id;
  return [
    ...new Set([
      base,
      `${base}:color:${profile.colorMode}`,
      ...(profile.technique ? [`${base}:tech:${profile.technique}`] : []),
      ...(profile.styleFamily ? [`${base}:family:${profile.styleFamily}`] : []),
      ...profile.composition.map((c) => `${base}:comp:${c}`),
    ]),
  ];
}
function card(result: Ranked, group: RelatedCard['group']): RelatedCard {
  const p = result.profile,
    item = p.item;
  const reason = artworkCardSummary(item);
  return {
    id: item.id,
    title: item.title,
    alt: item.alt || item.title,
    thumb: item.thumb!,
    ...(item.thumbSrcSet ? { thumbSrcSet: item.thumbSrcSet } : {}),
    webp: item.webp!,
    ...(safeAsset(item.pdf) && item.files?.pdf?.bytes && item.files.pdf.sha256
      ? { pdf: item.pdf }
      : {}),
    href: `/art/${item.id}/`,
    reason,
    reasonCode: result.reasons.join(':'),
    group,
    monochrome: p.colorMode === 'monochrome',
    technique: p.technique,
  };
}
/** Build adapter: normalize once, query bounded postings. No browser catalog, network model or N×N matrix. */
export class RelatedIndex {
  profiles = new Map<string, Profile>();
  private buckets = new Map<string, string[]>();
  private revisions = new Map<string, number>();
  private topics = new Set<string>();
  private digest = 0n;
  constructor(items: ArtworkInput[]) {
    for (const item of [...items].sort(
      (a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id),
    ))
      this.upsert(item);
  }
  get version() {
    return `${ALGORITHM_VERSION}-${CARD_SUMMARY_VERSION}-${TAXONOMY_VERSION}-${CLASSIFIER_VERSION}-${this.digest.toString(16)}`;
  }
  /** Idempotent revision gate also rejects a delayed classifier result after deletion. */
  upsert(item: ArtworkInput, expectedRevision = item.revision): boolean {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) || expectedRevision !== item.revision)
      return false;
    const known = this.revisions.get(item.id) ?? -1;
    if ((item.revision ?? 0) < known) return false;
    const current = this.profiles.get(item.id),
      profile = normalize(item);
    if (known === profile.revision) {
      // Same revision has one immutable meaning; callers must bump revisions when content changes.
      return current?.fingerprint === profile.fingerprint;
    }
    if (current) this.removeFromIndex(current);
    this.profiles.set(item.id, profile);
    this.revisions.set(item.id, profile.revision);
    if (item.published && item.topic) this.topics.add(item.topic);
    this.digest ^= BigInt(`0x${profile.fingerprint}`);
    const postingKeys = [
      ...keys(profile),
      ...(profile.publicationEligible && REGISTERED_TOPICS.has(item.topic ?? '')
        ? [`collection:${item.topic}`]
        : []),
    ];
    for (const key of postingKeys) {
      const bucket = this.buckets.get(key) ?? [];
      // Bounded postings retain newly ingested items. Narrow style/composition postings preserve diversity.
      this.buckets.set(
        key,
        [item.id, ...bucket.filter((id) => id !== item.id)].slice(0, BUCKET_LIMIT),
      );
    }
    return true;
  }
  private removeFromIndex(profile: Profile) {
    this.digest ^= BigInt(`0x${profile.fingerprint}`);
    for (const key of [...keys(profile), `collection:${profile.item.topic}`]) {
      const next = (this.buckets.get(key) ?? []).filter((id) => id !== profile.item.id);
      if (next.length) this.buckets.set(key, next);
      else this.buckets.delete(key);
    }
  }
  remove(id: string, revision: number): boolean {
    if (!Number.isSafeInteger(revision) || revision <= (this.revisions.get(id) ?? -1)) return false;
    const old = this.profiles.get(id);
    if (old) this.removeFromIndex(old);
    this.profiles.delete(id);
    this.revisions.set(id, revision);
    return true;
  }
  snapshot(sourceId: string): Snapshot {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourceId)) throw new Error('Invalid artwork identity');
    const source = this.profiles.get(sourceId);
    if (!source) throw new Error('Artwork unavailable');
    const categoryTopic =
      source.subject && this.topics.has(source.subject.topic)
        ? source.subject.topic
        : source.item.topic;
    const categoryLabel =
      source.subject && categoryTopic === source.subject.topic
        ? `View all ${source.subject.label} clipart`
        : `View the ${(source.item.topic ?? '').replace(/-/g, ' ')} collection`;
    const empty: Snapshot = {
      sourceId,
      revision: source.revision,
      version: this.version,
      subject: source.subject?.label,
      plural: source.subject?.plural,
      category: `/clipart/${categoryTopic}/`,
      categoryLabel,
      alternatives: [],
      companions: [],
      collection: [],
      examined: 0,
      algorithm: ALGORITHM_VERSION,
    };
    if (!source.publicationEligible) return empty;
    const collectionCandidates = REGISTERED_TOPICS.has(source.item.topic ?? '')
      ? (this.buckets.get(`collection:${source.item.topic}`) ?? []).slice(0, 64)
      : [];
    const candidates = new Set<string>();
    let capacity = 160;
    const collect = (key: string, maximum: number) => {
      for (const id of (this.buckets.get(key) ?? []).slice(0, maximum)) {
        if (candidates.size >= capacity) break;
        candidates.add(id);
      }
    };
    const subject = source.subject?.id;
    if (source.technique) collect(`${subject}:tech:${source.technique}`, 32);
    for (const comp of source.composition) collect(`${subject}:comp:${comp}`, 24);
    if (source.styleFamily) collect(`${subject}:family:${source.styleFamily}`, 32);
    collect(`${subject}:color:monochrome`, 20);
    if (subject) collect(subject, 64);
    // Reserve the remaining bounded capacity for explicit companions.
    capacity = CANDIDATE_LIMIT - collectionCandidates.length;
    for (const partner of source.subject ? companionSubjects(source.subject) : []) {
      if (source.technique) collect(`${partner.id}:tech:${source.technique}`, 12);
      if (source.styleFamily) collect(`${partner.id}:family:${source.styleFamily}`, 8);
    }
    const alternatives: Ranked[] = [],
      companions: Ranked[] = [];
    const seen = new Set([source.identity]);
    const compared = [...candidates]
      .map((id) => this.profiles.get(id))
      .filter((p): p is Profile => !!p);
    for (const profile of compared) {
      const alternative = rank(source, profile);
      const companion = alternative ? undefined : rank(source, profile, true);
      if (alternative) alternatives.push(alternative);
      else if (companion) companions.push(companion);
    }
    const sort = (a: Ranked, b: Ranked) =>
      a.tier - b.tier ||
      b.score - a.score ||
      (b.profile.item.createdAt ?? '').localeCompare(a.profile.item.createdAt ?? '') ||
      a.profile.item.id.localeCompare(b.profile.item.id);
    const unique = (list: Ranked[], cap: number) => {
      const selected: Ranked[] = [],
        techniqueCounts = new Map<string, number>();
      const sorted = list.sort(sort);
      // A soft technique cap first; fill remaining slots from the same eligible list only.
      for (const pass of [true, false])
        for (const result of sorted) {
          if (selected.length >= cap) break;
          const key = result.profile.technique ?? 'unknown';
          if (seen.has(result.profile.identity) || (pass && (techniqueCounts.get(key) ?? 0) >= 6))
            continue;
          selected.push(result);
          seen.add(result.profile.identity);
          techniqueCounts.set(key, (techniqueCounts.get(key) ?? 0) + 1);
        }
      return selected.sort(sort);
    };
    const selected = unique(alternatives, ALTERNATIVE_LIMIT);
    // Keep true monochrome choices available without claiming they are the default best matches.
    if (!selected.some((r) => r.profile.colorMode === 'monochrome')) {
      const mono = alternatives.find(
        (r) => r.profile.colorMode === 'monochrome' && !seen.has(r.profile.identity),
      );
      if (mono) {
        if (selected.length >= ALTERNATIVE_LIMIT) selected.pop();
        selected.push(mono);
        seen.add(mono.profile.identity);
      }
    }
    const chosenCompanions = unique(companions, 8);
    // A reviewed collection is a separate discovery lane, not a claim that its
    // scenes share an exact subject. This also covers newly registered topics
    // and sparse seasonal subjects without assigning decorative words as primary.
    const collectionRanked: Ranked[] = [];
    for (const id of collectionCandidates) {
      const p = this.profiles.get(id)!;
      if (
        !p.publicationEligible ||
        p.item.topic !== source.item.topic ||
        p.item.id === sourceId ||
        seen.has(p.identity)
      )
        continue;
      const shared = intersection(source.composition, p.composition);
      collectionRanked.push({
        profile: p,
        tier: source.depiction === p.depiction ? 0 : 1,
        score:
          (source.technique && source.technique === p.technique
            ? 240
            : source.styleFamily && source.styleFamily === p.styleFamily
              ? 110
              : 0) +
          shared.length * 40 +
          (source.colorMode !== 'unknown' && source.colorMode === p.colorMode ? 60 : 0),
        reasons: ['same_reviewed_collection'],
      });
    }
    const collection = unique(
      collectionRanked,
      SNAPSHOT_LIMIT - selected.length - chosenCompanions.length,
    );
    const alternativesCards = selected.map((r) => card(r, 'alternatives'));
    const companionCards = chosenCompanions.map((r) => card(r, 'companions'));
    const collectionCards = collection.map((r) => card(r, 'collection'));
    return {
      ...empty,
      alternatives: alternativesCards,
      companions: companionCards,
      collection: collectionCards,
      examined: new Set([...candidates, ...collectionCandidates]).size,
    };
  }
  getRelatedArtwork(
    sourceId: string,
    options: { mode?: Mode; cursor?: string; limit?: number } = {},
  ) {
    const mode = options.mode ?? 'best',
      limit = options.limit ?? 12;
    if (
      !['best', 'subject', 'companions', 'monochrome', 'collection'].includes(mode) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > SNAPSHOT_LIMIT
    )
      throw new Error('Invalid related options');
    const snapshot = this.snapshot(sourceId);
    let offset = 0;
    if (options.cursor) {
      if (options.cursor.length > 1000) throw new Error('Invalid cursor');
      let cursor;
      try {
        cursor = JSON.parse(decodeURIComponent(options.cursor));
      } catch {
        throw new Error('Invalid cursor');
      }
      if (
        cursor.source !== sourceId ||
        cursor.version !== snapshot.version ||
        cursor.mode !== mode ||
        !Number.isSafeInteger(cursor.offset) ||
        cursor.offset < 0 ||
        cursor.offset > SNAPSHOT_LIMIT
      )
        throw new Error('Stale or mismatched cursor');
      offset = cursor.offset;
    }
    const list =
      mode === 'collection'
        ? snapshot.collection
        : mode === 'companions'
          ? snapshot.companions
          : mode === 'monochrome'
            ? snapshot.alternatives.filter((c) => c.monochrome)
            : mode === 'subject'
              ? snapshot.alternatives
              : [
                  ...snapshot.alternatives.slice(0, 8),
                  ...snapshot.companions.slice(0, 4),
                  ...snapshot.alternatives.slice(8),
                  ...snapshot.companions.slice(4),
                  ...snapshot.collection,
                ];
    const firstLimit =
      mode === 'best' &&
      offset === 0 &&
      snapshot.alternatives.length + snapshot.companions.length > 0
        ? snapshot.alternatives.length
          ? Math.min(snapshot.alternatives.length, Math.ceil((limit * 2) / 3)) +
            Math.min(snapshot.companions.length, Math.floor(limit / 3))
          : Math.min(limit, snapshot.companions.length)
        : limit;
    const cards = list.slice(offset, offset + firstLimit),
      next = offset + cards.length;
    return {
      sourceId,
      version: snapshot.version,
      alternatives: cards.filter((c) => c.group === 'alternatives'),
      companions: cards.filter((c) => c.group === 'companions'),
      collection: cards.filter((c) => c.group === 'collection'),
      hasMore: next < list.length,
      cursor:
        next < list.length
          ? encodeURIComponent(
              JSON.stringify({ source: sourceId, version: snapshot.version, mode, offset: next }),
            )
          : undefined,
    };
  }
}
