import { SearchRepository } from '../lib/search-remote';
import { LatestRequest } from '../lib/search-request';
import { renderCard } from './search-card';
import { FAVORITES_KEY, parseFavoriteIds } from '../lib/favorites-storage';
import {
  BOARDS_KEY,
  readBoards,
  saveBoards,
  parseBoards,
  createBoard,
  assignBoard,
  removeBoard,
  duplicateBoard,
  normalizeFavoriteTags,
  matchesFavoriteQuery,
  favoriteCsv,
  FAVORITE_STAGES,
  type FavoriteStage,
  type BoardState,
  type BoardColor,
} from '../lib/favorite-boards';
export const readFavoriteIds = parseFavoriteIds;
const PAGE_SIZE = 8;
const VIEW_KEY = 'ultraclipart-favorites-view-v1';
export function initFavorites() {
  const gallery = document.querySelector<HTMLElement>('#favorites');
  if (!gallery) return;
  const q = <T extends HTMLElement = HTMLElement>(selector: string) =>
    document.querySelector<T>(selector)!;
  const count = q('#favorites-count'),
    empty = q('#favorites-empty'),
    error = q('#favorites-error'),
    missing = q('#favorites-missing'),
    nav = q('#favorites-pagination');
  const previous = q<HTMLButtonElement>('#favorites-previous'),
    next = q<HTMLButtonElement>('#favorites-next'),
    status = q('#boards-status');
  const search = q<HTMLInputElement>('#favorites-search'),
    sort = q<HTMLSelectElement>('#favorites-sort'),
    date = q<HTMLSelectElement>('#favorites-date');
  const boardDialog = q<HTMLDialogElement>('#board-dialog'),
    boardForm = q<HTMLFormElement>('#board-form'),
    organizeDialog = q<HTMLDialogElement>('#favorite-organize-dialog'),
    organizeForm = q<HTMLFormElement>('#favorite-organize-form');
  const repository = new SearchRepository(),
    requests = new LatestRequest();
  let page = 1,
    active = 'all',
    editingBoard = '',
    editingArt = '',
    selecting = false;
  let filteredIds: string[] = [],
    visibleIds: string[] = [];
  const selected = new Set<string>();
  let undo: (() => void) | undefined;
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const button = (text: string) => {
    const el = make('button', text);
    el.type = 'button';
    return el;
  };
  const notify = (text: string) => {
    status.textContent = text;
    status.hidden = false;
  };
  const ids = () => parseFavoriteIds(localStorage.getItem(FAVORITES_KEY));
  const field = <T extends HTMLInputElement | HTMLSelectElement>(id: string) => q<T>(`#${id}`);
  const pinFilter = field<HTMLInputElement>('favorites-pinned'),
    noteFilter = field<HTMLInputElement>('favorites-noted'),
    stageFilter = field<HTMLSelectElement>('favorites-stage'),
    tagFilter = field<HTMLSelectElement>('favorites-tag'),
    pageSizeControl = field<HTMLSelectElement>('favorites-page-size'),
    density = field<HTMLSelectElement>('favorites-density'),
    showNotes = field<HTMLInputElement>('favorites-show-notes');
  try {
    const prefs = JSON.parse(localStorage.getItem(VIEW_KEY) || '{}');
    if (['8', '16', '32'].includes(prefs.pageSize)) pageSizeControl.value = prefs.pageSize;
    if (['comfortable', 'compact'].includes(prefs.density)) density.value = prefs.density;
    if (typeof prefs.showNotes === 'boolean') showNotes.checked = prefs.showNotes;
  } catch {
    /* The saved artwork is independent of optional view preferences. */
  }
  function updateViewPreferences() {
    gallery!.dataset.density = density.value;
    gallery!.classList.toggle('hide-favorite-notes', !showNotes.checked);
    try {
      localStorage.setItem(
        VIEW_KEY,
        JSON.stringify({
          pageSize: pageSizeControl.value,
          density: density.value,
          showNotes: showNotes.checked,
        }),
      );
    } catch {
      /* Viewing remains available without storage. */
    }
  }
  updateViewPreferences();
  function persist(state: BoardState, list = ids()) {
    const old = localStorage.getItem(BOARDS_KEY),
      oldIds = localStorage.getItem(FAVORITES_KEY);
    saveBoards(localStorage, state);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
    } catch (e) {
      try {
        localStorage.setItem(
          BOARDS_KEY,
          old || JSON.stringify({ schema: 1, boards: [], entries: {} }),
        );
        localStorage.setItem(FAVORITES_KEY, oldIds || '[]');
      } catch {}
      throw e;
    }
  }
  const guarded = (work: () => void) => {
    try {
      work();
    } catch {
      notify(
        'Your changes could not be saved. Browser storage may be full or unavailable. Export a backup before clearing browser data.',
      );
    }
  };
  function enableUndo(action: () => void) {
    undo = action;
    q('#boards-undo').hidden = false;
  }
  function removeFavorites(remove: string[]) {
    const state = readBoards(localStorage),
      list = ids(),
      removed = list.filter((id) => remove.includes(id)),
      entries = new Map(removed.map((id) => [id, state.entries[id]]));
    for (const id of removed) delete state.entries[id];
    persist(
      state,
      list.filter((id) => !remove.includes(id)),
    );
    enableUndo(() => {
      const current = readBoards(localStorage),
        saved = ids();
      for (const id of removed)
        if (!saved.includes(id)) {
          saved.push(id);
          const entry = entries.get(id);
          if (entry) current.entries[id] = entry;
        }
      persist(current, saved);
      render();
      notify('Favorites restored.');
    });
    selected.clear();
    render();
    notify(
      `${removed.length} ${removed.length === 1 ? 'favorite' : 'favorites'} removed. You can undo this change.`,
    );
  }
  function renderBoards(state: BoardState, list: string[]) {
    const root = q('#board-list');
    root.replaceChildren();
    const card = (id: string, title: string, amount: number, color = 'blue') => {
      const tile = button('');
      tile.className = 'board-tile';
      tile.dataset.board = id;
      tile.dataset.color = color;
      tile.setAttribute('aria-pressed', String(active === id));
      const cover = make('span', '', 'board-cover');
      const members = list.filter((item) =>
        id === 'all' || id === 'unsorted'
          ? !state.entries[item]?.boards.length
          : state.entries[item]?.boards.includes(id),
      );
      const coverId = state.boards.find((b) => b.id === id)?.coverId;
      const coverMembers = id === 'all' ? list : members;
      const images = (
        coverId && coverMembers.includes(coverId)
          ? [coverId, ...coverMembers.filter((item) => item !== coverId)]
          : coverMembers
      )
        .map((item) => state.entries[item]?.thumb)
        .filter((url): url is string => !!url)
        .slice(0, 3);
      for (const url of images) {
        const img = make('img');
        img.src = url;
        img.alt = '';
        img.loading = 'lazy';
        img.width = 160;
        img.height = 160;
        cover.append(img);
      }
      if (!images.length) {
        const icon = make(
          'span',
          id === 'all' ? '♡' : id === 'unsorted' ? '＋' : title.slice(0, 1).toUpperCase(),
          'board-cover-letter',
        );
        cover.append(icon);
      }
      tile.append(
        cover,
        make('strong', title),
        make('span', `${amount} ${amount === 1 ? 'design' : 'designs'}`, 'board-tile-count'),
      );
      root.append(tile);
    };
    card('all', 'All favorites', list.length);
    card(
      'unsorted',
      'Not in a board',
      list.filter((id) => !state.entries[id]?.boards.length).length,
      'gold',
    );
    const boardQuery = field<HTMLInputElement>('board-search').value.trim().toLocaleLowerCase();
    const boards = state.boards.filter(
      (b) =>
        (!b.archived || field<HTMLInputElement>('board-archived').checked) &&
        `${b.title} ${b.description}`.toLocaleLowerCase().includes(boardQuery),
    );
    const boardSort = field<HTMLSelectElement>('board-sort').value;
    const membersCount = (id: string) =>
      list.filter((item) => state.entries[item]?.boards.includes(id)).length;
    boards.sort(
      (a, b) =>
        Number(!!b.pinned) - Number(!!a.pinned) ||
        (boardSort === 'title'
          ? a.title.localeCompare(b.title)
          : boardSort === 'count'
            ? membersCount(b.id) - membersCount(a.id)
            : Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    );
    for (const board of boards)
      card(
        board.id,
        `${board.pinned ? '★ ' : ''}${board.title}${board.archived ? ' · Archived' : ''}`,
        list.filter((id) => state.entries[id]?.boards.includes(board.id)).length,
        board.color,
      );
    q('#board-no-results').hidden = boards.length > 0 || (!boardQuery && !state.boards.length);
    q('#boards-quick-start').hidden = state.boards.length > 0;
    const select = q<HTMLSelectElement>('#favorites-bulk-board'),
      current = select.value;
    select.replaceChildren();
    const initial = make('option', 'Choose a board');
    initial.value = '';
    select.append(initial);
    for (const board of state.boards) {
      const option = make('option', board.title);
      option.value = board.id;
      select.append(option);
    }
    select.value = current;
  }
  function render() {
    let list: string[], state: BoardState;
    try {
      list = ids();
      state = readBoards(localStorage);
    } catch {
      gallery!.setAttribute('aria-busy', 'false');
      error.hidden = false;
      notify('Your saved collection cannot be opened while browser storage is unavailable.');
      return;
    }
    if (!['all', 'unsorted'].includes(active) && !state.boards.some((b) => b.id === active))
      active = 'all';
    for (const id of selected) if (!list.includes(id)) selected.delete(id);
    renderBoards(state, list);
    q('#stat-all').textContent = String(list.length);
    q('#stat-pinned').textContent = String(list.filter((id) => state.entries[id]?.pinned).length);
    q('#stat-ready').textContent = String(
      list.filter((id) => state.entries[id]?.stage === 'ready').length,
    );
    q('#stat-notes').textContent = String(list.filter((id) => state.entries[id]?.note).length);
    const currentTag = tagFilter.value;
    tagFilter.replaceChildren(new Option('All Tags', ''));
    for (const tag of [...new Set(list.flatMap((id) => state.entries[id]?.tags || []))].sort())
      tagFilter.add(new Option(tag, tag));
    if ([...tagFilter.options].some((option) => option.value === currentTag))
      tagFilter.value = currentTag;
    const board = state.boards.find((b) => b.id === active);
    q('#current-board-title').textContent =
      board?.title || (active === 'unsorted' ? 'Not in a board' : 'All favorites');
    q('#current-board-description').textContent = board?.description || '';
    q('.board-management').hidden = !board;
    if (board) {
      q('[data-board-pin]').textContent = board.pinned ? 'Unpin Board' : 'Pin Board';
      q('[data-board-archive]').textContent = board.archived ? 'Restore Board' : 'Archive Board';
    }
    const query = search.value.trim().toLocaleLowerCase(),
      days = Number(date.value),
      cutoff = Date.now() - days * 86400000;
    const filtered = list.filter((id) => {
      const e = state.entries[id];
      return (
        (active === 'all' || active === 'unsorted'
          ? !e?.boards.length || active === 'all'
          : e?.boards.includes(active)) &&
        (!query || matchesFavoriteQuery(id, e, query)) &&
        (!pinFilter.checked || e?.pinned) &&
        (!noteFilter.checked || !!e?.note) &&
        (stageFilter.value === 'all' || (e?.stage || 'idea') === stageFilter.value) &&
        (!tagFilter.value || e?.tags?.includes(tagFilter.value)) &&
        (date.value === 'all' || date.value === 'unknown'
          ? !e?.savedAt || date.value === 'all'
          : !!e?.savedAt && Date.parse(e.savedAt) >= cutoff)
      );
    });
    filtered.sort((a, b) =>
      sort.value === 'title' || sort.value === 'title-desc'
        ? (sort.value === 'title-desc' ? -1 : 1) *
          (state.entries[a]?.title || a).localeCompare(state.entries[b]?.title || b)
        : sort.value === 'pinned' && !!state.entries[a]?.pinned !== !!state.entries[b]?.pinned
          ? Number(!!state.entries[b]?.pinned) - Number(!!state.entries[a]?.pinned)
          : sort.value === 'updated'
            ? Date.parse(state.entries[b]?.updatedAt || state.entries[b]?.savedAt || '1970-01-01') -
              Date.parse(state.entries[a]?.updatedAt || state.entries[a]?.savedAt || '1970-01-01')
            : (sort.value === 'oldest' ? 1 : -1) *
                ((state.entries[a]?.savedAt ? Date.parse(state.entries[a].savedAt!) : 0) -
                  (state.entries[b]?.savedAt ? Date.parse(state.entries[b].savedAt!) : 0)) ||
              a.localeCompare(b),
    );
    const pageSize = Number(pageSizeControl.value) || PAGE_SIZE;
    filteredIds = filtered;
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(pages, Math.max(1, page));
    const current = page;
    visibleIds = filtered.slice((page - 1) * pageSize, page * pageSize);
    requests.cancel();
    gallery!.hidden = true;
    gallery!.setAttribute('aria-busy', 'true');
    error.hidden = true;
    missing.hidden = true;
    empty.hidden = true;
    nav.hidden = true;
    q('#favorites-bulk').hidden = !selecting;
    q('#favorites-select').setAttribute('aria-pressed', String(selecting));
    q('#favorites-select').textContent = selecting ? 'Done selecting' : 'Select designs';
    q('#favorites-selected-count').textContent = `${selected.size} selected`;
    q('#favorites-bulk-remove').hidden = !board;
    if (!filtered.length) {
      gallery!.replaceChildren();
      gallery!.setAttribute('aria-busy', 'false');
      count.textContent = list.length
        ? `${list.length} saved illustrations · No designs match this view.`
        : 'No saved illustrations.';
      empty.hidden = false;
      q('#favorites-empty-copy').textContent = board
        ? 'Add favorites to this board with “Organize”, or choose All favorites to find a saved design.'
        : query
          ? 'Try a different search or saved-date filter.'
          : 'Save an illustration you love, then organize it into a board for your next project.';
      return;
    }
    count.textContent = 'Opening your saved illustrations…';
    void requests.run(
      (signal) => repository.favoriteItems(visibleIds, signal),
      (items) => {
        const cards = items.filter((item) => item !== null);
        gallery!.replaceChildren(
          ...cards.map((item) => {
            const node = renderCard(item),
              entry = state.entries[item.id];
            const controls = make('div', '', 'favorite-card-meta');
            const pin = button(entry?.pinned ? '★ Pinned' : '☆ Pin Design');
            pin.dataset.favoritePin = item.id;
            pin.setAttribute('aria-pressed', String(!!entry?.pinned));
            pin.setAttribute('aria-label', `${entry?.pinned ? 'Unpin' : 'Pin'} ${item.title}`);
            controls.append(pin);
            const stageNames = {
              idea: 'Idea',
              shortlist: 'Shortlisted',
              ready: 'Ready to Use',
              used: 'Used in a Project',
            };
            controls.append(make('span', stageNames[entry?.stage || 'idea'], 'favorite-stage'));
            if (selecting) {
              const pick = button(selected.has(item.id) ? '✓ Selected' : 'Select design');
              pick.dataset.favoriteSelect = item.id;
              pick.setAttribute('aria-pressed', String(selected.has(item.id)));
              controls.append(pick);
              node.dataset.selected = String(selected.has(item.id));
            }
            const saved = entry?.savedAt
              ? make(
                  'time',
                  new Intl.DateTimeFormat('en-GB', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  }).format(new Date(entry.savedAt)),
                )
              : make('span', 'Earlier save · date not recorded');
            if (saved instanceof HTMLTimeElement) saved.dateTime = entry!.savedAt!;
            saved.className = 'favorite-saved-at';
            controls.append(saved);
            if (entry?.note) controls.append(make('p', entry.note, 'favorite-note'));
            if (entry?.tags?.length) {
              const tags = make('div', '', 'favorite-tags');
              for (const value of entry.tags) {
                const tag = button(value);
                tag.dataset.favoriteTag = value;
                tags.append(tag);
              }
              controls.append(tags);
            }
            const names = state.boards
              .filter((b) => entry?.boards.includes(b.id))
              .map((b) => b.title);
            if (names.length)
              controls.append(make('span', names.join(' · '), 'favorite-board-tags'));
            const organize = button('Organize');
            organize.dataset.favoriteOrganize = item.id;
            organize.setAttribute('aria-label', `Organize ${item.title}`);
            controls.append(organize);
            node.append(controls);
            return node;
          }),
        );
        // Cache only metadata for the requested saved IDs, never the full catalog.
        guarded(() => {
          const fresh = readBoards(localStorage),
            saved = ids();
          let changed = false;
          for (const item of cards)
            if (saved.includes(item.id)) {
              const e = fresh.entries[item.id] ?? { note: '', boards: [] };
              if (e.title !== item.title || e.thumb !== item.thumb) {
                fresh.entries[item.id] = { ...e, title: item.title, thumb: item.thumb };
                changed = true;
              }
            }
          if (changed) saveBoards(localStorage, fresh);
        });
        gallery!.hidden = false;
        gallery!.setAttribute('aria-busy', 'false');
        count.textContent = `${list.length} saved ${list.length === 1 ? 'illustration' : 'illustrations'} · ${filtered.length} in this view`;
        missing.hidden = cards.length === items.length;
        nav.hidden = pages <= 1;
        previous.disabled = current <= 1;
        next.disabled = current >= pages;
        q<HTMLButtonElement>('#favorites-first').disabled = current <= 1;
        q<HTMLButtonElement>('#favorites-last').disabled = current >= pages;
        q('#favorites-position').textContent = `Page ${current} of ${pages}`;
      },
      () => {
        gallery!.setAttribute('aria-busy', 'false');
        count.textContent = 'Your saved illustrations could not be loaded.';
        error.hidden = false;
      },
    );
  }
  function openBoard(id = '', preset = '') {
    const state = readBoards(localStorage),
      board = state.boards.find((b) => b.id === id);
    editingBoard = board?.id || '';
    q('#board-dialog-title').textContent = board ? 'Edit board' : 'Create a board';
    (boardForm.elements.namedItem('title') as HTMLInputElement).value = board?.title || preset;
    (boardForm.elements.namedItem('description') as HTMLTextAreaElement).value =
      board?.description || '';
    (boardForm.elements.namedItem('color') as HTMLSelectElement).value = board?.color || 'blue';
    boardForm.querySelector<HTMLElement>('.boards-form-error')!.hidden = true;
    boardDialog.showModal();
    (boardForm.elements.namedItem('title') as HTMLInputElement).focus();
  }
  function resetFilters() {
    active = 'all';
    page = 1;
    search.value = '';
    date.value = 'all';
    sort.value = 'newest';
    pinFilter.checked = false;
    noteFilter.checked = false;
    stageFilter.value = 'all';
    tagFilter.value = '';
  }
  function changeSelection(kind: 'page' | 'all' | 'invert' | 'clear') {
    if (kind === 'clear') selected.clear();
    else
      for (const id of kind === 'all' ? filteredIds : visibleIds) {
        if (kind === 'invert' && selected.has(id)) selected.delete(id);
        else selected.add(id);
      }
    render();
  }
  function updateSelected(update: (entry: import('../lib/favorite-boards').FavoriteEntry) => void) {
    if (!selected.size) {
      notify('Select at least one design first.');
      return;
    }
    const state = readBoards(localStorage),
      list = ids();
    for (const id of selected)
      if (list.includes(id)) {
        const entry = state.entries[id] ?? { note: '', boards: [] };
        update(entry);
        entry.updatedAt = new Date().toISOString();
        state.entries[id] = entry;
      }
    persist(state);
    render();
    notify(`${selected.size} selected designs updated.`);
  }
  async function copyLinks(list: string[]) {
    if (!list.length) {
      notify('There are no designs to copy in this view.');
      return;
    }
    const text = list.map((id) => `https://ultraclipart.com/art/${id}/`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      notify(`${list.length} artwork links copied. Private notes were not included.`);
    } catch {
      q<HTMLTextAreaElement>('#favorites-links-text').value = text;
      q<HTMLDialogElement>('#favorites-links-dialog').showModal();
      q<HTMLTextAreaElement>('#favorites-links-text').select();
    }
  }
  function exportCsv(list: string[]) {
    if (!list.length) {
      notify('There are no designs to export in this view.');
      return;
    }
    const url = URL.createObjectURL(
      new Blob([favoriteCsv(list, readBoards(localStorage))], { type: 'text/csv;charset=utf-8' }),
    );
    const link = make('a');
    link.href = url;
    link.download = `ultraclipart-favorites-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    notify(
      `${list.length} designs exported, including your private notes and tags. Keep this file private if needed.`,
    );
  }
  function printPage() {
    if (!visibleIds.length) {
      notify('There are no designs on this page to print.');
      return;
    }
    const popup = window.open('', '_blank');
    if (!popup) {
      notify('Allow a new tab for this site to open the printable planning sheet.');
      return;
    }
    const state = readBoards(localStorage);
    const escape = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
      );
    const title = q('#current-board-title').textContent || 'Saved Clipart';
    popup.document.write(
      `<!doctype html><html lang="en"><title>${escape(title)} — Planning Sheet</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px/1.5 system-ui;color:#193456;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}article{border:1px solid #ccd9e8;padding:16px;break-inside:avoid;border-radius:12px}img{width:100%;height:170px;object-fit:contain}p{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#1464d4;overflow-wrap:anywhere}button{padding:12px;font:inherit}@media print{button{display:none}body{margin:0}main{grid-template-columns:repeat(2,1fr)}}</style><h1>${escape(title)}</h1><p>Your private planning sheet · ${visibleIds.length} designs on this page</p><button id="print-sheet">Print or Save as PDF</button><main>${visibleIds
        .map((id) => {
          const e = state.entries[id];
          return `<article>${e?.thumb ? `<img src="${escape(e.thumb)}" alt="${escape(e.title || id)}">` : ''}<h2>${escape(e?.title || id.replaceAll('-', ' '))}</h2><p>${escape(e?.stage || 'idea')}${e?.tags?.length ? ' · ' + escape(e.tags.join(', ')) : ''}</p>${e?.note ? `<p>${escape(e.note)}</p>` : ''}<a href="https://ultraclipart.com/art/${id}/">Open Artwork</a></article>`;
        })
        .join('')}</main></html>`,
    );
    popup.document.close();
    popup.document.querySelector('#print-sheet')?.addEventListener('click', () => popup.print());
    popup.opener = null;
    notify('Printable planning sheet opened. It includes the notes shown on this page.');
  }
  function openOrganize(id: string) {
    const state = readBoards(localStorage),
      entry = state.entries[id];
    editingArt = id;
    q('#organize-artwork-title').textContent = entry?.title || id.replaceAll('-', ' ');
    const options = q('#organize-board-options');
    options.replaceChildren(make('legend', 'Save to boards'));
    if (!state.boards.length)
      options.append(
        make('p', 'Create a board from Your boards, then return here to organize this design.'),
      );
    for (const board of state.boards) {
      const label = make('label'),
        check = make('input');
      check.type = 'checkbox';
      check.name = 'boards';
      check.value = board.id;
      check.checked = entry?.boards.includes(board.id) || false;
      label.append(check, document.createTextNode(board.title));
      options.append(label);
    }
    (organizeForm.elements.namedItem('note') as HTMLTextAreaElement).value = entry?.note || '';
    (organizeForm.elements.namedItem('tags') as HTMLInputElement).value = (entry?.tags || []).join(
      ', ',
    );
    (organizeForm.elements.namedItem('stage') as HTMLSelectElement).value = entry?.stage || 'idea';
    (organizeForm.elements.namedItem('pinned') as HTMLInputElement).checked = !!entry?.pinned;
    q('#favorite-set-cover').hidden = !state.boards.some((b) => b.id === active);
    organizeForm.querySelector<HTMLElement>('.boards-form-error')!.hidden = true;
    organizeDialog.showModal();
  }
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    guarded(() => {
      if (target.closest('[data-board-create]')) openBoard();
      const preset = target.closest<HTMLElement>('[data-board-preset]');
      if (preset) openBoard('', preset.dataset.boardPreset);
      const board = target.closest<HTMLElement>('[data-board]');
      if (board) {
        active = board.dataset.board!;
        page = 1;
        selected.clear();
        render();
        document
          .querySelector<HTMLButtonElement>(`[data-board="${active}"]`)
          ?.focus({ preventScroll: true });
      }
      if (target.closest('[data-board-edit]')) openBoard(active);
      for (const [attribute, key] of [
        ['data-board-pin', 'pinned'],
        ['data-board-archive', 'archived'],
      ] as const) {
        if (target.closest(`[${attribute}]`)) {
          const state = readBoards(localStorage),
            board = state.boards.find((b) => b.id === active);
          if (board) {
            board[key] = !board[key];
            board.updatedAt = new Date().toISOString();
            persist(state);
            if (key === 'archived' && board.archived) active = 'all';
            render();
            notify(
              key === 'archived'
                ? 'Board archive updated. Saved designs were kept.'
                : 'Board pin updated.',
            );
          }
        }
      }
      if (target.closest('[data-board-duplicate]')) {
        const state = readBoards(localStorage);
        active = duplicateBoard(state, active).id;
        persist(state);
        render();
        notify('Board copied. Designs remain in the original board too.');
      }
      const smart = target.closest<HTMLElement>('[data-smart-view]');
      if (smart) {
        resetFilters();
        const view = smart.dataset.smartView;
        pinFilter.checked = view === 'pinned';
        noteFilter.checked = view === 'notes';
        if (view === 'ready') stageFilter.value = 'ready';
        q<HTMLDetailsElement>('#favorites-refine').open = view !== 'all';
        render();
        q('#current-board-title').scrollIntoView({ block: 'start' });
      }
      const pin = target.closest<HTMLElement>('[data-favorite-pin]');
      if (pin) {
        const state = readBoards(localStorage),
          id = pin.dataset.favoritePin!;
        if (ids().includes(id)) {
          const e = state.entries[id] ?? { note: '', boards: [] };
          e.pinned = !e.pinned;
          e.updatedAt = new Date().toISOString();
          state.entries[id] = e;
          persist(state);
          render();
          notify(e.pinned ? 'Design pinned.' : 'Design unpinned.');
        }
      }
      const tag = target.closest<HTMLElement>('[data-favorite-tag]');
      if (tag) {
        tagFilter.value = tag.dataset.favoriteTag!;
        page = 1;
        q<HTMLDetailsElement>('#favorites-refine').open = true;
        render();
      }
      if (target.closest('[data-board-delete]')) {
        const state = readBoards(localStorage),
          board = state.boards.find((b) => b.id === active);
        if (!board) return;
        const affected = Object.keys(state.entries).filter((id) =>
          state.entries[id].boards.includes(board.id),
        );
        removeBoard(state, board.id);
        persist(state);
        enableUndo(() => {
          const fresh = readBoards(localStorage);
          if (!fresh.boards.some((b) => b.id === board.id)) {
            fresh.boards.push(board);
            assignBoard(
              fresh,
              affected.filter((id) => ids().includes(id)),
              board.id,
            );
            persist(fresh);
          }
          render();
          notify('Board restored.');
        });
        active = 'all';
        render();
        notify('Board deleted. Your favorites are still saved. You can undo this change.');
      }
      const organize = target.closest<HTMLElement>('[data-favorite-organize]');
      if (organize) openOrganize(organize.dataset.favoriteOrganize!);
      const pick = target.closest<HTMLElement>('[data-favorite-select]');
      if (pick) {
        const id = pick.dataset.favoriteSelect!;
        selected.has(id) ? selected.delete(id) : selected.add(id);
        pick.textContent = selected.has(id) ? '✓ Selected' : 'Select design';
        pick.setAttribute('aria-pressed', String(selected.has(id)));
        const card = pick.closest<HTMLElement>('.art-card');
        if (card) card.dataset.selected = String(selected.has(id));
        q('#favorites-selected-count').textContent = `${selected.size} selected`;
      }
      if (target.closest('[data-dialog-close]'))
        target.closest<HTMLDialogElement>('dialog')?.close();
    });
  });
  boardForm.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const state = readBoards(localStorage),
        data = new FormData(boardForm),
        title = String(data.get('title') || '').trim();
      if (!title) throw Error('Please enter a board name.');
      const description = String(data.get('description') || ''),
        color = String(data.get('color')) as BoardColor;
      if (editingBoard) {
        const board = state.boards.find((b) => b.id === editingBoard);
        if (!board) throw Error('This board is no longer available.');
        Object.assign(board, {
          title: title.slice(0, 80),
          description: description.slice(0, 240),
          color,
          updatedAt: new Date().toISOString(),
        });
      } else active = createBoard(state, title, description, color).id;
      persist(state);
      boardDialog.close();
      page = 1;
      render();
      notify('Board saved.');
    } catch (e) {
      const el = boardForm.querySelector<HTMLElement>('.boards-form-error')!;
      el.textContent = e instanceof Error ? e.message : 'Board could not be saved.';
      el.hidden = false;
    }
  });
  organizeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const state = readBoards(localStorage),
        data = new FormData(organizeForm);
      if (!ids().includes(editingArt)) throw Error('This design is no longer in your favorites.');
      const entry = state.entries[editingArt] ?? { note: '', boards: [] };
      entry.note = String(data.get('note') || '')
        .trim()
        .slice(0, 500);
      entry.tags = normalizeFavoriteTags(String(data.get('tags') || ''));
      const stage = String(data.get('stage')) as FavoriteStage;
      entry.stage = FAVORITE_STAGES.includes(stage) ? stage : 'idea';
      entry.pinned = data.get('pinned') === 'on';
      entry.updatedAt = new Date().toISOString();
      entry.boards = data
        .getAll('boards')
        .map(String)
        .filter((id) => state.boards.some((b) => b.id === id));
      state.entries[editingArt] = entry;
      persist(state);
      organizeDialog.close();
      render();
      notify('Design organized.');
    } catch (e) {
      const el = organizeForm.querySelector<HTMLElement>('.boards-form-error')!;
      el.textContent = e instanceof Error ? e.message : 'Changes could not be saved.';
      el.hidden = false;
    }
  });
  q('#organize-remove').addEventListener('click', () =>
    guarded(() => {
      removeFavorites([editingArt]);
      organizeDialog.close();
    }),
  );
  q('#favorites-select').addEventListener('click', () => {
    selecting = !selecting;
    selected.clear();
    render();
  });
  q('#favorites-bulk-add').addEventListener('click', () =>
    guarded(() => {
      const destination = q<HTMLSelectElement>('#favorites-bulk-board').value;
      if (!selected.size || !destination) {
        notify('Select designs and choose a board first.');
        return;
      }
      const state = readBoards(localStorage);
      assignBoard(state, [...selected], destination);
      persist(state);
      render();
      notify('Selected designs added to the board.');
    }),
  );
  q('#favorites-bulk-remove').addEventListener('click', () =>
    guarded(() => {
      if (!selected.size) return;
      const state = readBoards(localStorage);
      assignBoard(state, [...selected], active, true);
      persist(state);
      selected.clear();
      render();
      notify('Designs removed from this board. They remain in All favorites.');
    }),
  );
  q('#favorites-bulk-delete').addEventListener('click', () =>
    guarded(() => {
      if (selected.size) removeFavorites([...selected]);
    }),
  );
  q('#boards-undo').addEventListener('click', () =>
    guarded(() => {
      const action = undo;
      undo = undefined;
      q('#boards-undo').hidden = true;
      action?.();
    }),
  );
  previous.addEventListener('click', () => {
    page--;
    render();
  });
  next.addEventListener('click', () => {
    page++;
    render();
  });
  q('#favorites-first').addEventListener('click', () => {
    page = 1;
    render();
  });
  q('#favorites-last').addEventListener('click', () => {
    page = Math.max(1, Math.ceil(filteredIds.length / Number(pageSizeControl.value)));
    render();
  });
  q('#favorites-reset').addEventListener('click', () => {
    resetFilters();
    render();
  });
  q('#favorites-select-page').addEventListener('click', () => changeSelection('page'));
  q('#favorites-select-all').addEventListener('click', () => changeSelection('all'));
  q('#favorites-invert').addEventListener('click', () => changeSelection('invert'));
  q('#favorites-clear-selection').addEventListener('click', () => changeSelection('clear'));
  q('#favorites-apply-stage').addEventListener('click', () =>
    guarded(() => {
      const value = field<HTMLSelectElement>('favorites-bulk-stage').value as FavoriteStage;
      if (FAVORITE_STAGES.includes(value))
        updateSelected((entry) => {
          entry.stage = value;
        });
    }),
  );
  q('#favorites-apply-tags').addEventListener('click', () =>
    guarded(() => {
      const tags = normalizeFavoriteTags(field<HTMLInputElement>('favorites-bulk-tags').value);
      if (!tags.length) {
        notify('Enter at least one tag first.');
        return;
      }
      updateSelected((entry) => {
        entry.tags = normalizeFavoriteTags([...(entry.tags || []), ...tags].join(','));
      });
    }),
  );
  q('#favorites-bulk-move').addEventListener('click', () =>
    guarded(() => {
      const destination = field<HTMLSelectElement>('favorites-bulk-board').value;
      const state = readBoards(localStorage);
      if (!selected.size || !state.boards.some((b) => b.id === destination)) {
        notify('Select designs and choose a destination board first.');
        return;
      }
      if (!state.boards.some((b) => b.id === active)) {
        notify(
          'Open a project board first to move designs out of it. Use Add to board from All favorites.',
        );
        return;
      }
      if (destination === active) {
        notify('Choose a different destination board.');
        return;
      }
      assignBoard(state, [...selected], destination);
      assignBoard(state, [...selected], active, true);
      persist(state);
      selected.clear();
      render();
      notify('Designs moved. Their other board memberships were kept.');
    }),
  );
  q('#favorites-copy-links').addEventListener('click', () => void copyLinks(filteredIds));
  q('#favorites-copy-selected').addEventListener('click', () => void copyLinks([...selected]));
  q('#favorites-csv').addEventListener('click', () => guarded(() => exportCsv(filteredIds)));
  q('#favorites-csv-selected').addEventListener('click', () =>
    guarded(() => exportCsv([...selected])),
  );
  q('#favorites-print').addEventListener('click', () => guarded(printPage));
  q('#favorite-set-cover').addEventListener('click', () =>
    guarded(() => {
      const state = readBoards(localStorage),
        board = state.boards.find((b) => b.id === active);
      if (board && state.entries[editingArt]?.boards.includes(active)) {
        board.coverId = editingArt;
        board.updatedAt = new Date().toISOString();
        persist(state);
        render();
        organizeDialog.close();
        notify('Board cover updated.');
      } else notify('Save this design to the current board before choosing it as the cover.');
    }),
  );
  for (const control of [
    pinFilter,
    noteFilter,
    stageFilter,
    tagFilter,
    pageSizeControl,
    density,
    showNotes,
  ])
    control.addEventListener('change', () => {
      page = 1;
      updateViewPreferences();
      render();
    });
  for (const id of ['board-search', 'board-sort', 'board-archived'])
    q('#' + id).addEventListener(id === 'board-search' ? 'input' : 'change', () => render());
  search.addEventListener('input', () => {
    page = 1;
    render();
  });
  for (const control of [sort, date])
    control.addEventListener('change', () => {
      page = 1;
      render();
    });
  q('#favorites-retry').addEventListener('click', () => {
    repository.clear();
    render();
  });
  q('#boards-export').addEventListener('click', () =>
    guarded(() => {
      const data = {
          application: 'ultraclipart-board-backup',
          version: 1,
          exportedAt: new Date().toISOString(),
          favorites: ids(),
          state: readBoards(localStorage),
        },
        url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
        ),
        link = make('a');
      link.href = url;
      link.download = `ultraclipart-boards-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      notify('Your board backup is ready. Keep it somewhere safe.');
    }),
  );
  q('#boards-import').addEventListener('click', () =>
    q<HTMLInputElement>('#boards-import-file').click(),
  );
  q<HTMLInputElement>('#boards-import-file').addEventListener('change', async (event) => {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw Error('Choose a board backup smaller than 5 MB.');
      const data = JSON.parse(await file.text());
      if (
        data?.application !== 'ultraclipart-board-backup' ||
        data.version !== 1 ||
        data.state?.schema !== 1 ||
        !Array.isArray(data.favorites)
      )
        throw Error('This is not an UltraClipart board backup.');
      const incoming = parseBoards(JSON.stringify(data.state)),
        current = readBoards(localStorage),
        list = [...new Set([...ids(), ...parseFavoriteIds(JSON.stringify(data.favorites))])];
      if (
        list.length > 10000 ||
        new Set([...current.boards.map((b) => b.id), ...incoming.boards.map((b) => b.id)]).size >
          100
      )
        throw Error('The merged collection exceeds the board or favorite limit.');
      for (const b of incoming.boards)
        if (!current.boards.some((old) => old.id === b.id)) current.boards.push(b);
      for (const id of list) {
        const a = current.entries[id],
          b = incoming.entries[id];
        if (b)
          current.entries[id] = a
            ? { ...b, ...a, boards: [...new Set([...a.boards, ...b.boards])] }
            : b;
      }
      persist(current, list);
      page = 1;
      render();
      notify('Backup imported. Your existing favorites and boards were kept.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'This backup could not be imported.');
    } finally {
      input.value = '';
    }
  });
  window.addEventListener('storage', (event) => {
    if ([FAVORITES_KEY, BOARDS_KEY].includes(event.key || '')) render();
  });
  render();
}
