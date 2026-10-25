import {
  COOKIE_CHOICE_NAME,
  COOKIE_CHOICE_SECONDS,
  COOKIE_POLICY_VERSION,
} from '../lib/cookie-policy';

type CookieChoice = { version: string; choice: 'accepted' | 'necessary'; at: number };

function validChoice(value: unknown): value is CookieChoice {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<CookieChoice>;
  return (
    entry.version === COOKIE_POLICY_VERSION &&
    (entry.choice === 'accepted' || entry.choice === 'necessary') &&
    typeof entry.at === 'number' &&
    Number.isFinite(entry.at) &&
    entry.at <= Date.now() + 60000 &&
    Date.now() - entry.at < COOKIE_CHOICE_SECONDS * 1000
  );
}

function readChoice(): CookieChoice | undefined {
  try {
    const prefix = `${COOKIE_CHOICE_NAME}=`;
    const raw = document.cookie
      .split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(prefix))
      ?.slice(prefix.length);
    if (!raw || raw.length > 1024) return;
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    return validChoice(parsed) ? parsed : undefined;
  } catch {
    return;
  }
}

export function initCookieNotice() {
  const strip = document.querySelector<HTMLElement>('#cookie-notice');
  const dialog = document.querySelector<HTMLDialogElement>('#cookie-settings-dialog');
  const feedback = document.querySelector<HTMLElement>('#cookie-feedback');
  if (!strip || !dialog || strip.dataset.ready) return;
  strip.dataset.ready = 'true';
  let remembered = readChoice();
  let regionalNotice: boolean | undefined;
  let regionPending: Promise<void> | undefined;

  const measure = () =>
    document.documentElement.style.setProperty(
      '--cookie-strip-height',
      `${strip.hidden ? 0 : Math.ceil(strip.getBoundingClientRect().height)}px`,
    );
  const show = (visible: boolean) => {
    strip.hidden = !visible;
    measure();
  };
  const summary = () => {
    const choice = readChoice() ?? (validChoice(remembered) ? remembered : undefined);
    const text = choice
      ? `Your current choice: ${choice.choice === 'accepted' ? 'Accepted necessary cookies' : 'Necessary cookies only'}. Saved ${new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(choice.at)}.`
      : 'No choice has been saved on this browser yet.';
    document
      .querySelectorAll<HTMLElement>('[data-cookie-choice-summary]')
      .forEach((item) => (item.textContent = text));
  };
  const refresh = async () => {
    const choice = readChoice() ?? (validChoice(remembered) ? remembered : undefined);
    summary();
    if (choice) {
      show(false);
      return;
    }
    if (regionalNotice !== undefined) {
      show(regionalNotice);
      return;
    }
    if (regionPending) return regionPending;
    regionPending = (async () => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 2500);
      try {
        const response = await fetch('/api/cookie-region.json', {
          credentials: 'omit',
          cache: 'no-store',
          redirect: 'error',
          signal: controller.signal,
        });
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
          throw new Error('Region unavailable');
        const result: unknown = await response.json();
        regionalNotice =
          !result ||
          typeof result !== 'object' ||
          (result as { showNotice?: unknown }).showNotice !== false;
      } catch {
        regionalNotice = true;
      } finally {
        window.clearTimeout(timer);
      }
      show(!readChoice() && !validChoice(remembered) && regionalNotice);
    })();
    await regionPending;
  };

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : undefined;
    const choiceButton = target?.closest<HTMLElement>('[data-cookie-choice]');
    const choice = choiceButton?.dataset.cookieChoice;
    if (choice === 'accepted' || choice === 'necessary') {
      event.preventDefault();
      remembered = { version: COOKIE_POLICY_VERSION, choice, at: Date.now() };
      try {
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${COOKIE_CHOICE_NAME}=${encodeURIComponent(JSON.stringify(remembered))}; Path=/; Max-Age=${COOKIE_CHOICE_SECONDS}; SameSite=Lax${secure}`;
      } catch {
        /* Keep the choice in memory when browser storage is blocked. */
      }
      show(false);
      summary();
      if (dialog.open) dialog.close();
      if (feedback)
        feedback.textContent = readChoice()
          ? 'Your cookie choice has been saved. Advertising and analytics remain disabled.'
          : 'Your choice applies to this page. Your browser prevented saving it for future visits.';
      return;
    }
    const settings = target?.closest<HTMLElement>('[data-cookie-settings]');
    if (settings && typeof dialog.showModal === 'function') {
      event.preventDefault();
      summary();
      if (!dialog.open) dialog.showModal();
    }
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measure).observe(strip);
  window.addEventListener('resize', measure);
  window.addEventListener('pageshow', () => {
    void refresh();
  });
  window.addEventListener('focus', () => {
    void refresh();
  });
  void refresh();
}
