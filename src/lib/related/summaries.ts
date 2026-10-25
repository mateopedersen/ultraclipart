import captionData from '../../../data/artwork-card-summaries.json';
import {
  automaticArtworkSummary,
  AUTO_SUMMARY_VERSION,
  CARD_SUMMARY_MAX_LENGTH,
} from '../artwork-summary';
import { fingerprint, type ArtworkInput } from './normalize';

const captions: Readonly<Record<string, { source: string; text: string }>> = captionData;
const resolved = new WeakMap<ArtworkInput, string>();
export { CARD_SUMMARY_MAX_LENGTH } from '../artwork-summary';
// Text edits invalidate snapshots just like catalog edits, without changing ranking.
export const CARD_SUMMARY_VERSION = fingerprint([AUTO_SUMMARY_VERSION, captionData]);

export function artworkSummarySource(item: ArtworkInput): string {
  return fingerprint([item.revision, item.title, item.description || '', item.alt || '']);
}

/** Captions describe the candidate itself; group labels explain its relationship. */
export function artworkCardSummary(item: ArtworkInput): string {
  const cached = resolved.get(item);
  if (cached) return cached;
  const entry = captions[item.id];
  const reviewed =
    entry?.source === artworkSummarySource(item) &&
    entry.text.trim().length > 0 &&
    entry.text.length <= CARD_SUMMARY_MAX_LENGTH &&
    !/(?:…|\.{2,})/.test(entry.text);
  const text = reviewed ? entry.text : automaticArtworkSummary(item);
  // Profiles hold immutable, revisioned source records. Cache once per record,
  // rather than rehashing its description on every artwork page that uses it.
  resolved.set(item, text);
  return text;
}
