import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '..'),
  read = (path) => JSON.parse(readFileSync(join(root, path)));
const topics = read('data/topics.json').topics,
  art = read('data/art.json');
const prior = read('data/production-queue.json');
const approved = art.filter((a) => a.published);
const originalTopics = new Set(topics.map((t) => t.slug));
const originalArt = art.filter((a) => originalTopics.has(a.topic));
const queue = {
  version: 2,
  states: prior.states,
  targetArtworkCount: 5500,
  generatedArtworkCount: originalArt.length,
  supplementalArtworkCount: art.length - originalArt.length,
  qualityApprovedArtworkCount: originalArt.filter((a) => a.published).length,
  supplementalApprovedArtworkCount: approved.filter((a) => !originalTopics.has(a.topic)).length,
  reviewerType: 'AI_AGENT_NOT_HUMAN',
  humanApprovedArtworkCount: 0,
  availableArtworkCount: art.length,
  remainingToDraw: 5500 - originalArt.length,
  nextAction:
    'Develop distinct compositions for the remaining topic targets; export, visually review, verify all R2/CDN representations, then publish a complete wave.',
  topics: topics.map((t) => {
    const items = art.filter((a) => a.topic === t.slug);
    if (items.length > 50) throw new Error('Topic target exceeded');
    const briefPath = `data/briefs/${t.slug}.json`;
    const brief = existsSync(join(root, briefPath)) ? read(briefPath) : null;
    const reviewed =
      brief?.rows?.length === 50 &&
      brief.rows.every((row) => row.briefReview === 'REVIEWED_FOR_DISTINCT_COMPOSITION');
    return {
      topic: t.slug,
      keyword: t.keyword,
      wave: t.wave,
      target: 50,
      generated: items.length,
      approved: items.filter((a) => a.published).length,
      remainingToDraw: 50 - items.length,
      briefStatus: reviewed
        ? '50_COMPOSITIONS_REVIEWED'
        : brief
          ? 'DRAFT_ROWS_REQUIRE_REVIEW'
          : 'NOT_STARTED',
      briefPath: existsSync(join(root, briefPath)) ? briefPath : null,
    };
  }),
  generated: art.map((a) => ({
    id: a.id,
    topic: a.topic,
    state: a.published ? 'PUBLISHED' : 'ART_REVIEW',
    retryCount: 0,
    failReason: null,
    artReview: a.reviewStatus,
    humanReview: 'NOT_PERFORMED',
    publicationBlocked: !a.published,
    sha256: (a.files.svg ?? a.files.webp).sha256,
  })),
};
writeFileSync(join(root, 'data/production-queue.json'), JSON.stringify(queue, null, 2) + '\n');
console.log({
  drawn: queue.generatedArtworkCount,
  remaining: queue.remainingToDraw,
  reviewed: approved.length,
});
