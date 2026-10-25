import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARDS_KEY,
  parseBoards,
  createBoard,
  assignBoard,
  removeBoard,
  readBoards,
} from '../src/lib/favorite-boards.ts';
import { FAVORITES_KEY, toggleStoredFavorite } from '../src/lib/favorites-storage.ts';
const memory = () => {
  const map = new Map();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  };
};
const blank = () => parseBoards(null);
test('legacy favorites retain unknown dates; newly saved favorites record the actual supplied instant', () => {
  const s = memory();
  s.setItem(FAVORITES_KEY, '["legacy-apple"]');
  const now = '2026-10-25T08:15:42.000Z';
  toggleStoredFavorite(
    s,
    'new-apple',
    { title: 'Apple drawing', thumb: '/catalog/apple/new-apple-thumb.webp' },
    now,
  );
  const state = readBoards(s);
  assert.equal(state.entries['legacy-apple'], undefined);
  assert.equal(state.entries['new-apple'].savedAt, now);
  assert.equal(state.entries['new-apple'].title, 'Apple drawing');
  toggleStoredFavorite(s, 'new-apple');
  assert.equal(readBoards(s).entries['new-apple'], undefined);
});
test('board names, descriptions, colors and memberships persist independently of saved dates', () => {
  const state = blank(),
    created = '2026-10-25T08:00:00.000Z';
  const first = createBoard(
    state,
    'For my child',
    'Birthday inspiration',
    'rose',
    created,
    'board-child',
  );
  createBoard(state, 'Classroom ideas', '', 'sage', created, 'board-classroom');
  state.entries.apple = { savedAt: created, note: 'Use on a birthday card', boards: [] };
  assignBoard(state, ['apple'], 'board-child');
  assignBoard(state, ['apple'], 'board-classroom');
  assert.deepEqual(state.entries.apple.boards, ['board-child', 'board-classroom']);
  assert.equal(state.entries.apple.savedAt, created);
  assert.equal(first.title, 'For my child');
  const restored = parseBoards(JSON.stringify(state));
  assert.equal(restored.boards[0].color, 'rose');
  assert.equal(restored.entries.apple.note, 'Use on a birthday card');
  assignBoard(state, ['apple'], 'board-child', true);
  assert.deepEqual(state.entries.apple.boards, ['board-classroom']);
  removeBoard(state, 'board-classroom');
  assert.ok(state.entries.apple);
  assert.deepEqual(state.entries.apple.boards, []);
  assert.equal(state.entries.apple.savedAt, created);
});
test('board parser sanitizes imported payloads, rejects unsafe images, invalid dates and dangling memberships', () => {
  const state = blank();
  createBoard(
    state,
    '<img src=x onerror=alert(1)>',
    '',
    'blue',
    '2026-10-25T08:00:00Z',
    'board-one',
  );
  state.entries.apple = {
    savedAt: 'invalid',
    title: 'Apple',
    thumb: 'javascript:alert(1)',
    note: 'a'.repeat(900),
    boards: ['board-one', 'not-present', 'board-one'],
  };
  const parsed = parseBoards(JSON.stringify(state));
  assert.equal(parsed.entries.apple.savedAt, undefined);
  assert.equal(parsed.entries.apple.thumb, undefined);
  assert.equal(parsed.entries.apple.note.length, 500);
  assert.deepEqual(parsed.entries.apple.boards, ['board-one']);
  assert.equal(parsed.boards[0].title, '<img src=x onerror=alert(1)>');
  for (const raw of ['null', '[]', '{}', '{', '{"schema":9,"boards":[],"entries":{}}'])
    assert.equal(parseBoards(raw).boards.length, 0);
});
test('a failed favorites write restores previous board metadata and never reports a false save', () => {
  const s = memory();
  s.setItem(FAVORITES_KEY, '["legacy"]');
  const before = JSON.stringify(blank());
  s.setItem(BOARDS_KEY, before);
  const wrapped = {
    getItem: s.getItem,
    setItem: (key, value) => {
      if (key === FAVORITES_KEY) throw new DOMException('Full', 'QuotaExceededError');
      s.setItem(key, value);
    },
  };
  assert.throws(() => toggleStoredFavorite(wrapped, 'new-favorite'));
  assert.equal(s.getItem(FAVORITES_KEY), '["legacy"]');
  assert.equal(s.getItem(BOARDS_KEY), before);
});
test('new favorite writes retain board edits previously saved in another tab', () => {
  const s = memory(),
    state = blank();
  createBoard(state, 'A personal project', '', 'gold', '2026-10-25T08:00:00Z', 'board-project');
  s.setItem(BOARDS_KEY, JSON.stringify(state));
  toggleStoredFavorite(s, 'new-design');
  assert.equal(readBoards(s).boards[0].title, 'A personal project');
});
test('a board has a bounded valid identity and names cannot be empty or duplicated by ID', () => {
  const state = blank();
  assert.throws(() => createBoard(state, '   '));
  assert.throws(() => createBoard(state, 'Name', '', 'blue', undefined, '../bad'));
  createBoard(state, 'First', '', 'blue', undefined, 'board-one');
  assert.throws(() => createBoard(state, 'Second', '', 'blue', undefined, 'board-one'));
  assert.throws(() => assignBoard(state, ['apple'], 'missing-board'));
});
