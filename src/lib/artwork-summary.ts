/** Shared, server-side captions for current and future catalog additions. */
export const AUTO_SUMMARY_VERSION = 'uc-artwork-caption-1';
export const CARD_SUMMARY_MAX_LENGTH = 125;

type SummarySource = {
  id: string;
  title: string;
  description?: string;
  alt?: string;
};

const sentences = new Intl.Segmenter('en', { granularity: 'sentence' });
// These describe a file or suggest a use, rather than describing the picture.
const instruction =
  /^(?:use|allow|arrange|add|place|pair|print|download|choose|keep|try|leave|make|create|find|browse|explore|check|save|open|read|perfect for|ideal for|useful for|suitable for|great for|from the|similar composition)\b/i;
const usage = /\b(?:suits|works well for|can be used|is (?:ideal|perfect|suitable|useful) for)\b/i;
const unfinished =
  /\b(?:a|an|the|and|or|but|with|without|of|for|from|to|in|on|at|by|as|into|beside|behind|among|between|near|under|over|above|below|around|through|along|including|featuring|wearing|holding|carrying|showing|made|rendered|painted|drawn|shaped|filled|printed|its|their)\s*$/i;

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function titleText(value: string): string {
  return clean(value)
    .replace(/\s+clipart\s*$/i, '')
    .trim();
}

function sentence(value: string): string {
  const text = clean(value).replace(/[\s,;:.!?–—-]+$/, '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) + '.' : '';
}

function complete(value: string): string | undefined {
  const text = sentence(value);
  const body = text.slice(0, -1);
  if (
    !body ||
    text.length > CARD_SUMMARY_MAX_LENGTH ||
    /(?:…|\.{2,})/.test(text) ||
    unfinished.test(body) ||
    (body.match(/\(/g)?.length ?? 0) !== (body.match(/\)/g)?.length ?? 0)
  )
    return;
  return text;
}

function visualSentences(value: string, title: string): string[] {
  const parts = [...sentences.segment(clean(value))].map((part) => clean(part.segment));
  // Alt text sometimes starts with the title, followed by the actual scene.
  return parts.filter((part) => {
    const body = sentence(part).toLowerCase();
    return (
      body !== sentence(title).toLowerCase() &&
      body !== sentence(titleText(title)).toLowerCase() &&
      !instruction.test(part) &&
      !usage.test(part) &&
      !/^(?:transparent background|(?:webp|png|pdf|svg) (?:file|image|download))\b/i.test(part)
    );
  });
}

function withoutFileDetails(value: string): string {
  return value
    .replace(/\s*\([^()]*\b(?:webp|png|pdf|svg|dpi|pixels?|transparent background)\b[^()]*\)/gi, '')
    .replace(/(?:,?\s+(?:on|against|with)\s+(?:a\s+)?transparent background)[.!?]?$/i, '')
    .replace(/(?:,?\s+(?:isolated\s+)?on\s+(?:a\s+)?(?:plain\s+)?white background)[.!?]?$/i, '');
}

/**
 * Select a whole descriptive phrase at a punctuation or modifier boundary.
 * Never slice at a character/word count, add ellipses or invent visual details.
 */
function compactPhrase(value: string): string | undefined {
  const boundaries = [
    ...value.matchAll(
      /[,;:]\s+|\s+[–—]\s+|\s+(?=(?:with|without|beside|behind|among|between|near|under|above|below|around|against|featuring|including|rendered|painted|drawn|illustrated)\b)/gi,
    ),
  ];
  for (const boundary of boundaries.reverse()) {
    const prefix = value.slice(0, boundary.index).trim();
    // Very short subject-only fragments are reserved for the title fallback.
    if (prefix.length < 32) continue;
    const text = complete(prefix);
    if (text) return text;
  }
}

/** No model, network request, per-topic template or separate intake step. */
export function automaticArtworkSummary(item: SummarySource): string {
  const sources = [
    ...visualSentences(item.description || '', item.title),
    ...visualSentences(item.alt || '', item.title),
  ];
  // Prefer an intact scene description, including a shorter alt when available.
  for (const source of sources) {
    const text = complete(source);
    if (text) return text;
  }
  const visual = sources.map(withoutFileDetails);
  for (const source of visual) {
    const text = complete(source);
    if (text) return text;
  }
  for (const source of visual) {
    const text = compactPhrase(source);
    if (text) return text;
  }
  // A concise title is still factual when there is no usable scene description.
  const title = titleText(item.title);
  const fallback = complete(title) || compactPhrase(title);
  if (fallback) return fallback;
  // Reject unusable intake text instead of publishing clipped or invented copy.
  throw new Error(`Artwork ${item.id} needs a concise descriptive title or sentence for its card.`);
}
