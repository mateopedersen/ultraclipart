const root = document.querySelector<HTMLElement>('[data-studio-scenes]');
if (root) {
  const cards = [...root.querySelectorAll<HTMLButtonElement>('[data-studio-scene]')];
  const search = root.querySelector<HTMLInputElement>('#studio-scene-search')!;
  const filters = [...root.querySelectorAll<HTMLButtonElement>('[data-scene-category]')];
  const more = root.querySelector<HTMLButtonElement>('[data-scene-more]')!;
  const normalize = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLocaleLowerCase('en')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  const searchable = new Map(
    cards.map((card) => [card, normalize(card.dataset.sceneSearch || '')]),
  );
  const mobile = matchMedia('(max-width: 600px)');
  const tablet = matchMedia('(max-width: 1000px)');
  const pageSize = () => (mobile.matches ? 3 : tablet.matches ? 6 : 9);
  let limit = pageSize();
  let category = 'all';
  let matches: HTMLButtonElement[] = [];
  function render() {
    const words = normalize(search.value).split(' ').filter(Boolean);
    matches = cards.filter(
      (card) =>
        (category === 'all' || card.dataset.sceneSubject === category) &&
        words.every((word) => searchable.get(card)!.includes(word)),
    );
    const visible = new Set(matches.slice(0, limit));
    cards.forEach((card) => (card.hidden = !visible.has(card)));
    filters.forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.sceneCategory === category)),
    );
    more.hidden = matches.length <= limit;
    root!.querySelector<HTMLElement>('[data-scene-empty]')!.hidden = matches.length > 0;
    root!.querySelector('#studio-scene-count')!.textContent =
      `Showing ${visible.size} of ${matches.length} designs`;
  }
  filters.forEach((button) =>
    button.addEventListener('click', () => {
      category = button.dataset.sceneCategory!;
      limit = pageSize();
      render();
    }),
  );
  search.addEventListener('input', () => {
    limit = pageSize();
    render();
  });
  more.addEventListener('click', () => {
    const firstNewCard = matches[limit];
    limit += pageSize();
    render();
    if (firstNewCard) {
      firstNewCard.focus({ preventScroll: true });
      firstNewCard.scrollIntoView({
        block: 'nearest',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    }
  });
  const resize = () => {
    limit = Math.ceil(limit / pageSize()) * pageSize();
    render();
  };
  mobile.addEventListener('change', resize);
  tablet.addEventListener('change', resize);
  root.querySelector<HTMLElement>('[data-scene-controls]')!.hidden = false;
  render();
}
