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
export function toggleStoredFavorite(storage: FavoriteStorage, id: string): string[] {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Invalid artwork identity.');
  const current = parseFavoriteIds(storage.getItem(FAVORITES_KEY));
  const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
  storage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return next;
}
