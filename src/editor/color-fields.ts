/** One color input contract for backgrounds, text, vectors and raster regions. */
export function normalizeHex(value: string): string | null {
  const raw = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw))
    return (
      '#' +
      [...raw]
        .map((c) => c + c)
        .join('')
        .toLowerCase()
    );
  return /^[0-9a-f]{6}$/i.test(raw) ? '#' + raw.toLowerCase() : null;
}
export function mountColorFields(root: HTMLElement) {
  const fields: {
    picker: HTMLInputElement;
    hex: HTMLInputElement;
    error: HTMLElement;
    sync: () => void;
  }[] = [];
  for (const picker of root.querySelectorAll<HTMLInputElement>('input[type="color"]')) {
    const oldLabel = picker.closest('label');
    if (!oldLabel || picker.closest('.uc-color-field')) continue;
    const name = oldLabel.textContent?.trim() || 'Color';
    const holder = document.createElement('div');
    holder.className = 'uc-color-control';
    const label = document.createElement('label');
    const id = picker.id || `uc-color-${crypto.randomUUID()}`;
    picker.id = id;
    label.htmlFor = id;
    label.textContent = name;
    const row = document.createElement('div');
    row.className = 'uc-color-field';
    const existing = picker.matches('[data-color]')
      ? root.querySelector<HTMLInputElement>('[data-hex]')
      : null;
    const hex = existing || document.createElement('input');
    if (existing) existing.closest('label')?.remove();
    hex.type = 'text';
    hex.className = 'uc-color-hex';
    hex.maxLength = 7;
    hex.placeholder = '#326ACB';
    hex.pattern = '#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})';
    hex.autocomplete = 'off';
    hex.spellcheck = false;
    hex.setAttribute('aria-label', `${name} HEX code`);
    const error = document.createElement('small');
    error.className = 'uc-color-error';
    error.id = `${id}-error`;
    error.textContent = 'Enter a HEX color such as #326ACB or #ABC.';
    error.hidden = true;
    error.setAttribute('role', 'status');
    hex.setAttribute('aria-describedby', error.id);
    oldLabel.replaceWith(holder);
    row.append(picker, hex);
    holder.append(label, row, error);
    let committed = picker.value;
    const sync = () => {
      hex.disabled = picker.matches(':disabled');
      if (document.activeElement !== hex) {
        hex.value = picker.value.toUpperCase();
        hex.removeAttribute('aria-invalid');
        error.hidden = true;
        committed = picker.value;
      }
    };
    const apply = (commit: boolean) => {
      const color = normalizeHex(hex.value);
      if (!color) {
        if (commit) {
          const invalid = hex.value;
          picker.value = committed;
          picker.dispatchEvent(new Event('input', { bubbles: true }));
          hex.value = invalid;
          error.hidden = false;
          hex.setAttribute('aria-invalid', 'true');
        }
        return;
      }
      error.hidden = true;
      hex.removeAttribute('aria-invalid');
      picker.value = color;
      picker.dispatchEvent(new Event('input', { bubbles: true }));
      if (commit && color !== committed) {
        committed = color;
        hex.value = color.toUpperCase();
        picker.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };
    hex.addEventListener('input', () => apply(false));
    hex.addEventListener('change', () => apply(true));
    hex.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        apply(true);
      }
      if (event.key === 'Escape') {
        picker.value = committed;
        picker.dispatchEvent(new Event('input', { bubbles: true }));
        hex.value = committed.toUpperCase();
        error.hidden = true;
        hex.removeAttribute('aria-invalid');
      }
    });
    picker.addEventListener('input', sync);
    picker.addEventListener('change', sync);
    fields.push({ picker, hex, error, sync });
    sync();
  }
  root.addEventListener('uc:color-sync', () => fields.forEach((field) => field.sync()));
  return {
    sync() {
      for (const field of fields) field.sync();
    },
  };
}
