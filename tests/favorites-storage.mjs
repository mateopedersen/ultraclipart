import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FAVORITES_KEY,
  parseFavoriteIds,
  toggleStoredFavorite,
} from '../src/lib/favorites-storage.ts';

test('favorite IDs tolerate corrupt JSON and reject nonarrays, invalid entries and duplicates', () => {
  for (const value of ['null', '{}', 'true', '"ghost"', '{', null])
    assert.deepEqual(parseFavoriteIds(value), []);
  assert.deepEqual(parseFavoriteIds('["ghost","ghost",null,3,"../bad","pumpkin-curly-vine"]'), [
    'ghost',
    'pumpkin-curly-vine',
  ]);
});

test('each favorite toggle re-reads storage and preserves a previous write from another tab', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  assert.deepEqual(toggleStoredFavorite(storage, 'pumpkin'), ['pumpkin']);
  assert.deepEqual(toggleStoredFavorite(storage, 'ghost'), ['pumpkin', 'ghost']);
  assert.deepEqual(toggleStoredFavorite(storage, 'pumpkin'), ['ghost']);
  assert.equal(values.get(FAVORITES_KEY), '["ghost"]');
});

test('storage write failures propagate without a false saved result or changing previous choices', () => {
  const before = '["pumpkin"]';
  const storage = {
    getItem: () => before,
    setItem: () => {
      throw new DOMException('Full', 'QuotaExceededError');
    },
  };
  assert.throws(() => toggleStoredFavorite(storage, 'ghost'), { name: 'QuotaExceededError' });
  assert.deepEqual(parseFavoriteIds(storage.getItem(FAVORITES_KEY)), ['pumpkin']);
});
