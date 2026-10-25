import test from 'node:test';
import assert from 'node:assert/strict';
import { diverseRecentArtwork } from '../src/lib/recent-artwork.ts';

const item = (topic, category, createdAt = '2026-10-25T12:00:00Z') => ({
  topic,
  category,
  createdAt,
});
test('a large flags and travel release does not crowd other new subjects off the homepage', () => {
  const categories = {
    seasonal: ['autumn', 'harvest'],
    flags: ['american-flag', 'france-flag', 'spain-flag', 'mexico-flag'],
    travel: ['france', 'spain', 'paris', 'new-york', 'chicago', 'miami'],
    school: ['clock', 'math'],
    transport: ['airplane', 'train'],
    space: ['mars', 'moon'],
    clothing: ['glove', 'shoe'],
    family: ['mom', 'thank-you'],
    nature: ['wave', 'grass'],
    technology: ['iphone', 'samsung'],
    sports: ['exercise'],
    food: ['cheese', 'candy'],
  };
  const source = Object.entries(categories).flatMap(([category, topics]) =>
    topics.map((topic) => item(topic, category)),
  );
  const lookup = new Map(source.map((record) => [record.topic, record.category]));
  const selected = diverseRecentArtwork(source, (topic) => lookup.get(topic));
  assert.equal(selected.length, 12);
  assert.equal(new Set(selected.map((record) => record.category)).size, 12);
  assert.equal(selected[0].topic, 'autumn');
  assert.ok(selected.some((record) => record.topic === 'american-flag'));
  assert.ok(selected.some((record) => record.topic === 'cheese'));
  assert.deepEqual(source[0], item('autumn', 'seasonal'));
});

test('older variety cannot displace a recent release and subjects never repeat', () => {
  const source = [
    item('american-flag', 'flags'),
    item('american-flag', 'flags'),
    item('france-flag', 'flags'),
    { ...item('unpublished', 'food'), published: false },
    { ...item('unreviewed', 'space'), indexable: false },
    item('birthday', 'family', '2026-09-01T00:00:00Z'),
    item('rabbit', 'animals', '2026-08-01T00:00:00Z'),
  ];
  const lookup = new Map(source.map((record) => [record.topic, record.category]));
  assert.deepEqual(
    diverseRecentArtwork(source, (topic) => lookup.get(topic)).map((record) => record.topic),
    ['american-flag', 'france-flag', 'birthday', 'rabbit'],
  );
  assert.deepEqual(
    diverseRecentArtwork(source, () => '', 0),
    [],
  );
  assert.equal(diverseRecentArtwork([], () => '').length, 0);
});
