const initialized = new WeakSet<HTMLElement>();
/** The underlying capture is unchanged; only the matching explanation is highlighted. */
export function initializeAnnotatedScreens(root: ParentNode = document) {
  for (const screen of root.querySelectorAll<HTMLElement>('[data-screen]')) {
    if (initialized.has(screen)) continue;
    initialized.add(screen);
    const activate = (number: string) => {
      for (const button of screen.querySelectorAll<HTMLButtonElement>('[data-screen-select]')) {
        const selected = button.dataset.screenSelect === number;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
      }
      for (const target of screen.querySelectorAll<SVGElement>('[data-screen-target]'))
        target.classList.toggle('is-active', target.dataset.screenTarget === number);
      for (const instruction of screen.querySelectorAll<HTMLElement>('[data-screen-instruction]'))
        instruction.classList.toggle('is-active', instruction.dataset.screenInstruction === number);
    };
    for (const button of screen.querySelectorAll<HTMLButtonElement>('[data-screen-select]')) {
      button.addEventListener('click', () => activate(button.dataset.screenSelect!));
      button.addEventListener('focus', () => activate(button.dataset.screenSelect!));
    }
  }
}
