import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readVerified, prefetchVerified } from '../src/editor/verified-fetch.ts';
const origin = 'https://ultraclipart.com',
  bytes = new TextEncoder().encode('verified original source');
const file = {
  url: '/catalog/test/original.webp',
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
};
const response = (body) => new Response(body, { headers: { 'Content-Type': 'image/webp' } });
test('verified originals can use the HTTP cache without dropping origin, credentials, redirect or hash checks', async () => {
  const previous = globalThis.fetch,
    calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      return response(bytes);
    };
    assert.deepEqual(await readVerified(file, 'webp', origin), bytes);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.cache, 'default');
    assert.equal(calls[0].options.credentials, 'omit');
    assert.equal(calls[0].options.redirect, 'error');
    assert.equal(calls[0].options.mode, 'cors');
    assert.equal(calls[0].options.priority, 'high');
    await assert.rejects(
      readVerified({ ...file, url: 'https://attacker.invalid/x.webp' }, 'webp', origin),
    );
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = previous;
  }
});
test('a stale same-size browser copy is repaired once and the replacement must verify', async () => {
  const previous = globalThis.fetch,
    calls = [];
  try {
    globalThis.fetch = async (_url, options) => {
      calls.push(options.cache);
      return response(calls.length === 1 ? new Uint8Array(bytes.length) : bytes);
    };
    assert.deepEqual(await readVerified(file, 'webp', origin), bytes);
    assert.deepEqual(calls, ['default', 'reload']);
    calls.length = 0;
    globalThis.fetch = async (_url, options) => {
      calls.push(options.cache);
      return response(new Uint8Array(bytes.length));
    };
    await assert.rejects(readVerified(file, 'webp', origin), /verification failed/);
    assert.deepEqual(calls, ['default', 'reload']);
  } finally {
    globalThis.fetch = previous;
  }
});
test('oversized copies remain bounded and network errors do not cause repeated retries', async () => {
  const previous = globalThis.fetch,
    calls = [];
  try {
    globalThis.fetch = async (_url, options) => {
      calls.push(options.cache);
      return response(new Uint8Array(bytes.length + 1));
    };
    await assert.rejects(readVerified(file, 'webp', origin), /exceeds/);
    assert.deepEqual(calls, ['default', 'reload']);
    calls.length = 0;
    globalThis.fetch = async (_url, options) => {
      calls.push(options.cache);
      throw Error('offline');
    };
    await assert.rejects(readVerified(file, 'webp', origin), /offline/);
    assert.deepEqual(calls, ['default']);
  } finally {
    globalThis.fetch = previous;
  }
});

test('early verified loading is consumed once, without a duplicate request or skipped hash check', async () => {
  const previous = globalThis.fetch;
  let calls = 0,
    release;
  try {
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    globalThis.fetch = async () => {
      calls++;
      await gate;
      return response(bytes);
    };
    prefetchVerified(file, 'webp', origin);
    prefetchVerified(file, 'webp', origin);
    const result = readVerified(file, 'webp', origin);
    assert.equal(calls, 1);
    release();
    assert.deepEqual(await result, bytes);
    assert.equal(calls, 1);
    assert.deepEqual(await readVerified(file, 'webp', origin), bytes);
    assert.equal(calls, 2, 'consumed raw bytes are not retained indefinitely');
  } finally {
    release?.();
    globalThis.fetch = previous;
  }
});
test('an early failed verification still blocks the editor and can be retried explicitly', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return response(new Uint8Array(bytes.length));
    };
    prefetchVerified(file, 'webp', origin);
    await assert.rejects(readVerified(file, 'webp', origin), /verification failed/);
    assert.equal(calls, 2);
    globalThis.fetch = async () => response(bytes);
    assert.deepEqual(await readVerified(file, 'webp', origin), bytes);
  } finally {
    globalThis.fetch = previous;
  }
});
