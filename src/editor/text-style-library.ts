import { textStyles } from './text-styles';
import { textNodes } from './smart/typography';
import { identity, type TextLayer } from './model';
const NS = 'http://www.w3.org/2000/svg';
export function mountTextStyles(root: HTMLElement) {
  const grid = root.querySelector<HTMLElement>('[data-text-style-grid]');
  if (!grid) return;
  const search = root.querySelector<HTMLInputElement>('[data-text-style-search]')!;
  const category = root.querySelector<HTMLSelectElement>('[data-text-style-category]')!;
  const previous = root.querySelector<HTMLButtonElement>('[data-text-style-previous]')!;
  const next = root.querySelector<HTMLButtonElement>('[data-text-style-next]')!;
  const count = root.querySelector<HTMLElement>('[data-text-style-count]')!;
  let page = 0;
  function render() {
    const term = search.value.trim().toLowerCase();
    const list = textStyles.filter(
      (s) =>
        (!category.value || s.category === category.value) &&
        `${s.name} ${s.category}`.toLowerCase().includes(term),
    );
    page = Math.min(page, Math.max(0, Math.ceil(list.length / 12) - 1));
    const start = page * 12;
    grid!.replaceChildren(
      ...list.slice(start, start + 12).map((style) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.textPreset = style.id;
        button.setAttribute('aria-label', `Choose ${style.name} text style`);
        button.setAttribute('aria-pressed', String(root.dataset.textStyle === style.id));
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '-20 -90 560 230');
        svg.setAttribute('aria-hidden', 'true');
        const layer: TextLayer = {
          kind: 'text',
          id: 'preview',
          label: style.name,
          ...identity(),
          visible: true,
          locked: false,
          opacity: 1,
          text: style.text,
          size: style.size,
          color: style.color,
          bold: style.bold,
          align: 'middle',
          typography: style.type,
        };
        const group = document.createElementNS(NS, 'g');
        group.append(...textNodes(layer));
        svg.append(group);
        const label = document.createElement('span');
        label.textContent = style.name;
        button.append(svg, label);
        return button;
      }),
    );
    count.textContent = list.length
      ? `${start + 1}–${Math.min(start + 12, list.length)} of ${list.length} styles`
      : 'No matching styles. Try another search.';
    previous.disabled = !page;
    next.disabled = start + 12 >= list.length;
    // Measure with the real text renderer once tiles are visible, including curved text.
    requestAnimationFrame(fit);
  }
  function fit() {
    if (!grid!.getClientRects().length) return;
    for (const svg of grid!.querySelectorAll<SVGSVGElement>('svg')) {
      const b = svg.querySelector<SVGGElement>('g')!.getBBox();
      if (b.width > 0 && b.height > 0)
        svg.setAttribute('viewBox', `${b.x - 18} ${b.y - 18} ${b.width + 36} ${b.height + 36}`);
    }
  }
  search.addEventListener('input', () => {
    page = 0;
    render();
  });
  category.addEventListener('change', () => {
    page = 0;
    render();
  });
  previous.addEventListener('click', () => {
    page--;
    render();
    previous.focus();
  });
  next.addEventListener('click', () => {
    page++;
    render();
    next.focus();
  });
  new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) fit();
  }).observe(grid);
  void document.fonts.ready.then(fit);
  render();
}
