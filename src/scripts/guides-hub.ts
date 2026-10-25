import { initializeAnnotatedScreens } from './annotated-screens';

const navigation = document.querySelector<HTMLElement>('[data-guide-goals]');
if (navigation) {
  const links = [...navigation.querySelectorAll<HTMLAnchorElement>('[data-guide-goal]')];
  const panels = [...document.querySelectorAll<HTMLElement>('[data-guide-panel]')];
  const initial = panels.findIndex((panel) => `#${panel.id}` === window.location.hash);
  const select = (index: number, focus = false, updateUrl = false) => {
    links.forEach((link, position) => {
      const selected = position === index;
      link.setAttribute('aria-selected', String(selected));
      link.tabIndex = selected ? 0 : -1;
      panels[position].hidden = !selected;
    });
    if (focus) links[index].focus({ preventScroll: true });
    if (updateUrl) window.history.replaceState(null, '', links[index].hash);
  };
  navigation.setAttribute('role', 'tablist');
  links.forEach((link, index) => {
    link.setAttribute('role', 'tab');
    link.setAttribute('aria-controls', panels[index].id);
    panels[index].setAttribute('role', 'tabpanel');
    panels[index].setAttribute('aria-labelledby', link.id);
    panels[index].tabIndex = 0;
    link.addEventListener('click', (event) => {
      // Preserve native open-in-new-tab behavior for modified clicks.
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      select(index, false, true);
    });
    link.addEventListener('keydown', (event) => {
      let next: number;
      switch (event.key) {
        case 'ArrowRight':
          next = (index + 1) % links.length;
          break;
        case 'ArrowLeft':
          next = (index - 1 + links.length) % links.length;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = links.length - 1;
          break;
        case ' ':
          event.preventDefault();
          select(index, false, true);
          return;
        default:
          return;
      }
      event.preventDefault();
      select(next, true, true);
    });
  });
  select(initial >= 0 ? initial : 0);
  window.addEventListener('hashchange', () => {
    const index = panels.findIndex((panel) => `#${panel.id}` === window.location.hash);
    if (index >= 0) select(index);
  });
}

initializeAnnotatedScreens();
