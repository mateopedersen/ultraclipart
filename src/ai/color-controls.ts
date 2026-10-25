import { builderColors, normalizeBuilderColor } from './colors';

/** Color choices edit the draft only; they never request generation or recolor a result. */
export function mountBuilderColors(
  root: HTMLElement,
  selected: Set<string>,
  changed: () => void,
  isBusy: () => boolean,
) {
  const swatches = [...root.querySelectorAll<HTMLButtonElement>('[data-ai-swatch]')];
  const picker = root.querySelector<HTMLInputElement>('#ai-custom-color')!;
  const hex = root.querySelector<HTMLInputElement>('#ai-custom-color-hex')!;
  const add = root.querySelector<HTMLButtonElement>('[data-ai-add-color]')!;
  const clear = root.querySelector<HTMLButtonElement>('[data-ai-clear-colors]')!;
  const chips = root.querySelector<HTMLElement>('#ai-selected-colors')!;
  const feedback = root.querySelector<HTMLElement>('#ai-color-feedback')!;
  let committed = picker.value;
  function render() {
    swatches.forEach((button) =>
      button.setAttribute('aria-pressed', String(selected.has(button.dataset.aiSwatch!))),
    );
    chips.replaceChildren();
    for (const value of selected) {
      const button = document.createElement('button');
      const name = builderColors.find(([color]) => color === value)?.[1] || value.toUpperCase();
      button.type = 'button';
      button.dataset.aiRemoveColor = value;
      button.style.setProperty('--swatch', value);
      button.setAttribute('aria-label', `Remove ${name} color`);
      const dot = document.createElement('i');
      dot.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = value.toUpperCase();
      const remove = document.createElement('span');
      remove.textContent = '×';
      remove.setAttribute('aria-hidden', 'true');
      button.append(dot, label, remove);
      button.disabled = isBusy();
      chips.append(button);
    }
    clear.disabled = isBusy() || selected.size === 0;
    root.querySelector('#ai-color-count')!.textContent = `${selected.size} / 5 selected`;
  }
  function commit(value: string) {
    if (isBusy()) return;
    if (selected.has(value)) selected.delete(value);
    else {
      if (selected.size >= 5) {
        feedback.textContent = 'Choose up to five accent colors. Remove one to add another.';
        return;
      }
      selected.add(value);
      // Explicit colors must not be contradicted by an earlier monochrome palette.
      root.querySelector<HTMLSelectElement>('#ai-palette')!.value = 'prompt';
    }
    feedback.textContent = '';
    render();
    changed();
  }
  swatches.forEach((button) =>
    button.addEventListener('click', () => commit(button.dataset.aiSwatch!)),
  );
  picker.addEventListener('input', () => {
    committed = picker.value;
    hex.value = committed.toUpperCase();
    hex.removeAttribute('aria-invalid');
    feedback.textContent = '';
  });
  hex.addEventListener('input', () => {
    const value = normalizeBuilderColor(hex.value);
    if (value) picker.value = value;
    hex.removeAttribute('aria-invalid');
    feedback.textContent = '';
  });
  hex.addEventListener('blur', () => {
    const value = normalizeBuilderColor(hex.value);
    if (value) {
      committed = value;
      hex.value = value.toUpperCase();
      picker.value = value;
    }
  });
  function addCustom() {
    if (isBusy()) return;
    const value = normalizeBuilderColor(hex.value);
    if (!value) {
      hex.setAttribute('aria-invalid', 'true');
      feedback.textContent = 'Enter a 3- or 6-digit HEX color, for example #1769D5.';
      hex.focus();
      return;
    }
    committed = value;
    picker.value = value;
    hex.value = value.toUpperCase();
    if (selected.has(value)) {
      feedback.textContent = 'This color is already selected.';
      return;
    }
    commit(value);
  }
  add.addEventListener('click', addCustom);
  hex.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCustom();
    } else if (event.key === 'Escape') {
      hex.value = committed.toUpperCase();
      picker.value = committed;
      hex.removeAttribute('aria-invalid');
      feedback.textContent = '';
    }
  });
  chips.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-ai-remove-color]')
        : null;
    if (!button || isBusy()) return;
    const value = button.dataset.aiRemoveColor!;
    const siblings = [...chips.querySelectorAll<HTMLButtonElement>('button')];
    const index = siblings.indexOf(button);
    selected.delete(value);
    render();
    const next =
      chips.querySelectorAll<HTMLButtonElement>('button')[index] ||
      chips.querySelector<HTMLButtonElement>('button');
    (next || swatches.find((swatch) => swatch.dataset.aiSwatch === value) || add).focus();
    changed();
  });
  clear.addEventListener('click', () => {
    if (isBusy()) return;
    selected.clear();
    feedback.textContent = '';
    render();
    swatches[0]?.focus();
    changed();
  });
  root.querySelector('#ai-palette')?.addEventListener('change', () => {
    if (root.querySelector<HTMLSelectElement>('#ai-palette')!.value === 'monochrome') {
      selected.clear();
      render();
      changed();
    }
  });
  render();
  return {
    refresh() {
      [
        ...swatches,
        picker,
        hex,
        add,
        ...chips.querySelectorAll<HTMLButtonElement>('button'),
      ].forEach((control) => (control.disabled = isBusy()));
      clear.disabled = isBusy() || selected.size === 0;
    },
    reset() {
      feedback.textContent = '';
      hex.removeAttribute('aria-invalid');
      render();
    },
  };
}
