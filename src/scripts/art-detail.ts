import { FAVORITES_KEY, parseFavoriteIds, toggleStoredFavorite } from '../lib/favorites-storage';

export function initArtDetail() {
  const preview = document.querySelector<HTMLElement>('#art-preview');
  if (preview) {
    const buttons = document.querySelectorAll<HTMLButtonElement>('.art-preview-controls [data-bg]');
    const custom = document.querySelector<HTMLElement>('.art-custom-color');
    const background = (color: string, customSelected = false) => {
      preview.style.background = color === 'transparent' ? '' : color;
      buttons.forEach((button) =>
        button.setAttribute('aria-pressed', String(!customSelected && button.dataset.bg === color)),
      );
      if (custom) custom.dataset.selected = String(customSelected);
    };
    buttons.forEach((button) => {
      button.addEventListener('click', () => background(button.dataset.bg!));
    });
    document
      .querySelector<HTMLInputElement>('#preview-color')
      ?.addEventListener('input', (event) => {
        background((event.target as HTMLInputElement).value, true);
      });
  }
  const button = document.querySelector<HTMLButtonElement>('[data-favorite]');
  const status = document.querySelector<HTMLElement>('#favorite-status');
  if (!button || !status) return;
  const id = button.dataset.favorite!;
  const render = (ids: string[]) => {
    const saved = ids.includes(id);
    button.setAttribute('aria-pressed', String(saved));
    button.textContent = saved ? '♥ Saved to Favorites' : '♡ Add to Favorites';
  };
  const notify = (message: string) => {
    status.hidden = false;
    status.textContent = message;
  };
  const sync = () => {
    try {
      render(parseFavoriteIds(localStorage.getItem(FAVORITES_KEY)));
    } catch {
      notify('Favorites could not be read on this device. Browser storage may be unavailable.');
    }
  };
  sync();
  button.addEventListener('click', () => {
    try {
      const ids = toggleStoredFavorite(localStorage, id);
      render(ids);
      notify(
        ids.includes(id)
          ? 'Saved to Favorites on this device.'
          : 'Removed from Favorites on this device.',
      );
    } catch {
      notify(
        'Your favorite could not be saved on this device. Browser storage may be full or unavailable.',
      );
    }
  });
  window.addEventListener('storage', (event) => {
    if (event.key === FAVORITES_KEY || event.key === null) {
      status.hidden = true;
      sync();
    }
  });
}
