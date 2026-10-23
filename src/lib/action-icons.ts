/** Shared geometry keeps server-rendered and dynamic card actions identical. */
export const actionIcons = {
  edit: ['m15 4 5 5-11 11-6 1 1-6L15 4Z', 'm12 7 5 5M4 15l5 5'],
  download: ['M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5'],
  view: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
} as const;
