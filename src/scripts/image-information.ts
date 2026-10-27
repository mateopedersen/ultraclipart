/** A shared enhancement for existing and dynamically inserted informative images.
 * Read the image's own metadata; never infer identities from URLs or filenames.
 */
export function initImageInformation() {
  if (document.querySelector('[data-image-information]')) return;
  const tip = document.createElement('div');
  tip.id = 'uc-image-information';
  tip.className = 'image-information';
  tip.dataset.imageInformation = '';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('popover', 'manual');
  tip.hidden = true;
  const title = document.createElement('strong');
  const description = document.createElement('p');
  tip.append(title, description);
  document.body.append(tip);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closing: ReturnType<typeof setTimeout> | undefined;
  let active: HTMLImageElement | undefined;
  let owner: HTMLElement | undefined;
  let originalTitle: string | null = null;
  let keyboard = false;
  let point = { x: 0, y: 0 };
  const informative = (image: HTMLImageElement | null): image is HTMLImageElement =>
    !!image?.alt.trim() && !image.closest('[aria-hidden="true"], [inert]');
  function hide() {
    clearTimeout(timer);
    clearTimeout(closing);
    if (active && originalTitle !== null && !active.hasAttribute('title'))
      active.setAttribute('title', originalTitle);
    if (owner) {
      const ids = (owner.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((id) => id && id !== tip.id);
      if (ids.length) owner.setAttribute('aria-describedby', ids.join(' '));
      else owner.removeAttribute('aria-describedby');
    }
    if (typeof tip.hidePopover === 'function' && tip.matches(':popover-open')) tip.hidePopover();
    tip.hidden = true;
    active = undefined;
    owner = undefined;
    originalTitle = null;
  }
  function place() {
    const bounds = tip.getBoundingClientRect();
    const edge = 12;
    const x = Math.max(edge, Math.min(point.x + 16, innerWidth - bounds.width - edge));
    const below = point.y + 22;
    const y =
      below + bounds.height < innerHeight - edge
        ? below
        : Math.max(edge, point.y - bounds.height - 16);
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }
  function show(image: HTMLImageElement, trigger: HTMLElement, focus = false) {
    if (!informative(image)) return;
    clearTimeout(closing);
    if (active === image) return;
    hide();
    active = image;
    owner = trigger;
    timer = setTimeout(
      () => {
        if (active !== image || !image.isConnected || !informative(image)) return hide();
        originalTitle = image.getAttribute('title');
        const heading = originalTitle?.trim() || '';
        const alt = image.alt.trim();
        title.textContent = heading || 'Image description';
        description.textContent = alt;
        description.hidden =
          !!heading &&
          heading.replace(/\.$/, '').toLowerCase() === alt.replace(/\.$/, '').toLowerCase();
        // Suppress only the duplicate native popup during the enhanced tooltip.
        // The server-rendered title and exact alt remain the SEO/accessibility source;
        // the title is restored on exit, Escape, navigation or keyboard dismissal.
        if (originalTitle !== null) image.removeAttribute('title');
        const described = new Set(
          (trigger.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean),
        );
        described.add(tip.id);
        trigger.setAttribute('aria-describedby', [...described].join(' '));
        (image.closest('dialog[open]') || document.body).append(tip);
        tip.hidden = false;
        if (typeof tip.showPopover === 'function') tip.showPopover();
        if (focus) {
          const box = image.getBoundingClientRect();
          point = {
            x: box.left + Math.min(box.width / 2, 140),
            y: Math.min(box.bottom, innerHeight - 80),
          };
        }
        place();
      },
      focus ? 0 : 350,
    );
  }
  document.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    const node = event.target;
    if (!(node instanceof Element)) return;
    if (tip.contains(node)) {
      clearTimeout(closing);
      return;
    }
    const image = node.closest('img');
    if (!informative(image)) return;
    point = { x: event.clientX, y: event.clientY };
    show(image, image.closest<HTMLElement>('a,button,[tabindex]') || image);
  });
  document.addEventListener('pointermove', (event) => {
    if (tip.contains(event.target as Node)) return;
    point = { x: event.clientX, y: event.clientY };
    if (active && !active.isConnected) hide();
  });
  document.addEventListener('pointerout', (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && (tip.contains(next) || next === active)) return;
    if (event.target === active || tip.contains(event.target as Node)) {
      clearTimeout(closing);
      closing = setTimeout(hide, 150);
    }
  });
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Tab') keyboard = true;
      if (event.key === 'Escape') {
        if (!tip.hidden) {
          event.preventDefault();
          event.stopPropagation();
        }
        hide();
      }
    },
    true,
  );
  document.addEventListener(
    'pointerdown',
    () => {
      keyboard = false;
      hide();
    },
    true,
  );
  document.addEventListener('focusin', (event) => {
    if (!keyboard || !(event.target instanceof HTMLElement)) return;
    const image = event.target.matches('img')
      ? (event.target as HTMLImageElement)
      : event.target.querySelector<HTMLImageElement>('img[alt]:not([alt=""])');
    if (informative(image)) show(image, event.target, true);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener(
    'scroll',
    (event) => {
      if (!tip.contains(event.target as Node)) hide();
    },
    true,
  );
  window.addEventListener('resize', hide);
  window.addEventListener('pagehide', hide);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hide();
  });
}
