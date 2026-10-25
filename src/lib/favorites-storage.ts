import { BOARDS_KEY, readBoards, saveBoards } from './favorite-boards.ts';
export const FAVORITES_KEY = 'ultraclipart-favorites';
type FavoriteStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function parseFavoriteIds(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]');
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter(
              (id): id is string => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id),
            ),
          ),
        ].slice(0, 10_000)
      : [];
  } catch {
    return [];
  }
}

/** Read immediately before writing, so another tab's saved choices are retained. */
export function toggleStoredFavorite(
  storage: FavoriteStorage,
  id: string,
  metadata?: { title?: string; thumb?: string },
  now = new Date().toISOString(),
): string[] {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Invalid artwork identity.');
  const current = parseFavoriteIds(storage.getItem(FAVORITES_KEY));
  if (!current.includes(id) && current.length >= 10_000)
    throw new Error('Favorite limit reached. Export a backup before removing saved designs.');
  const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
  const beforeBoards = storage.getItem(BOARDS_KEY);
  const boards = readBoards(storage);
  if (current.includes(id)) delete boards.entries[id];
  else boards.entries[id] = { savedAt: now, note: '', boards: [], ...metadata };
  saveBoards(storage, boards);
  try {
    storage.setItem(FAVORITES_KEY, JSON.stringify(next));
  } catch (error) {
    try {
      storage.setItem(
        BOARDS_KEY,
        beforeBoards || JSON.stringify({ schema: 1, boards: [], entries: {} }),
      );
    } catch {}
    throw error;
  }
  return next;
}
