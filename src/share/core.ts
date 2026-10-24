export type ShareOptions = {
  trigger?: HTMLElement;
  kind: 'catalog' | 'creation';
  title: string;
  url?: string;
  imageUrl?: string;
  blob?: Blob;
  sourceUrl?: string;
};
export const SITE = 'https://ultraclipart.com';
export function publicMediaUrl(value?: string): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value, SITE);
    if (![SITE, 'https://assets.ultraclipart.com'].includes(url.origin)) return;
    if (!/\.(?:webp|png|jpe?g)$/i.test(url.pathname)) return;
    return url.origin + url.pathname;
  } catch {
    return;
  }
}
export function artworkUrl(value: string): string {
  const url = new URL(value, SITE);
  if (url.origin !== SITE || !/^\/(?:art\/[a-z0-9-]+|share\/[a-zA-Z0-9_-]+)\/$/.test(url.pathname))
    throw new Error('Invalid artwork link');
  return SITE + url.pathname;
}
export function caption(kind: ShareOptions['kind'], title: string): string {
  const name = title.trim().replace(/\s+/g, ' ').slice(0, 120) || 'My clipart';
  return kind === 'catalog'
    ? `I found “${name}” on UltraClipart. A little inspiration for your next creative project!`
    : `I created “${name}” with UltraClipart. Make something of your own with Clipart Studio or AI Clipart Builder!`;
}
export function socialLinks(url: string, text: string, imageUrl?: string) {
  const link = artworkUrl(url);
  const media = publicMediaUrl(imageUrl);
  const truncate = (value: string, count: number) =>
    Array.from(value).slice(0, Math.max(0, count)).join('');
  const make = (base: string, params: Record<string, string>) =>
    `${base}?${new URLSearchParams(params)}`;
  return [
    {
      id: 'pinterest-p',
      name: 'Pinterest',
      color: '#bd081c',
      href: make('https://www.pinterest.com/pin/create/button/', {
        url: link,
        ...(media ? { media } : {}),
        description: text.slice(0, 500),
      }),
    },
    {
      id: 'facebook-f',
      name: 'Facebook',
      color: '#1877f2',
      href: make('https://www.facebook.com/sharer/sharer.php', { u: link }),
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      color: '#087b45',
      href: make('https://wa.me/', { text: `${text}\n${link}` }),
    },
    {
      id: 'x-twitter',
      name: 'X',
      color: '#111827',
      href: make('https://x.com/intent/post', { text: truncate(text, 120), url: link }),
    },
    {
      id: 'telegram',
      name: 'Telegram',
      color: '#1684b5',
      href: make('https://t.me/share/url', { url: link, text }),
    },
    {
      id: 'linkedin-in',
      name: 'LinkedIn',
      color: '#0a66c2',
      href: make('https://www.linkedin.com/sharing/share-offsite/', { url: link }),
    },
    {
      id: 'reddit-alien',
      name: 'Reddit',
      color: '#d63b00',
      href: make('https://www.reddit.com/submit', { url: link, title: text.slice(0, 250) }),
    },
    {
      id: 'bluesky',
      name: 'Bluesky',
      color: '#0875e9',
      href: make('https://bsky.app/intent/compose', {
        text: `${truncate(text, 299 - Array.from(link).length)}\n${link}`,
      }),
    },
    {
      id: 'threads',
      name: 'Threads',
      color: '#111827',
      href: make('https://www.threads.net/intent/post', {
        text: `${truncate(text, 499 - Array.from(link).length)}\n${link}`,
      }),
    },
  ];
}
