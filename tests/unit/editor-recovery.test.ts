import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProjectRecovery,
  compareRecovery,
  recoveryStamp,
  withoutRecoveryMetadata,
} from '../../src/editor/recovery';
import type { EditorDocument } from '../../src/editor/model';
import { blankDocument } from '../../src/editor/creation';

const key = 'ultraclipart:editor:v1:fixture';
const project = (title: string) => ({ ...blankDocument('fixture'), title });
const stamped = (title: string, revision: number, writer = 'writer') => ({
  ...project(title),
  _ucRecovery: { format: 'ultraclipart-editor-recovery-v1', revision, writer },
});
const copy = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function fixture() {
  const local = new Map<string, string>([['unrelated-preference', 'preserve']]);
  let db: unknown;
  const state = {
    quota: false,
    dbFailure: false,
    notices: 0,
    writes: [] as string[],
    gate: undefined as undefined | (() => Promise<void>),
  };
  const options = {
    key,
    artId: 'fixture',
    writer: 'writer',
    now: () => 10,
    delay: 10000,
    timeout: 100,
    unavailable: () => {
      state.notices++;
    },
    local: {
      getItem: (k: string) => local.get(k) ?? null,
      setItem(k: string, v: string) {
        if (state.quota) throw Error('QuotaExceededError');
        local.set(k, v);
      },
      removeItem(k: string) {
        local.delete(k);
      },
    },
    read: async () => copy(db) as ReturnType<typeof project> | undefined,
    write: async (_key: string, value: EditorDocument, accept: (v: unknown) => boolean) => {
      state.writes.push(value.title!);
      if (state.gate) await state.gate();
      if (state.dbFailure) throw Error('IDB unavailable');
      if (!accept(db)) return false;
      db = copy(value);
      return true;
    },
    remove: async (_key: string, accept: (v: unknown) => boolean) => {
      if (!accept(db)) return false;
      db = undefined;
      return true;
    },
  };
  return {
    options,
    state,
    local,
    setDB: (v: unknown) => {
      db = copy(v);
    },
    getDB: () => db as ReturnType<typeof stamped>,
    create: () => createProjectRecovery(options),
  };
}
test('legacy conflict retains local-first selection without inventing recency', async () => {
  const f = fixture();
  f.local.set(key, JSON.stringify(project('local')));
  f.setDB(project('idb'));
  assert.equal((await f.create().load())?.title, 'local');
});
test('newer IDB record outranks stale local quota copy; metadata stays out of project', async () => {
  const f = fixture();
  f.local.set(key, JSON.stringify(stamped('old', 50)));
  f.setDB(stamped('new', 51));
  const doc = await f.create().load();
  assert.equal(doc?.title, 'new');
  assert.equal('_ucRecovery' in doc!, false);
});
test('newer synchronous local copy outranks older asynchronous IDB record', async () => {
  const f = fixture();
  f.local.set(key, JSON.stringify(stamped('new', 52)));
  f.setDB(stamped('old', 51));
  assert.equal((await f.create().load())?.title, 'new');
});
test('invalid local JSON or invalid document does not hide a valid IDB document', async () => {
  const f = fixture();
  f.setDB(project('good'));
  for (const raw of ['{', JSON.stringify({ artId: 'other', layers: [] })]) {
    f.local.set(key, raw);
    assert.equal((await f.create().load())?.title, 'good');
  }
});
test('revisions reject unsafe/nonfinite values and advance after a backwards clock', async () => {
  for (const n of [NaN, Infinity, -1, 0, 1.5, Number.MAX_SAFE_INTEGER])
    assert.equal(recoveryStamp(stamped('invalid', n)), undefined);
  const f = fixture();
  f.setDB(stamped('seed', 300));
  const r = f.create();
  await r.load();
  await r.flush(project('new'));
  assert.equal(f.getDB()._ucRecovery.revision, 301);
});
test('local quota preserves the old backup while the exact new IDB snapshot recovers', async () => {
  const f = fixture();
  const raw = JSON.stringify(stamped('old', 30));
  f.local.set(key, raw);
  f.state.quota = true;
  const r = f.create();
  await r.load();
  const result = await r.flush(project('new'));
  assert.equal(result.indexedDB, true);
  assert.equal(f.local.get(key), raw);
  assert.equal((await r.load())?.title, 'new');
  assert.equal(f.local.get('unrelated-preference'), 'preserve');
});
test('IDB failure preserves a working synchronous local snapshot', async () => {
  const f = fixture();
  f.state.dbFailure = true;
  const r = f.create();
  const result = await r.flush(project('saved'));
  assert.equal(result.local, true);
  assert.equal(result.indexedDB, false);
  assert.equal(f.state.notices, 0);
  assert.equal((await r.load())?.title, 'saved');
});
test('both stores failing returns an explicit failure without deleting either old copy', async () => {
  const f = fixture();
  const raw = JSON.stringify(stamped('old', 30));
  f.local.set(key, raw);
  f.setDB(stamped('old', 30));
  f.state.dbFailure = f.state.quota = true;
  const r = f.create();
  await r.load();
  const result = await r.flush(project('new'));
  assert.equal(result.local || result.indexedDB, false);
  assert.equal(f.state.notices, 1);
  assert.equal(f.local.get(key), raw);
  assert.equal(f.getDB().title, 'old');
});
test('over-two-MB snapshot keeps the old local backup and uses IDB', async () => {
  const f = fixture();
  const raw = JSON.stringify(stamped('old', 30));
  f.local.set(key, raw);
  const r = f.create();
  await r.load();
  await r.flush({ ...project('large'), padding: 'x'.repeat(2000001) } as ReturnType<
    typeof project
  >);
  assert.equal(f.local.get(key), raw);
  assert.equal((await r.load())?.title, 'large');
});
test('async writes are serialized and a failed old operation does not poison newer writes', async () => {
  const f = fixture();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.state.gate = () => held;
  const r = f.create();
  const old = r.flush(project('old'));
  await tick();
  const next = r.flush(project('new'));
  await tick();
  assert.deepEqual(f.state.writes, ['old']);
  release();
  await Promise.all([old, next]);
  assert.deepEqual(f.state.writes, ['old', 'new']);
  assert.equal(f.getDB().title, 'new');
  f.state.dbFailure = true;
  await r.flush(project('failure'));
  f.state.dbFailure = false;
  await r.flush(project('after-failure'));
  assert.equal(f.getDB().title, 'after-failure');
});
test('bounded save timeout retains actual operation order for later writes', async () => {
  const f = fixture();
  f.options.timeout = 15;
  f.state.quota = true;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.state.gate = () => held;
  const r = f.create();
  const result = await r.flush(project('old'));
  assert.equal(result.timedOut, true);
  const next = r.flush(project('new'));
  await tick();
  assert.deepEqual(f.state.writes, ['old']);
  release();
  await next;
  assert.equal(f.getDB().title, 'new');
});
test('a newer cross-tab revision cannot be overwritten by a late old snapshot', async () => {
  const f = fixture();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.state.gate = () => held;
  const r = f.create();
  const old = r.flush(project('old'));
  await tick();
  f.setDB(stamped('other-tab-newer', 100));
  release();
  await old;
  assert.equal(f.getDB().title, 'other-tab-newer');
  assert.equal((await r.load())?.title, 'other-tab-newer');
});
test('explicit deletion is queued before later edits and removes no unrelated keys', async () => {
  const f = fixture();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.state.gate = () => held;
  const r = f.create();
  const old = r.flush(project('old'));
  await tick();
  const deletion = r.clear();
  const next = r.flush(project('after-delete'));
  release();
  await Promise.all([old, deletion, next]);
  assert.equal(f.getDB().title, 'after-delete');
  assert.equal(JSON.parse(f.local.get(key)!).title, 'after-delete');
  assert.equal(f.local.get('unrelated-preference'), 'preserve');
});
test('a hanging IDB read has a bounded fallback to the valid local copy', async () => {
  const f = fixture();
  f.local.set(key, JSON.stringify(project('local')));
  f.options.timeout = 15;
  f.options.read = () => new Promise(() => {});
  assert.equal((await f.create().load())?.title, 'local');
});

test('revision exhaustion reports recovery failure without interrupting normal editing', async () => {
  const f = fixture();
  const old = stamped('old', Number.MAX_SAFE_INTEGER - 1);
  f.local.set(key, JSON.stringify(old));
  f.setDB(old);
  const r = f.create();
  await r.load();
  assert.doesNotThrow(() => r.schedule(project('new')));
  assert.equal(f.state.notices, 1);
  assert.equal(f.getDB().title, 'old');
  await assert.rejects(r.flush(project('portable-backup')), /revision is out of range/);
});
test('portable save strips reserved recovery metadata even from an imported legacy file', () => {
  const doc = stamped('imported', 500);
  const clean = withoutRecoveryMetadata(doc);
  assert.equal('_ucRecovery' in clean, false);
  assert.equal(clean.title, 'imported');
  assert.deepEqual(clean.layers, doc.layers);
});
