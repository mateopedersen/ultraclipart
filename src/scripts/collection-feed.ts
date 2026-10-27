const grid = document.querySelector<HTMLElement>('#latest-collections');
if (grid) {
  let busy = false;
  const safePath = (value: unknown) =>
    typeof value === 'string' && /^\/clipart\/[a-z0-9-]+\/$/.test(value) && !value.includes('..');
  const safeImage = (value: unknown) => {
    if (typeof value !== 'string') return false;
    try {
      const url = new URL(value, location.origin);
      return (
        [location.origin, 'https://assets.ultraclipart.com'].includes(url.origin) &&
        !url.pathname.includes('..')
      );
    } catch {
      return false;
    }
  };
  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const response = await fetch('/collection-feed.json', { cache: 'no-store' });
      if (!response.ok) return;
      const feed = await response.json();
      if (
        typeof feed.version !== 'string' ||
        feed.version === grid!.dataset.version ||
        !Array.isArray(feed.items) ||
        feed.items.length > 8
      )
        return;
      const fragment = document.createDocumentFragment();
      for (const item of feed.items) {
        if (
          !safePath(item.href) ||
          !safeImage(item.sample?.thumb) ||
          typeof item.name !== 'string' ||
          typeof item.sample?.alt !== 'string' ||
          typeof item.sample?.title !== 'string' ||
          !Number.isInteger(item.count) ||
          item.count < 1
        )
          return;
        const link = document.createElement('a');
        link.className = 'subject-collection-tile';
        link.href = item.href;
        const media = document.createElement('div');
        media.className = 'subject-collection-art';
        const img = document.createElement('img');
        img.src = item.sample.thumb;
        img.alt = item.sample.alt;
        img.title = item.sample.title;
        img.width = 275;
        img.height = 190;
        img.loading = 'lazy';
        img.decoding = 'async';
        media.append(img);
        const copy = document.createElement('div');
        copy.className = 'subject-collection-copy';
        const title = document.createElement('h3');
        title.textContent = item.name;
        const count = document.createElement('p');
        count.textContent = `${item.count.toLocaleString('en-US')} Illustrations`;
        const arrow = document.createElement('span');
        arrow.textContent = '→';
        arrow.setAttribute('aria-hidden', 'true');
        copy.append(title, count, arrow);
        link.append(media, copy);
        fragment.append(link);
      }
      if (!fragment.childElementCount) return;
      grid!.replaceChildren(fragment);
      grid!.dataset.version = feed.version;
      document.querySelector('#collection-feed-status')!.textContent =
        'The collection list has been updated.';
    } catch {
      /* Keep the complete server-rendered list on connection failure. */
    } finally {
      busy = false;
    }
  }
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', refresh);
  setInterval(refresh, 60000);
}
export {};
