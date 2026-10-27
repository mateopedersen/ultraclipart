import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBoards,
  createBoard,
  assignBoard,
  duplicateBoard,
  normalizeFavoriteTags,
  matchesFavoriteQuery,
  favoriteCsv,
} from '../src/lib/favorite-boards.ts';
const now = '2026-10-27T09:00:00.000Z';
test('new optional organization fields survive backups; old schema remains valid', () => {
  const s = parseBoards(null);
  createBoard(s, 'Birthday', '', 'blue', now, 'board-first');
  Object.assign(s.boards[0], { pinned: true, archived: true, coverId: 'apple' });
  s.entries.apple = {
    boards: ['board-first'],
    note: 'Invitation',
    stage: 'ready',
    pinned: true,
    tags: ['summer', 'summer'],
    updatedAt: now,
  };
  const r = parseBoards(JSON.stringify(s));
  assert.equal(r.boards[0].coverId, 'apple');
  assert.equal(r.boards[0].archived, true);
  assert.equal(r.entries.apple.stage, 'ready');
  assert.deepEqual(r.entries.apple.tags, ['summer']);
  assert.deepEqual(
    parseBoards(
      JSON.stringify({ schema: 1, boards: [], entries: { apple: { note: 'old', boards: [] } } }),
    ).entries.apple,
    { note: 'old', boards: [] },
  );
});
test('invalid status, prototype identities and invalid updated date do not enter saved state', () => {
  const s = parseBoards(
    JSON.stringify({
      schema: 1,
      boards: [],
      entries: {
        apple: {
          stage: '<script>',
          note: 'safe',
          tags: [' x ', {}, 'X'],
          updatedAt: 'yesterday',
          boards: [],
        },
        __proto__: { note: 'unsafe' },
      },
    }),
  );
  assert.equal(s.entries.apple.stage, undefined);
  assert.equal(s.entries.apple.updatedAt, undefined);
  assert.deepEqual(s.entries.apple.tags, ['x']);
  assert.equal(Object.getPrototypeOf(s.entries), null);
});
test('board duplication preserves source memberships and selected cover', () => {
  const s = parseBoards(null);
  createBoard(s, 'Project', '', 'rose', now, 'board-first');
  s.entries.apple = { note: 'keep', boards: [] };
  assignBoard(s, ['apple'], 'board-first');
  s.boards[0].coverId = 'apple';
  const copy = duplicateBoard(s, 'board-first', now);
  assert.equal(copy.coverId, 'apple');
  assert.deepEqual(s.entries.apple.boards, ['board-first', copy.id]);
  assert.equal(copy.archived, undefined);
  assert.equal(s.entries.apple.note, 'keep');
});
test('search supports any word order, accents, notes, tags, phrases and exclusions', () => {
  const e = {
    title: 'Café Flower Drawing',
    note: 'Summer invitation',
    boards: [],
    tags: ['birthday'],
  };
  for (const q of ['flower cafe', 'birthday invitation', '"summer invitation" -winter'])
    assert.equal(matchesFavoriteQuery('flower', e, q), true);
  for (const q of ['flower -cafe', '"invitation summer"', 'missing'])
    assert.equal(matchesFavoriteQuery('flower', e, q), false);
  assert.deepEqual(normalizeFavoriteTags(' Summer, SUMMER, Birthday, ,'), ['summer', 'birthday']);
});
test('CSV uses public artwork URLs, escapes quotes and prevents spreadsheet formula execution', () => {
  const s = parseBoards(null);
  s.entries.apple = {
    title: 'Apple "Red"',
    note: ' =HYPERLINK("bad")',
    boards: [],
    stage: 'used',
    tags: ['summer'],
  };
  const csv = favoriteCsv(['apple'], s);
  assert.ok(csv.includes('https://ultraclipart.com/art/apple/'));
  assert.ok(csv.includes('Apple ""Red""'));
  assert.ok(csv.includes("' =HYPERLINK"));
  assert.ok(csv.includes('summer'));
  assert.ok(csv.includes('used'));
});
