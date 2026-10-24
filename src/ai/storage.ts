export type Generation = {
  id: string;
  prompt: string;
  composedPrompt: string;
  style: string;
  model: string;
  createdAt: string;
  width: number;
  height: number;
  original: Blob;
  edited?: Blob;
};
type StoredGeneration = Omit<Generation, 'original' | 'edited'> & {
  original: ArrayBuffer;
  originalType: string;
  edited?: ArrayBuffer;
  editedType?: string;
};
const MAX_AGE = 7 * 86400000;
const database = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('ultraclipart-ai-history', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('images', { keyPath: 'id' });
    req.onerror = () =>
      reject(new Error('Local storage is unavailable. Download your work before leaving.'));
    req.onsuccess = () => resolve(req.result);
  });
export async function history(
  action: 'read' | 'write' | 'clear',
  item?: Generation,
): Promise<Generation[]> {
  const stored: StoredGeneration | undefined = item
    ? {
        ...item,
        original: await item.original.arrayBuffer(),
        originalType: item.original.type,
        edited: item.edited ? await item.edited.arrayBuffer() : undefined,
        editedType: item.edited?.type,
      }
    : undefined;
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('images', 'readwrite');
    const store = transaction.objectStore('images');
    if (action === 'clear') store.clear();
    if (stored) store.put(stored);
    const request = store.getAll();
    let records: Generation[] = [];
    request.onsuccess = () => {
      const all = request.result as (StoredGeneration | Generation)[];
      records = all
        .filter(
          (r) =>
            typeof r.id === 'string' &&
            typeof r.createdAt === 'string' &&
            typeof r.prompt === 'string' &&
            r.prompt.length <= 1200 &&
            Date.parse(r.createdAt) > Date.now() - MAX_AGE &&
            (r.original instanceof Blob || r.original instanceof ArrayBuffer),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 12)
        .map((r) => ({
          ...r,
          original:
            r.original instanceof Blob
              ? r.original
              : new Blob([r.original], {
                  type: (r as StoredGeneration).originalType || 'image/jpeg',
                }),
          edited:
            r.edited instanceof ArrayBuffer
              ? new Blob([r.edited], { type: (r as StoredGeneration).editedType || 'image/png' })
              : r.edited,
        }));
      for (const r of all) if (!records.some((kept) => kept.id === r.id)) store.delete(r.id);
    };
    transaction.oncomplete = () => {
      db.close();
      resolve(records);
    };
    transaction.onerror = () => {
      db.close();
      reject(new Error('This browser could not save the image. Download it to keep a copy.'));
    };
  });
}
