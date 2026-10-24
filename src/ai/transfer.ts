import { validAiMetadata, validateDocument, type AiImageMetadata } from '../editor/model';
import { localImageHeader } from '../editor/smart/local-image';

export type StudioTransferMetadata = Omit<AiImageMetadata, 'version' | 'transferId'>;
export const TRANSFER_TTL = 60 * 60 * 1000;
const databaseName = 'ultraclipart-ai-transfer';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
interface Transfer {
  version: 1;
  id: string;
  bytes?: ArrayBuffer;
  mime?: string;
  metadata: AiImageMetadata;
  expiresAt: number;
  state: 'ready' | 'claimed' | 'consumed';
  owner?: string;
  leaseUntil?: number;
}
export function validTransferId(id: string) {
  return uuid.test(id);
}
export function normalizeMetadata(input: StudioTransferMetadata): AiImageMetadata {
  const metadata = { ...input, version: 1 as const };
  if (!validAiMetadata(metadata))
    throw new Error('The image metadata is invalid. Return to AI Clipart Builder and try again.');
  return metadata;
}
/** Inspect JPEG frame size before asking the browser to allocate decoded pixels. */
export function jpegDimensions(bytes: Uint8Array) {
  if (bytes[0] !== 255 || bytes[1] !== 216) throw new Error('Invalid JPEG image.');
  let p = 2;
  while (p + 3 < bytes.length) {
    if (bytes[p++] !== 255) throw new Error('Invalid JPEG structure.');
    while (bytes[p] === 255) p++;
    const marker = bytes[p++];
    if (marker === 217 || marker === 218) break;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    const length = (bytes[p] << 8) | bytes[p + 1];
    if (length < 2 || p + length > bytes.length) throw new Error('Incomplete JPEG image.');
    if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
      if (length < 8) throw new Error('Invalid JPEG dimensions.');
      const height = (bytes[p + 3] << 8) | bytes[p + 4],
        width = (bytes[p + 5] << 8) | bytes[p + 6];
      if (!width || !height || width > 4096 || height > 4096)
        throw new Error('Use an image with each side at most 4096 pixels.');
      return { width, height };
    }
    p += length;
  }
  throw new Error('JPEG dimensions could not be verified.');
}
/** Normalize provider JPEG into lossless pixels. PNG/WebP sources remain byte-for-byte intact. */
export async function studioImageBlob(input: Blob): Promise<Blob> {
  if (!(input instanceof Blob) || input.size === 0 || input.size > 8_000_000)
    throw new Error(
      'This image exceeds the supported transfer size. Download a smaller image first.',
    );
  const bytes = new Uint8Array(await input.arrayBuffer());
  if (bytes[0] !== 255 || bytes[1] !== 216) {
    const header = localImageHeader(bytes);
    return new Blob([bytes], { type: header.mime });
  }
  const dimensions = jpegDimensions(bytes);
  const url = URL.createObjectURL(input),
    image = new Image();
  try {
    image.src = url;
    await image.decode();
    if (
      image.naturalWidth !== dimensions.width ||
      image.naturalHeight !== dimensions.height ||
      !image.naturalWidth ||
      !image.naturalHeight
    )
      throw new Error('Use an image with each side at most 4096 pixels.');
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable in this browser.');
    context.drawImage(image, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not prepare the image.'))),
        'image/png',
      ),
    );
    localImageHeader(new Uint8Array(await png.arrayBuffer()));
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      reject(new Error('Local transfer storage is unavailable. Download a project file instead.'));
    }, 4000);
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(databaseName, 1);
    } catch {
      clearTimeout(timeout);
      reject(new Error('Local transfer storage is unavailable. Download a project file instead.'));
      return;
    }
    request.onupgradeneeded = () => request.result.createObjectStore('handoffs', { keyPath: 'id' });
    request.onsuccess = () => {
      clearTimeout(timeout);
      if (settled) request.result.close();
      else {
        settled = true;
        resolve(request.result);
      }
    };
    request.onerror = request.onblocked = () => {
      clearTimeout(timeout);
      settled = true;
      reject(new Error('Local transfer storage is unavailable. Download a project file instead.'));
    };
  });
}
async function transaction<T>(
  run: (store: IDBObjectStore, result: (value: T) => void, fail: (message: string) => void) => void,
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handoffs', 'readwrite');
    let value: T,
      error = 'Local transfer could not be saved. Download a project file instead.';
    const timer = setTimeout(() => {
      error = 'Local transfer timed out. Download a project file instead.';
      tx.abort();
    }, 5000);
    tx.oncomplete = () => {
      clearTimeout(timer);
      db.close();
      resolve(value);
    };
    tx.onerror = tx.onabort = () => {
      clearTimeout(timer);
      db.close();
      reject(new Error(error));
    };
    try {
      run(
        tx.objectStore('handoffs'),
        (v) => {
          value = v;
        },
        (message) => {
          error = message;
          tx.abort();
        },
      );
    } catch {
      tx.abort();
    }
  });
}
export async function createStudioTransfer(image: Blob, input: StudioTransferMetadata) {
  const metadata = normalizeMetadata(input),
    blob = await studioImageBlob(image),
    bytes = await blob.arrayBuffer(),
    id = crypto.randomUUID(),
    now = Date.now();
  await transaction<void>((store, done, fail) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const records = request.result as Transfer[];
      for (const record of records) if (record.expiresAt <= now) store.delete(record.id);
      if (records.filter((r) => r.expiresAt > now && r.state !== 'consumed').length >= 8) {
        fail(
          'Eight images are already waiting for Studio. Open one or download a project file instead.',
        );
        return;
      }
      store.put({
        version: 1,
        id,
        bytes,
        mime: blob.type,
        metadata: { ...metadata, transferId: id },
        expiresAt: now + TRANSFER_TTL,
        state: 'ready',
      } satisfies Transfer);
      done();
    };
  });
  return { id, url: `/create/?import=${id}` };
}
/** Atomic lease prevents two Studio tabs from inserting the same transfer at once. */
export async function claimStudioTransfer(id: string, owner: string) {
  if (!validTransferId(id) || !validTransferId(owner))
    throw new Error('This Studio transfer link is invalid. Your existing work is unchanged.');
  return transaction<Transfer & { image: Blob }>((store, done, fail) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const record = request.result as Transfer | undefined;
      if (
        !record ||
        record.version !== 1 ||
        record.id !== id ||
        !Number.isFinite(record.expiresAt) ||
        record.expiresAt <= Date.now() ||
        record.expiresAt > Date.now() + TRANSFER_TTL
      ) {
        fail(
          'This image transfer has expired or is missing on this device. Return to AI Clipart Builder, or open its downloaded project file.',
        );
        return;
      }
      if (record.state === 'consumed') {
        fail('This image was already opened in Studio. Your saved canvas has been preserved.');
        return;
      }
      if (
        record.state === 'claimed' &&
        record.owner !== owner &&
        (record.leaseUntil || 0) > Date.now()
      ) {
        fail('This image is opening in another Studio tab. Your current work is unchanged.');
        return;
      }
      if (
        !['ready', 'claimed'].includes(record.state) ||
        !validAiMetadata(record.metadata) ||
        record.metadata.transferId !== id ||
        !(record.bytes instanceof ArrayBuffer) ||
        record.bytes.byteLength === 0 ||
        record.bytes.byteLength > 4_000_000 ||
        !['image/png', 'image/webp'].includes(record.mime || '')
      ) {
        fail('This transfer is damaged. Download a project file from AI Clipart Builder instead.');
        return;
      }
      record.state = 'claimed';
      record.owner = owner;
      record.leaseUntil = Date.now() + 60_000;
      store.put(record);
      done({ ...record, image: new Blob([record.bytes], { type: record.mime }) });
    };
  });
}
export async function finishStudioTransfer(id: string, owner: string, imported: boolean) {
  await transaction<void>((store, done) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const record = request.result as Transfer | undefined;
      if (record?.state === 'claimed' && record.owner === owner) {
        record.state = imported ? 'consumed' : 'ready';
        delete record.owner;
        delete record.leaseUntil;
        if (imported) {
          delete record.bytes;
          delete record.mime;
        }
        store.put(record);
      }
      done();
    };
  });
}
/** Uses the same verified embedded sources and schema as Studio's Save project. */
export async function createStudioProject(
  image: Blob,
  input: StudioTransferMetadata,
): Promise<Blob> {
  const metadata = normalizeMetadata(input),
    blob = await studioImageBlob(image);
  const [{ registerLocalImage, serializeProject }, { blankDocument }] = await Promise.all([
    import('../editor/raster'),
    import('../editor/creation'),
  ]);
  const layer = await registerLocalImage(new Uint8Array(await blob.arrayBuffer()));
  layer.ai = metadata;
  layer.label = 'AI clipart';
  const doc = blankDocument('my-clipart', Math.max(64, layer.width), Math.max(64, layer.height));
  doc.version = 2;
  doc.layers = [layer];
  if (!validateDocument(doc, doc.artId))
    throw new Error('The image cannot be saved as a supported Studio project.');
  return new Blob([JSON.stringify(serializeProject(doc), null, 2)], { type: 'application/json' });
}
/** Clear temporary AI images alongside the Builder's local history; open Studio projects are separate. */
export async function clearStudioTransfers() {
  await transaction<void>((store, done) => {
    store.clear();
    done();
  });
}
