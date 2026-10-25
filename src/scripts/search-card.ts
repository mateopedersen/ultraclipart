import type { SearchCard } from '../lib/search-index';
import { actionIconAssets } from '../lib/action-icons';
export function renderCard(item: SearchCard): HTMLElement {
  const article = document.createElement('article');
  article.className = 'art-card';
  article.dataset.id = item.id;
  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'share-trigger share-trigger-card';
  share.dataset.shareArt = '';
  share.dataset.shareTitle = item.title;
  share.dataset.shareUrl = `https://ultraclipart.com/art/${item.id}/`;
  share.dataset.shareImage = item.webp;
  share.setAttribute('aria-label', `Share ${item.title}`);
  share.title = 'Share this clipart';
  share.innerHTML =
    '<svg width="23" height="23" viewBox="0 0 28 28" fill="none" aria-hidden="true"><rect x="3" y="9" width="18" height="17" rx="5" fill="#e7f1ff"/><path d="M11 12 20 7M11 16l9 5" stroke="#2870c9" stroke-width="2"/><circle cx="7" cy="14" r="4" fill="#58a8ff" stroke="#1f68bb" stroke-width="1.3"/><circle cx="22" cy="5.5" r="4" fill="#9bcaff" stroke="#1f68bb" stroke-width="1.3"/><circle cx="22" cy="22" r="4" fill="#2b7ee0" stroke="#1f68bb" stroke-width="1.3"/><path d="M5.5 12.5h2M20.5 4h2M20.5 20.5h2" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>';
  article.append(share);
  const link = (label: string, href: string, className: string) => {
    const a = document.createElement('a');
    a.textContent = label;
    a.href = href;
    a.className = className;
    return a;
  };
  const detail = `/art/${item.id}/`,
    picture = link('', detail, 'art-picture'),
    image = document.createElement('img');
  image.src = item.thumb;
  image.alt = item.alt;
  image.width = 400;
  image.height = 400;
  image.loading = 'lazy';
  picture.append(image);
  const body = document.createElement('div');
  body.className = 'card-body';
  body.append(link(item.title, detail, 'card-title'));
  const formats = document.createElement('div');
  formats.className = 'formats';
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const action = (
    kind: keyof typeof actionIconAssets,
    label: string,
    href: string,
    className: string,
  ) => {
    const a = link('', href, className);
    const icon = document.createElement('img');
    icon.src = actionIconAssets[kind];
    icon.alt = '';
    icon.className = 'action-icon';
    icon.width = 28;
    icon.height = 28;
    icon.decoding = 'async';
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = label;
    a.append(icon, text);
    return a;
  };
  for (const [label, url, extension, icon] of [
    ['Image', item.webp, 'webp', 'image'],
    ['PDF', item.pdf, 'pdf', 'document'],
  ] as const) {
    if (!url) continue;
    const a = action(icon, label, url, extension);
    a.download = `${item.id}.${extension}`;
    a.dataset.downloadOpen = item.id;
    a.dataset.downloadFormat = extension;
    a.setAttribute('aria-expanded', 'false');
    a.setAttribute('aria-controls', 'download-dialog');
    a.setAttribute('aria-label', `Download ${label}: ${item.title}`);
    formats.append(a);
  }
  actions.append(
    item.editable === false
      ? action('view', 'View', detail, 'button')
      : action('edit', 'Edit', `/edit/${item.id}/`, 'button'),
  );
  body.append(formats, actions);
  article.append(picture, body);
  return article;
}
