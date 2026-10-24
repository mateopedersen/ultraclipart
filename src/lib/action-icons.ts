/** Shared geometry keeps server-rendered and dynamic card actions identical. */
export const actionIcons = {
  image: [
    'M7 3.5h10A3.5 3.5 0 0 1 20.5 7v10a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5Z',
    'm3.5 16 4.8-4.8a1 1 0 0 1 1.4 0l5.8 5.8m-3-3 2.8-2.8a1 1 0 0 1 1.4 0l3.8 3.8',
    'M16.5 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z',
  ],
  document: [
    'M13.5 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V9.5l-6-6Z',
    'M13.5 3.5V7a2.5 2.5 0 0 0 2.5 2.5h3.5M8.5 13h7M8.5 16.5h4.5',
  ],
  edit: [
    'M10 4.5H7A3.5 3.5 0 0 0 3.5 8v9A3.5 3.5 0 0 0 7 20.5h9a3.5 3.5 0 0 0 3.5-3.5v-3',
    'm15.5 4.5 1-1a2.12 2.12 0 0 1 3 3l-1 1M15.5 4.5 8 12l-1 5 5-1 7.5-7.5M14.5 5.5l4 4M8 12l4 4',
  ],
  download: ['M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5'],
  view: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
} as const;

/** Subtle tonal fills give the small action icons depth without losing clarity. */
export const actionIconAccents: Partial<Record<keyof typeof actionIcons, string>> = {
  image: 'M3.5 16 9 10.5l4 4 3-3 4.5 4V17a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17Z',
  document: 'M13.5 3.5V7A2.5 2.5 0 0 0 16 9.5h3.5ZM8.5 12h7v5.5h-7Z',
  edit: 'm8 12 7.5-7.5 4 4L12 16l-5 1Z',
};
