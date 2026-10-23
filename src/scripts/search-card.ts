import type { SearchCard } from '../lib/search-index';
export function renderCard(item: SearchCard): HTMLElement {
  const article = document.createElement('article');
  article.className = 'art-card';
  article.dataset.id = item.id;
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
  for (const [name, url] of [
    ['WEBP', item.webp],
    ['PDF', item.pdf],
  ])
    if (url) {
      const a = link(name!, url, name!.toLowerCase());
      a.download = '';
      formats.append(a);
    }
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  actions.append(
    link('✎ Edit', `/edit/${item.id}/`, 'button'),
    link('↓ Download', detail, 'button primary'),
  );
  body.append(formats, actions);
  article.append(picture, body);
  return article;
}
