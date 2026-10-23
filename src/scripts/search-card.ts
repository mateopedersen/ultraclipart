import type { SearchCard } from '../lib/search-index';
import { actionIcons } from '../lib/action-icons';
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
  const action = (
    kind: keyof typeof actionIcons,
    label: string,
    href: string,
    className: string,
  ) => {
    const a = link('', href, className);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [name, value] of Object.entries({
      width: '16',
      height: '16',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.7',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    }))
      svg.setAttribute(name, value);
    for (const d of actionIcons[kind]) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    const text = document.createElement('span');
    text.textContent = label;
    a.append(svg, text);
    return a;
  };
  actions.append(
    action('edit', 'Edit', `/edit/${item.id}/`, 'button'),
    action('download', 'Download', detail, 'button primary'),
  );
  body.append(formats, actions);
  article.append(picture, body);
  return article;
}
