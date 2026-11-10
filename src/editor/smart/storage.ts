import type { EditorDocument } from '../model';
function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('ultraclipart-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveLocal(key: string, doc: EditorDocument) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(doc, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function loadLocal(key: string): Promise<EditorDocument | undefined> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('projects').objectStore('projects').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
export async function deleteLocal(key: string) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// The comparison and mutation share one transaction, including across tabs.
// Plain workbench checkpoints keep the existing saveLocal/deleteLocal API.
async function mutateLocalWhen(
  key: string,
  accept: (current: unknown) => boolean,
  doc?: EditorDocument,
) {
  const db = await open();
  try {
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      let changed = false;
      const request = store.get(key);
      request.onsuccess = () => {
        try {
          if (accept(request.result)) {
            if (doc) store.put(doc, key);
            else store.delete(key);
            changed = true;
          }
        } catch (error) {
          tx.abort();
          reject(error);
        }
      };
      tx.oncomplete = () => resolve(changed);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Recovery transaction aborted'));
    });
  } finally {
    db.close();
  }
}
export const saveLocalWhen = (
  key: string,
  doc: EditorDocument,
  accept: (current: unknown) => boolean,
) => mutateLocalWhen(key, accept, doc);
export const deleteLocalWhen = (key: string, accept: (current: unknown) => boolean) =>
  mutateLocalWhen(key, accept);
