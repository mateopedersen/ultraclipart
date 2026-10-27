export const COOKIE_POLICY_VERSION = '2026-10-25.1';
export const COOKIE_CHOICE_NAME = 'uc_cookie_choice';
export const COOKIE_CHOICE_DAYS = 180;
export const COOKIE_CHOICE_SECONDS = COOKIE_CHOICE_DAYS * 86400;

export const cookieRecords = [
  {
    name: COOKIE_CHOICE_NAME,
    provider: 'UltraClipart · First party',
    purpose:
      'Remembers that you accepted this notice or chose necessary cookies only. It contains a policy version, your choice and its date, without a visitor identifier.',
    duration: '180 days for either choice',
    when: 'After you make a choice',
  },
  {
    name: '__Host-uc_ai',
    provider: 'UltraClipart · First party',
    purpose:
      'Protects Builder requests and enforces free usage limits. Signed, Secure, HttpOnly and SameSite=Strict.',
    duration: 'Up to 24 hours; the signed session is tied to a UTC day',
    when: 'When you use the Builder service',
  },
  {
    name: '__Host-uc_share',
    provider: 'UltraClipart · First party',
    purpose:
      'Protects public-link publication, request verification and free sharing limits. Signed, Secure, HttpOnly and SameSite=Strict.',
    duration: 'Up to 24 hours; the signed session is tied to a UTC day',
    when: 'When you use public-link sharing',
  },
];

export const deviceRecords = [
  {
    name: 'Favorites and boards',
    technology: 'Local storage',
    purpose:
      'Artwork you save, boards, private notes, tags, project stages, pins, board covers and saved dates.',
    duration: 'Until you remove them or clear this site’s storage',
  },
  {
    name: 'Favorites display preferences',
    technology: 'Local storage',
    purpose: 'Remembers your preferred card density, page size and note visibility on this device.',
    duration: 'Until you change these settings or clear this site’s storage',
  },
  {
    name: 'Studio projects and recovery',
    technology: 'Local storage / IndexedDB',
    purpose:
      'Recoverable work, saved canvas documents, chosen palette and favorite elements when using Studio.',
    duration: 'Until replaced, reset, removed or cleared in your browser',
  },
  {
    name: 'Builder history',
    technology: 'IndexedDB',
    purpose: 'Recent results and descriptions on this device, with a maximum of twelve results.',
    duration: 'Up to seven days; cleanup runs when the Builder is used',
  },
  {
    name: 'Open a result in Studio',
    technology: 'IndexedDB',
    purpose: 'Transfers the selected image between tools without uploading it again.',
    duration: 'One hour; expired records are removed on later access',
  },
  {
    name: 'Draft descriptions and recent random picks',
    technology: 'Session storage',
    purpose:
      'Carries your chosen example into the Builder and avoids repeating random illustrations in the current tab.',
    duration: 'The current tab session, subject to the browser’s session-restore behavior',
  },
  {
    name: 'Your public-link removal keys',
    technology: 'Local storage',
    purpose: 'Lets you manage the public artwork links you explicitly create.',
    duration: 'Until you remove the record or clear this site’s storage',
  },
];
