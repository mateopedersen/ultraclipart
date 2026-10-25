/** Catalog downloads always enter a real, same-site file information page. */
export function downloadPageHref(id: string, format: 'webp' | 'pdf') {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !['webp', 'pdf'].includes(format))
    throw new Error('Invalid download selection');
  return `/download/${id}/?format=${format}`;
}
