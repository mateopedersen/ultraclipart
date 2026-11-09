import { validateDocument, type EditorDocument } from './model';
import { loadLocal, saveLocalWhen, deleteLocalWhen } from './smart/storage';

const format = 'ultraclipart-editor-recovery-v1';
type Stamp = { format: typeof format; revision: number; writer: string };
type Stored = EditorDocument & { _ucRecovery: Stamp };
type Result = { local: boolean; indexedDB: boolean; timedOut: boolean };
type Local = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Options = {
  key: string;
  artId: string;
  unavailable: () => void;
  local?: Local;
  read?: typeof loadLocal;
  write?: typeof saveLocalWhen;
  remove?: typeof deleteLocalWhen;
  now?: () => number;
  writer?: string;
  delay?: number;
  timeout?: number;
};
export function recoveryStamp(value: unknown): Stamp | undefined {
  const stamp = (value as Partial<Stored> | null)?._ucRecovery;
  return stamp?.format === format &&
    Number.isSafeInteger(stamp.revision) &&
    stamp.revision > 0 &&
    stamp.revision < Number.MAX_SAFE_INTEGER &&
    typeof stamp.writer === 'string' &&
    /^[a-zA-Z0-9-]{1,80}$/.test(stamp.writer)
    ? stamp
    : undefined;
}
export function compareRecovery(a: unknown, b: unknown) {
  const x = recoveryStamp(a),
    y = recoveryStamp(b);
  const order = (x?.revision ?? 0) - (y?.revision ?? 0);
  const first = x?.writer ?? '',
    second = y?.writer ?? '';
  return order || (first === second ? 0 : first > second ? 1 : -1);
}

export function withoutRecoveryMetadata(project: EditorDocument): EditorDocument {
  const { _ucRecovery: ignored, ...document } = project as Stored;
  return document;
}

export function createProjectRecovery(options: Options) {
  const { key, artId, unavailable } = options;
  const local = () => options.local ?? localStorage;
  const read = options.read ?? loadLocal;
  const write = options.write ?? saveLocalWhen;
  const remove = options.remove ?? deleteLocalWhen;
  const writer = options.writer ?? crypto.randomUUID();
  let revision = 0;
  let pending: Stored | undefined;
  let latest: Stored | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Keep the actual operation in the queue even if the UI wait times out.
  // A late old operation must not run after a newer write or explicit deletion.
  let tail: Promise<unknown> = Promise.resolve();
  function localValue(slot = key): unknown {
    try {
      const raw = local().getItem(slot);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  }
  function nextStamp(): Stamp {
    const now = Math.max(0, Math.floor((options.now ?? Date.now)()));
    revision =
      Math.max(
        revision,
        recoveryStamp(localValue())?.revision ?? 0,
        Number.isSafeInteger(now) ? now : 0,
      ) + 1;
    if (!Number.isSafeInteger(revision) || revision >= Number.MAX_SAFE_INTEGER)
      throw new Error('Browser recovery revision is out of range. Save a project file.');
    return { format, revision, writer };
  }
  function capture(project: EditorDocument): Stored {
    const record = { ...project, _ucRecovery: nextStamp() };
    latest = record;
    // Do not erase a valid older copy when quota or size prevents this write.
    try {
      const json = JSON.stringify(record);
      if (json.length <= 2000000 && compareRecovery(record, localValue()) >= 0)
        local().setItem(key, json);
    } catch {
      /* The independent IDB path still attempts this exact revision. */
    }
    return record;
  }
  function localMatches(record: Stored) {
    return compareRecovery(localValue(), record) === 0 && recoveryStamp(localValue()) !== undefined;
  }
  async function bounded<T>(operation: Promise<T>): Promise<{ value?: T; timedOut: boolean }> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation.then((value) => ({ value, timedOut: false })),
        new Promise<{ timedOut: boolean }>((resolve) => {
          timeout = setTimeout(() => resolve({ timedOut: true }), options.timeout ?? 1500);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }
  async function store(record: Stored): Promise<Result> {
    const operation = tail.then(() =>
      write(key, record, (current) => compareRecovery(record, current) >= 0),
    );
    tail = operation.catch(() => undefined);
    let result: Result;
    try {
      const completed = await bounded(operation);
      result = {
        local: localMatches(record),
        indexedDB: completed.value === true,
        timedOut: completed.timedOut,
      };
    } catch {
      result = { local: localMatches(record), indexedDB: false, timedOut: false };
    }
    if (!result.local && !result.indexedDB && latest === record) unavailable();
    return result;
  }
  async function flush(project?: EditorDocument): Promise<Result> {
    clearTimeout(timer);
    if (project) pending = capture(project);
    const record = pending;
    pending = undefined;
    if (record) return store(record);
    const completed = await bounded(tail);
    return {
      local: latest ? localMatches(latest) : false,
      indexedDB: false,
      timedOut: completed.timedOut,
    };
  }
  return {
    schedule(project: EditorDocument) {
      clearTimeout(timer);
      try {
        pending = capture(project);
      } catch {
        pending = undefined;
        latest = undefined;
        unavailable();
        return;
      }
      timer = setTimeout(() => {
        void flush();
      }, options.delay ?? 150);
    },
    flush,
    async load(slot = key): Promise<EditorDocument | undefined> {
      const values = [localValue(slot)];
      try {
        values.push((await bounded(read(slot))).value);
      } catch {
        /* Try the valid local copy. */
      }
      const valid = values.filter((value) => validateDocument(value, artId));
      for (const value of valid) revision = Math.max(revision, recoveryStamp(value)?.revision ?? 0);
      // Stable sorting keeps legacy localStorage first when neither has a stamp.
      // Their historical age cannot be inferred from layer count or content.
      valid.sort((a, b) => compareRecovery(b, a));
      if (!valid.length) return undefined;
      return withoutRecoveryMetadata(valid[0]);
    },
    async clear() {
      clearTimeout(timer);
      pending = undefined;
      const cutoff = { _ucRecovery: nextStamp() };
      latest = undefined;
      // Remove only this key now: a subsequent edit's local copy is preserved.
      let localRemoved = false;
      try {
        if (compareRecovery(localValue(), cutoff) <= 0) local().removeItem(key);
        localRemoved = true;
      } catch {
        /* Still attempt the independent IDB deletion. */
      }
      const operation = tail.then(() =>
        remove(key, (current) => compareRecovery(current, cutoff) <= 0),
      );
      tail = operation.catch(() => undefined);
      const completed = await bounded(operation);
      if (completed.timedOut) throw new Error('Browser recovery deletion is still pending.');
      if (!localRemoved) throw new Error('The local browser recovery copy could not be deleted.');
    },
  };
}
