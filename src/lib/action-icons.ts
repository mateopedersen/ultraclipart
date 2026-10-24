/** Shared geometry keeps server-rendered and dynamic card actions identical. */
export const actionIcons = {
  image: ['M4 3h16v18H4z', 'm4 16 5-5 4 4 3-3 4 4M15 7h.01'],
  document: ['M5 3h9l5 5v13H5zM14 3v6h5M9 13h6M9 17h6'],
  edit: ['m15 4 5 5-11 11-6 1 1-6L15 4Z', 'm12 7 5 5M4 15l5 5'],
  download: ['M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5'],
  view: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
} as const;
