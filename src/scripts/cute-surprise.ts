import {
  pickCute,
  validCuteIndex,
  SURPRISE_INDEX_VERSION,
  type CutePick,
} from '../lib/cute-discovery';
const key = 'ultraclipart-surprise-recent-v2';
export function initCuteSurprise() {
  const link = document.querySelector<HTMLAnchorElement>('[data-surprise-art]');
  if (!link) return;
  let pool: CutePick[] = [];
  try {
    pool = validCuteIndex(JSON.parse(link.dataset.surpriseArt || '[]'));
  } catch {
    /* Real cute href remains usable. */
  }
  let recent: string[] = [];
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || '[]');
    if (Array.isArray(saved))
      recent = saved.filter((x) => typeof x === 'string' && /^[a-z0-9-]+$/.test(x)).slice(0, 12);
  } catch {
    /* Storage is optional. */
  }
  const current = location.pathname.match(/^\/art\/([a-z0-9-]+)\/$/)?.[1] || '';
  let chosen = link.pathname.match(/^\/art\/([a-z0-9-]+)\/$/)?.[1] || '';
  let committed = false;
  const random = () => {
    try {
      return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    } catch {
      return Math.random();
    }
  };
  const choose = () => {
    if (committed) return;
    const next = pickCute(pool, recent, current, random);
    if (next) {
      chosen = next.id;
      link.href = `/art/${chosen}/`;
    }
  };
  let loading: Promise<void> | undefined;
  const load = () =>
    (loading ??= (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        const response = await fetch(link.dataset.surpriseSource!, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data.version !== SURPRISE_INDEX_VERSION) return;
        const loaded = validCuteIndex(data.items);
        if (loaded.length) pool = loaded;
      } catch {
        /* Offline and failed requests retain the eligible fallback pool. */
      } finally {
        clearTimeout(timeout);
      }
    })());
  const prepare = () => {
    committed = false;
    choose();
    void load().then(choose);
  };
  link.addEventListener('pointerenter', prepare);
  link.addEventListener('focus', prepare);
  const remember = () => {
    if (!chosen) return;
    recent = [chosen, ...recent.filter((x) => x !== chosen)].slice(0, 12);
    try {
      sessionStorage.setItem(key, JSON.stringify(recent));
    } catch {
      /* In-memory state still works. */
    }
  };
  link.addEventListener('click', () => {
    if (committed) {
      committed = false;
      choose();
    }
    if (!chosen) choose();
    committed = true;
    remember();
  });
  link.addEventListener('auxclick', (event) => {
    if (event.button === 1) remember();
  });
  choose();
}
