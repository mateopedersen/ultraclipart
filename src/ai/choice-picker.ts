type Entry = {
  select: HTMLSelectElement;
  trigger: HTMLButtonElement;
  text: HTMLElement;
  image: HTMLImageElement;
  title: string;
};
const titles: Record<string, string> = {
  'ai-ingredient-category': 'Choose a Category',
  'ai-style': 'Illustration Style',
  'ai-composition': 'Composition',
  'ai-palette': 'Color Palette',
  'ai-detail': 'Level of Detail',
  'ai-outline': 'Outline',
  'ai-margin': 'Space Around the Subject',
  'ai-concept-count': 'Recent Artwork',
  'ai-pdf-paper': 'PDF Paper Size',
};
const normalize = (text: string) =>
  text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en').trim();

/** Enhance the real select values without replacing the Builder's settings contract. */
export function mountChoicePickers(root: HTMLElement, isBusy: () => boolean) {
  const dialog = root.querySelector<HTMLDialogElement>('#ai-choice-dialog');
  const fallback = {
    refresh() {},
    open(select: HTMLSelectElement, _opener?: HTMLElement) {
      const section = select.closest('details');
      if (section) section.open = true;
      select.focus({ preventScroll: true });
      select.scrollIntoView({ block: 'nearest' });
    },
  };
  if (!dialog || typeof dialog.showModal !== 'function') return fallback;
  const title = dialog.querySelector<HTMLElement>('#ai-choice-title')!;
  const description = dialog.querySelector<HTMLElement>('#ai-choice-description')!;
  const search = dialog.querySelector<HTMLInputElement>('#ai-choice-search')!;
  const searchPanel = dialog.querySelector<HTMLElement>('[data-ai-choice-search-panel]')!;
  const options = dialog.querySelector<HTMLElement>('[data-ai-choice-options]')!;
  const empty = dialog.querySelector<HTMLElement>('[data-ai-choice-empty]')!;
  const count = dialog.querySelector<HTMLElement>('[data-ai-choice-count]')!;
  const entries = new Map<HTMLSelectElement, Entry>();
  let active: Entry | undefined;
  let returnFocus: HTMLElement | undefined;
  let unlock: (() => void) | undefined;

  function viewport() {
    const view = window.visualViewport;
    dialog!.style.setProperty('--ai-choice-height', `${view?.height ?? window.innerHeight}px`);
    dialog!.style.setProperty('--ai-choice-top', `${view?.offsetTop ?? 0}px`);
    dialog!.style.setProperty(
      '--ai-choice-bottom',
      `${Math.max(0, window.innerHeight - (view?.height ?? window.innerHeight) - (view?.offsetTop ?? 0))}px`,
    );
  }
  function lockScroll() {
    const body = document.body;
    const html = document.documentElement;
    const x = window.scrollX,
      y = window.scrollY;
    const saved = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      overflow: html.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `${-y}px`;
    body.style.left = `${-x}px`;
    body.style.width = '100%';
    html.style.overflow = 'hidden';
    unlock = () => {
      body.style.position = saved.position;
      body.style.top = saved.top;
      body.style.left = saved.left;
      body.style.width = saved.width;
      html.style.overflow = saved.overflow;
      window.scrollTo({ left: x, top: y, behavior: 'instant' });
    };
  }
  function refresh() {
    for (const entry of entries.values()) {
      const selected = entry.select.selectedOptions[0];
      entry.text.textContent = selected?.label.trim() || 'Choose an Option';
      const src = selected?.dataset.aiChoiceImage;
      entry.image.hidden = !src;
      entry.image.alt = selected?.dataset.aiChoiceAlt || '';
      entry.image.title = selected?.dataset.aiChoiceTitle || '';
      if (src && entry.image.getAttribute('src') !== src) entry.image.src = src;
      entry.trigger.setAttribute('aria-label', `${entry.title}: ${entry.text.textContent}`);
      entry.trigger.disabled = entry.select.disabled || isBusy();
    }
    if (isBusy() && dialog!.open) dialog!.close();
  }
  function render() {
    if (!active) return;
    const words = normalize(search.value).split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const button of options.querySelectorAll<HTMLButtonElement>('[data-ai-choice-value]')) {
      button.hidden = !words.every((word) => button.dataset.search!.includes(word));
      if (!button.hidden) visible++;
    }
    empty.hidden = visible > 0;
    count.textContent = `${visible} ${visible === 1 ? 'Option' : 'Options'}`;
  }
  function open(select: HTMLSelectElement, opener?: HTMLElement) {
    const entry = entries.get(select);
    if (!entry || select.disabled || isBusy() || dialog!.open) return;
    active = entry;
    returnFocus = opener ?? entry.trigger;
    title.textContent = entry.title;
    const hasImages = [...select.options].some((option) => option.dataset.aiChoiceImage);
    description.textContent = hasImages
      ? 'Choose a reference to apply this setting to your idea.'
      : 'Choose the setting you want to use.';
    dialog!.dataset.layout = hasImages ? 'gallery' : 'list';
    search.value = '';
    search.placeholder =
      select.id === 'ai-ingredient-category' ? 'Find a category…' : 'Find a style…';
    searchPanel.hidden = select.options.length < 8;
    const fragment = document.createDocumentFragment();
    for (const option of select.options) {
      if (option.hidden) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ai-choice-option';
      button.dataset.aiChoiceValue = option.value;
      button.dataset.search = normalize(`${option.label} ${option.dataset.aiChoiceDetail || ''}`);
      button.disabled = option.disabled;
      button.setAttribute('aria-pressed', String(option.selected));
      if (option.dataset.aiChoiceImage) {
        const image = document.createElement('img');
        image.src = option.dataset.aiChoiceImage;
        image.alt = option.dataset.aiChoiceAlt || '';
        image.title = option.dataset.aiChoiceTitle || '';
        image.width = 72;
        image.height = 72;
        image.loading = 'lazy';
        image.decoding = 'async';
        button.append(image);
      }
      const copy = document.createElement('span');
      copy.className = 'ai-choice-option-copy';
      const label = document.createElement('strong');
      label.textContent = option.label.trim();
      copy.append(label);
      if (option.dataset.aiChoiceDetail) {
        const detail = document.createElement('span');
        detail.textContent = option.dataset.aiChoiceDetail;
        copy.append(detail);
      }
      const check = document.createElement('span');
      check.className = 'ai-choice-check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';
      button.append(copy, check);
      button.addEventListener('click', () => {
        if (select.disabled || option.disabled || isBusy()) return;
        select.value = option.value;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        refresh();
        dialog!.close();
      });
      fragment.append(button);
    }
    options.replaceChildren(fragment);
    render();
    viewport();
    try {
      dialog!.showModal();
    } catch {
      active = undefined;
      select.hidden = false;
      entry.trigger.hidden = true;
      select.focus();
      return;
    }
    entry.trigger.setAttribute('aria-expanded', 'true');
    lockScroll();
    window.addEventListener('resize', viewport);
    window.visualViewport?.addEventListener('resize', viewport);
    window.visualViewport?.addEventListener('scroll', viewport);
    const selected = options.querySelector<HTMLButtonElement>(
      '[aria-pressed="true"]:not(:disabled)',
    );
    selected?.focus({ preventScroll: true });
    selected?.scrollIntoView({ block: 'nearest' });
  }
  for (const select of root.querySelectorAll<HTMLSelectElement>('select')) {
    if (!titles[select.id]) continue;
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-select-control';
    wrapper.dataset.aiSelect = select.id;
    select.before(wrapper);
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = `${select.id}-trigger`;
    trigger.className = 'ai-select-trigger';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialog.id);
    trigger.setAttribute('aria-expanded', 'false');
    const image = document.createElement('img');
    image.alt = '';
    image.width = 36;
    image.height = 36;
    image.hidden = true;
    const text = document.createElement('span');
    text.className = 'ai-select-value';
    const chevron = document.createElement('span');
    chevron.className = 'ai-select-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    trigger.append(image, text, chevron);
    wrapper.append(select, trigger);
    entries.set(select, { select, trigger, image, text, title: titles[select.id] });
    select.hidden = true;
    trigger.addEventListener('click', () => open(select, trigger));
    select.addEventListener('change', refresh);
    for (const label of select.labels ?? [])
      label.addEventListener('click', (event) => {
        if (!select.hidden) return;
        event.preventDefault();
        if (!trigger.disabled) {
          const section = select.closest('details');
          if (section) section.open = true;
          trigger.click();
        }
      });
  }
  search.addEventListener('input', render);
  dialog.querySelector('[data-ai-choice-close]')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
      dialog.close();
  });
  options.addEventListener('keydown', (event) => {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const buttons = [
      ...options.querySelectorAll<HTMLButtonElement>('button:not([hidden]):not(:disabled)'),
    ];
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : Math.max(
              0,
              Math.min(
                buttons.length - 1,
                index + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1),
              ),
            );
    event.preventDefault();
    buttons[next].focus();
  });
  dialog.addEventListener('close', () => {
    active?.trigger.setAttribute('aria-expanded', 'false');
    active = undefined;
    window.removeEventListener('resize', viewport);
    window.visualViewport?.removeEventListener('resize', viewport);
    window.visualViewport?.removeEventListener('scroll', viewport);
    unlock?.();
    unlock = undefined;
    if (returnFocus?.isConnected && !returnFocus.hidden) returnFocus.focus({ preventScroll: true });
  });
  root.querySelector('form')?.addEventListener('reset', () => window.setTimeout(refresh, 0));
  refresh();
  return { refresh, open };
}
