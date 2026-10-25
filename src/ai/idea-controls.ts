import { examples, featuredIngredientIds, ideaCategories, type ClipartIdea } from './ideas';

const normalize = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export function markSelectedIdea(root: HTMLElement, id = '') {
  root
    .querySelectorAll<HTMLElement>('[data-ai-example]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.aiExample === id)),
    );
}

/** Only edits the draft. Selecting or browsing examples never requests inference. */
export function mountIdeaLibrary(
  root: HTMLElement,
  useIdea: (idea: ClipartIdea) => void,
  isBusy: () => boolean,
) {
  const cards = [...root.querySelectorAll<HTMLElement>('[data-ai-idea-card]')];
  const search = root.querySelector<HTMLInputElement>('#ai-idea-search')!;
  const filters = [...root.querySelectorAll<HTMLButtonElement>('[data-ai-idea-filter]')];
  const previous = root.querySelector<HTMLButtonElement>('[data-ai-idea-page="previous"]')!;
  const next = root.querySelector<HTMLButtonElement>('[data-ai-idea-page="next"]')!;
  const byId = new Map(examples.map((idea) => [idea.id, idea]));
  const categoryNames = new Map<string, string>(ideaCategories);
  const searchable = new Map(
    cards.map((card) => {
      const idea = byId.get(card.dataset.aiIdeaCard!);
      return [
        card,
        normalize(
          idea
            ? `${idea.label} ${idea.prompt} ${categoryNames.get(idea.category)} ${idea.style}`
            : '',
        ),
      ];
    }),
  );
  let category = 'all';
  let page = 0;
  const smallScreen = window.matchMedia('(max-width: 600px)');
  let pageSize = smallScreen.matches ? 4 : 8;
  function render() {
    const words = normalize(search.value).split(' ').filter(Boolean);
    const matches = cards.filter(
      (card) =>
        (category === 'all' || card.dataset.category === category) &&
        words.every((word) => searchable.get(card)!.includes(word)),
    );
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    page = Math.max(0, Math.min(page, pages - 1));
    const visible = new Set(matches.slice(page * pageSize, (page + 1) * pageSize));
    cards.forEach((card) => {
      card.hidden = !visible.has(card);
    });
    filters.forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.aiIdeaFilter === category)),
    );
    root.querySelector('#ai-idea-count')!.textContent = matches.length
      ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, matches.length)} of ${matches.length} Ideas`
      : '0 Ideas';
    root.querySelector('#ai-idea-page-label')!.textContent = `Page ${page + 1} of ${pages}`;
    root.querySelector<HTMLElement>('#ai-idea-empty')!.hidden = matches.length > 0;
    previous.disabled = page === 0;
    next.disabled = page >= pages - 1;
  }
  smallScreen.addEventListener('change', () => {
    const first = page * pageSize;
    pageSize = smallScreen.matches ? 4 : 8;
    page = Math.floor(first / pageSize);
    render();
  });
  filters.forEach((button) =>
    button.addEventListener('click', () => {
      category = button.dataset.aiIdeaFilter!;
      page = 0;
      render();
    }),
  );
  search.addEventListener('input', () => {
    page = 0;
    render();
  });
  for (const [button, direction] of [
    [previous, -1],
    [next, 1],
  ] as const)
    button.addEventListener('click', () => {
      page += direction;
      render();
      root
        .querySelector('#ai-idea-search')
        ?.scrollIntoView({ block: 'start', behavior: 'instant' });
      // When this control becomes disabled at an endpoint, keep keyboard focus in pagination.
      if (button.disabled) (direction === 1 ? previous : next).focus({ preventScroll: true });
    });
  root.querySelectorAll<HTMLButtonElement>('[data-ai-example]').forEach((button) =>
    button.addEventListener('click', () => {
      const idea = byId.get(button.dataset.aiExample!);
      if (isBusy() || !idea) return;
      useIdea(idea);
    }),
  );
  render();
}

export function mountIngredientChoices(
  root: HTMLElement,
  selected: Set<string>,
  changed: () => void,
  isBusy: () => boolean,
) {
  const choices = [...root.querySelectorAll<HTMLButtonElement>('[data-ai-ingredient-category]')];
  const byId = new Map(examples.map((idea) => [idea.id, idea]));
  const categories = root.querySelector<HTMLSelectElement>('#ai-ingredient-category')!;
  const chips = root.querySelector<HTMLElement>('#ai-selected-ingredients')!;
  const custom = root.querySelector<HTMLInputElement>('#ai-ingredient-custom')!;
  const feedback = root.querySelector<HTMLElement>('#ai-ingredient-feedback')!;
  const customToggle = root.querySelector<HTMLButtonElement>('[data-ai-ingredient="custom"]')!;
  const customPanel = root.querySelector<HTMLElement>('#ai-custom-ingredient-panel')!;
  const has = (value: string) => [...selected].some((item) => normalize(item) === normalize(value));
  function refresh() {
    choices.forEach((button) =>
      button.setAttribute(
        'aria-pressed',
        String(has(byId.get(button.dataset.aiIngredient!)?.ingredient || '')),
      ),
    );
    chips.replaceChildren();
    [...selected].forEach((value, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.aiRemoveIngredient = '';
      button.textContent = `${value} ×`;
      button.setAttribute('aria-label', `Remove detail: ${value}`);
      button.disabled = isBusy();
      button.addEventListener('click', () => {
        if (isBusy()) return;
        selected.delete(value);
        refresh();
        changed();
        (
          chips.querySelectorAll<HTMLButtonElement>('button')[Math.min(index, selected.size - 1)] ||
          customToggle
        ).focus({ preventScroll: true });
      });
      chips.append(button);
    });
    feedback.textContent = selected.size
      ? `${selected.size} of 8 details selected. Remove any detail using its × button.`
      : '';
  }
  function add(value: string) {
    if (!value) {
      feedback.textContent = 'Write a subject or a detail first.';
      return false;
    }
    if (has(value)) {
      feedback.textContent = 'That detail is already selected.';
      return false;
    }
    if (selected.size >= 8) {
      feedback.textContent = 'Eight details are selected. Remove one before adding another.';
      return false;
    }
    selected.add(value);
    refresh();
    changed();
    return true;
  }
  categories.addEventListener('change', () =>
    choices.forEach((button) => {
      button.hidden =
        categories.value === 'featured'
          ? !featuredIngredientIds.includes(button.dataset.aiIngredient!)
          : button.dataset.aiIngredientCategory !== categories.value;
    }),
  );
  choices.forEach((button) =>
    button.addEventListener('click', () => {
      if (isBusy()) return;
      const value = byId.get(button.dataset.aiIngredient!)?.ingredient;
      if (!value) return;
      const stored = [...selected].find((item) => normalize(item) === normalize(value));
      if (stored && selected.delete(stored)) {
        refresh();
        changed();
      } else add(value);
    }),
  );
  customToggle.addEventListener('click', () => {
    if (isBusy()) return;
    customPanel.hidden = !customPanel.hidden;
    customToggle.setAttribute('aria-expanded', String(!customPanel.hidden));
    if (!customPanel.hidden) custom.focus();
  });
  function addCustom() {
    if (isBusy()) return;
    if (add(custom.value.trim().slice(0, 80))) {
      custom.value = '';
      custom.focus();
    }
  }
  root.querySelector('[data-ai-add-ingredient]')?.addEventListener('click', addCustom);
  custom.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCustom();
    }
    if (event.key === 'Escape') {
      customPanel.hidden = true;
      customToggle.setAttribute('aria-expanded', 'false');
      customToggle.focus();
    }
  });
  refresh();
  return {
    refresh,
    reset() {
      custom.value = '';
      customPanel.hidden = true;
      customToggle.setAttribute('aria-expanded', 'false');
      refresh();
    },
  };
}
