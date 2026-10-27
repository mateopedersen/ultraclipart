/** Compact, keyboard-accessible inspector navigation shared by all editor modes. */
export function mountInspector(root: HTMLElement) {
  const inspector = root.querySelector<HTMLElement>('.uc-properties')!;
  const body = inspector.querySelector<HTMLElement>('.uc-inspector-body')!;
  const picker = inspector.querySelector<HTMLSelectElement>('[data-inspector-panel]')!;
  const toggle = inspector.querySelector<HTMLButtonElement>(
    '[data-smart-action="collapse-properties"]',
  )!;
  const mobile = window.matchMedia('(max-width: 800px)');
  const viewport = () =>
    root.style.setProperty(
      '--uc-viewport-height',
      `${window.visualViewport?.height ?? window.innerHeight}px`,
    );
  viewport();
  window.addEventListener('resize', viewport);
  window.visualViewport?.addEventListener('resize', () => {
    viewport();
    if (body.contains(document.activeElement))
      requestAnimationFrame(() =>
        (document.activeElement as HTMLElement)?.scrollIntoView({
          block: 'nearest',
          behavior: 'instant',
        }),
      );
  });
  let active = '';
  const ranges = [...root.querySelectorAll<HTMLInputElement>('input[type="range"]')]
    .map((input) => {
      const label = input.closest('label');
      if (!label) return null;
      const existing = label.querySelector<HTMLOutputElement>('output');
      const output = existing || document.createElement('output');
      const suffix = existing?.value.endsWith('%') ? '%' : '';
      if (!existing) label.insertBefore(output, input);
      const sync = () => {
        output.value = input.value + suffix;
      };
      input.addEventListener('input', sync);
      return sync;
    })
    .filter((sync): sync is () => void => !!sync);
  const collapse = () => {
    const closed = root.dataset.propertiesCollapsed === 'true';
    body.hidden = closed;
    toggle.setAttribute('aria-expanded', String(!closed));
    toggle.querySelector('span')!.textContent = closed ? 'Show' : 'Hide';
  };
  const reveal = () => {
    if (!mobile.matches || root.classList.contains('uc-next')) return;
    requestAnimationFrame(() => inspector.scrollIntoView({ block: 'start', behavior: 'instant' }));
  };
  picker.addEventListener('change', () =>
    root.querySelector<HTMLButtonElement>(`.uc-tools [data-panel="${picker.value}"]`)?.click(),
  );
  root.addEventListener('uc:inspector-collapse', collapse);
  root.addEventListener('click', (event) => {
    const target =
      event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (!target) return;
    if (target.dataset.openPanel)
      root
        .querySelector<HTMLButtonElement>(`.uc-tools [data-panel="${target.dataset.openPanel}"]`)
        ?.click();
    if (target.hasAttribute('data-inspector-canvas')) {
      if (mobile.matches) {
        root.dataset.propertiesCollapsed = 'true';
        collapse();
      }
      const stage = root.querySelector<HTMLElement>('.uc-stage')!;
      stage.scrollIntoView({ block: 'center', behavior: 'instant' });
      stage.focus({ preventScroll: true });
    }
    if (target.dataset.panel) reveal();
    if (target.dataset.selectionTool) {
      const tool = root.querySelector<HTMLSelectElement>('[data-smart-tool]')!;
      tool.value = target.dataset.selectionTool;
      tool.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  const toolState = () => {
    const value = root.querySelector<HTMLSelectElement>('[data-smart-tool]')?.value;
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-selection-tool]'))
      button.setAttribute('aria-pressed', String(button.dataset.selectionTool === value));
  };
  root.addEventListener('change', (event) => {
    if ((event.target as Element).matches('[data-smart-tool]')) toolState();
  });
  toolState();
  collapse();
  return {
    sync() {
      ranges.forEach((sync) => sync());
    },
    select(name: string) {
      root.dataset.activePanel = name;
      root.dataset.propertiesCollapsed = 'false';
      picker.value = name;
      if (active !== name) body.scrollTop = 0;
      active = name;
      collapse();
      toolState();
    },
  };
}
