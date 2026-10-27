export const BOARDS_KEY = 'ultraclipart-favorite-boards-v1';
export const BOARD_COLORS = ['blue', 'rose', 'sage', 'gold', 'lavender'] as const;
export type BoardColor = (typeof BOARD_COLORS)[number];
export const FAVORITE_STAGES = ['idea', 'shortlist', 'ready', 'used'] as const;
export type FavoriteStage = (typeof FAVORITE_STAGES)[number];
export interface FavoriteBoard {
  id: string;
  title: string;
  description: string;
  color: BoardColor;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  archived?: boolean;
  coverId?: string;
}
export interface FavoriteEntry {
  savedAt?: string;
  title?: string;
  thumb?: string;
  note: string;
  boards: string[];
  pinned?: boolean;
  stage?: FavoriteStage;
  tags?: string[];
  updatedAt?: string;
}
export interface BoardState {
  schema: 1;
  boards: FavoriteBoard[];
  entries: Record<string, FavoriteEntry>;
}
export type BoardStorage = Pick<Storage, 'getItem' | 'setItem'>;
const identity = (id: unknown): id is string =>
  typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const date = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT/.test(value) &&
  Number.isFinite(Date.parse(value));
export function parseBoards(value: string | null): BoardState {
  const empty: BoardState = { schema: 1, boards: [], entries: Object.create(null) };
  try {
    const data = JSON.parse(value || '{}');
    if (
      data?.schema !== 1 ||
      !Array.isArray(data.boards) ||
      !data.entries ||
      typeof data.entries !== 'object' ||
      Array.isArray(data.entries)
    )
      return empty;
    const ids = new Set<string>();
    for (const b of data.boards.slice(0, 100)) {
      if (
        !b ||
        !identity(b.id) ||
        ids.has(b.id) ||
        !text(b.title, 80) ||
        !date(b.createdAt) ||
        !date(b.updatedAt)
      )
        continue;
      ids.add(b.id);
      empty.boards.push({
        id: b.id,
        title: text(b.title, 80),
        description: text(b.description, 240),
        color: BOARD_COLORS.includes(b.color) ? b.color : 'blue',
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        ...(b.pinned === true ? { pinned: true } : {}),
        ...(b.archived === true ? { archived: true } : {}),
        ...(identity(b.coverId) ? { coverId: b.coverId } : {}),
      });
    }
    for (const [id, e] of Object.entries(data.entries).slice(0, 10000)) {
      if (!identity(id) || !e || typeof e !== 'object') continue;
      const entry = e as Record<string, unknown>;
      const thumb =
        typeof entry.thumb === 'string' &&
        (/^\/catalog\/[a-z0-9/_-]+\.webp$/.test(entry.thumb) ||
          /^https:\/\/assets\.ultraclipart\.com\/[a-zA-Z0-9/_.%-]+\.webp$/.test(entry.thumb))
          ? entry.thumb
          : undefined;
      empty.entries[id] = {
        ...(date(entry.savedAt) ? { savedAt: entry.savedAt } : {}),
        ...(text(entry.title, 200) ? { title: text(entry.title, 200) } : {}),
        ...(thumb ? { thumb } : {}),
        note: text(entry.note, 500),
        ...(entry.pinned === true ? { pinned: true } : {}),
        ...(FAVORITE_STAGES.includes(entry.stage as FavoriteStage)
          ? { stage: entry.stage as FavoriteStage }
          : {}),
        ...(Array.isArray(entry.tags)
          ? {
              tags: normalizeFavoriteTags(
                entry.tags.filter((tag): tag is string => typeof tag === 'string').join(','),
              ),
            }
          : {}),
        ...(date(entry.updatedAt) ? { updatedAt: entry.updatedAt } : {}),
        boards: Array.isArray(entry.boards)
          ? [
              ...new Set(
                entry.boards.filter((b): b is string => typeof b === 'string' && ids.has(b)),
              ),
            ]
          : [],
      };
    }
    return empty;
  } catch {
    return empty;
  }
}
export function normalizeFavoriteTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((tag) => tag.trim().toLocaleLowerCase('en-US').slice(0, 30))
        .filter(Boolean),
    ),
  ].slice(0, 12);
}
export function matchesFavoriteQuery(id: string, entry: FavoriteEntry | undefined, query: string) {
  const normalize = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('en-US');
  const haystack = normalize(
    `${entry?.title || id.replaceAll('-', ' ')} ${entry?.note || ''} ${(entry?.tags || []).join(' ')}`,
  );
  const terms = [...normalize(query).matchAll(/(-?)"([^"]+)"|(-?)(\S+)/g)];
  return terms.every((term) => {
    const exclude = term[1] === '-' || term[3] === '-';
    const value = term[2] || term[4];
    return exclude ? !haystack.includes(value) : haystack.includes(value);
  });
}
export function duplicateBoard(
  state: BoardState,
  sourceId: string,
  now = new Date().toISOString(),
) {
  const source = state.boards.find((board) => board.id === sourceId);
  if (!source) throw new Error('This board is no longer available.');
  const board = createBoard(
    state,
    `${source.title.slice(0, 73)} (copy)`,
    source.description,
    source.color,
    now,
  );
  if (source.coverId) board.coverId = source.coverId;
  const members = Object.keys(state.entries).filter((id) =>
    state.entries[id].boards.includes(sourceId),
  );
  assignBoard(state, members, board.id, false, now);
  return board;
}
export function favoriteCsv(ids: string[], state: BoardState) {
  const cell = (value: string) => {
    // Spreadsheet formulas must remain inert when the user opens exported notes.
    const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const rows = [['Title', 'Artwork URL', 'Stage', 'Tags', 'Note', 'Saved At', 'Boards']];
  for (const id of ids.filter(identity)) {
    const e = state.entries[id];
    rows.push([
      e?.title || id.replaceAll('-', ' '),
      `https://ultraclipart.com/art/${id}/`,
      e?.stage || 'idea',
      (e?.tags || []).join(', '),
      e?.note || '',
      e?.savedAt || '',
      state.boards
        .filter((b) => e?.boards.includes(b.id))
        .map((b) => b.title)
        .join(', '),
    ]);
  }
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n');
}
export function readBoards(storage: BoardStorage) {
  return parseBoards(storage.getItem(BOARDS_KEY));
}
export function saveBoards(storage: BoardStorage, state: BoardState) {
  const safe = parseBoards(JSON.stringify(state));
  storage.setItem(BOARDS_KEY, JSON.stringify(safe));
  return safe;
}
export function createBoard(
  state: BoardState,
  title: string,
  description = '',
  color: BoardColor = 'blue',
  now = new Date().toISOString(),
  id = `board-${crypto.randomUUID()}`,
) {
  if (state.boards.length >= 100) throw new Error('You can keep up to 100 boards.');
  const name = text(title, 80);
  if (!name || !identity(id) || state.boards.some((b) => b.id === id))
    throw new Error('Please enter a board name.');
  const board: FavoriteBoard = {
    id,
    title: name,
    description: text(description, 240),
    color: BOARD_COLORS.includes(color) ? color : 'blue',
    createdAt: now,
    updatedAt: now,
  };
  state.boards.push(board);
  return board;
}
export function assignBoard(
  state: BoardState,
  ids: string[],
  boardId: string,
  remove = false,
  now = new Date().toISOString(),
) {
  const board = state.boards.find((b) => b.id === boardId);
  if (!board) throw new Error('Choose an available board.');
  for (const id of ids.filter(identity)) {
    const entry = state.entries[id] ?? { note: '', boards: [] };
    entry.boards = remove
      ? entry.boards.filter((b) => b !== boardId)
      : [...new Set([...entry.boards, boardId])];
    state.entries[id] = entry;
  }
  board.updatedAt = now;
}
export function removeBoard(state: BoardState, id: string) {
  state.boards = state.boards.filter((b) => b.id !== id);
  for (const entry of Object.values(state.entries))
    entry.boards = entry.boards.filter((b) => b !== id);
}
