import { contactFormLink, contactTopics } from '../lib/contact';

export function initContact() {
  const root = document.querySelector<HTMLElement>('[data-contact-page]');
  if (!root || root.dataset.contactReady) return;
  root.dataset.contactReady = 'true';
  const gateway = root.querySelector<HTMLElement>('[data-contact-gateway]')!;
  const host = root.querySelector<HTMLElement>('[data-contact-frame-host]')!;
  const status = root.querySelector<HTMLElement>('[data-contact-status]')!;
  const direct = root.querySelector<HTMLAnchorElement>('[data-contact-direct]')!;
  const loadButton = root.querySelector<HTMLButtonElement>('[data-contact-load]')!;
  loadButton.hidden = false;
  let selected: string = contactTopics[0].id;
  let opened = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-contact-topic]')) {
    button.addEventListener('click', () => {
      const topic = contactTopics.find((item) => item.id === button.dataset.contactTopic);
      if (!topic) return;
      selected = topic.id;
      for (const sibling of root.querySelectorAll('[data-contact-topic]'))
        sibling.setAttribute('aria-pressed', String(sibling === button));
      const list = root.querySelector('[data-contact-details]')!;
      list.replaceChildren(
        ...topic.details.map((detail) => {
          const item = document.createElement('li');
          item.textContent = detail;
          return item;
        }),
      );
      const helpLink = root.querySelector<HTMLAnchorElement>('[data-contact-help-link]')!;
      helpLink.href = topic.href;
      helpLink.textContent = topic.link + ' →';
      // Never reload an open form: doing so would discard a visitor's typed message.
      if (!opened) {
        root.querySelector('[data-contact-selected]')!.textContent = topic.title;
        direct.href = contactFormLink(selected);
      } else {
        status.textContent =
          'The tips have changed. Choose the message topic inside the open form; your draft has not been reloaded.';
      }
    });
  }
  loadButton.addEventListener('click', () => {
    if (opened) return;
    opened = true;
    const frame = document.createElement('iframe');
    frame.title = 'Contact UltraClipart — Google Form';
    frame.src = contactFormLink(selected, true);
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('height', '1640');
    frame.setAttribute('width', '100%');
    frame.addEventListener('load', () => {
      clearTimeout(fallbackTimer);
      // A cross-origin load event cannot confirm that Google accepted a response.
      status.textContent =
        'Complete the form below and press Submit. If the form is unavailable, use Open in Google Forms or email us.';
    });
    fallbackTimer = setTimeout(() => {
      status.textContent =
        'The form is taking longer to load. You can open it in Google Forms or email us instead.';
    }, 12000);
    status.textContent = 'Loading Google Forms. You can also open the form in a separate window.';
    gateway.hidden = true;
    host.hidden = false;
    host.append(frame);
    frame.focus();
  });
}
