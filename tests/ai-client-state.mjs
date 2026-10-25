import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypescript } from './helpers/typescript.mjs';
import { previewAiResponse } from '../scripts/ai-preview.mjs';
const { readAiResponse, generationQuota, quotaRetryAt } = await loadTypescript('src/ai/api.ts');
const { incomingIdea } = await loadTypescript('src/ai/prompt-transfer.ts');
const { translateDescription } = await loadTypescript('server/ai/provider.mjs');
const { history } = await loadTypescript('src/ai/storage.ts');
const quota = {
  enabled: true,
  remaining: 2,
  globalRemaining: 24,
  resetAt: '2026-10-26T00:00:00.000Z',
  sitekey: 'public-key',
  model: '@cf/black-forest-labs/flux-1-schnell',
  cooldownUntil: null,
};
test('AI responses identify a missing local endpoint and never expose an HTML error document', async () => {
  await assert.rejects(
    readAiResponse(
      new Response('<html>404</html>', { status: 404, headers: { 'Content-Type': 'text/html' } }),
    ),
    { code: 'service_not_configured', status: 404 },
  );
  await assert.rejects(
    readAiResponse(new Response('<html>upstream failure</html>', { status: 502 })),
    { code: 'invalid_service_response' },
  );
});
test('local preview reports the missing runtime explicitly and never intercepts unrelated APIs', () => {
  assert.equal(previewAiResponse('/api/ai/clipart/quota/', 'GET').status, 503);
  assert.equal(
    previewAiResponse('/api/ai/clipart/generate', 'POST').body.error,
    'service_not_configured',
  );
  assert.equal(previewAiResponse('/api/ai/clipart/health', 'GET').body.enabled, false);
  assert.equal(previewAiResponse('/api/ai/clipart/generate', 'GET').status, 405);
  assert.equal(previewAiResponse('/api/share/quota', 'GET'), undefined);
});
test('server errors retain their actual status and code across quota refresh', async () => {
  for (const [status, error] of [
    [403, 'verification_failed'],
    [422, 'content_blocked'],
    [429, 'capacity_or_rate_limit'],
    [503, 'generation_unavailable'],
  ])
    await assert.rejects(readAiResponse(Response.json({ error }, { status })), {
      code: error,
      status,
    });
});
test('malformed or non-object JSON is rejected as a service failure', async () => {
  for (const value of [null, [], 3, 'not an object'])
    await assert.rejects(readAiResponse(Response.json(value)), {
      code: 'invalid_service_response',
    });
  await assert.rejects(
    readAiResponse(new Response('{', { headers: { 'Content-Type': 'application/json' } })),
    { code: 'invalid_service_response' },
  );
  assert.deepEqual(await readAiResponse(Response.json({ image: 'valid' })), { image: 'valid' });
});
test('quota uses the server visitor limit and supports the previous response format', () => {
  assert.equal(generationQuota(quota).visitorLimit, 2);
  assert.equal(generationQuota({ ...quota, visitorLimit: 3 }).visitorLimit, 3);
  for (const invalid of [
    { remaining: -1 },
    { globalRemaining: NaN },
    { remaining: 1.5 },
    { sitekey: '' },
    { resetAt: 'invalid' },
    { cooldownUntil: 'bad' },
    { enabled: 'true' },
    { visitorLimit: 0 },
  ])
    assert.throws(() => generationQuota({ ...quota, ...invalid }), {
      code: 'invalid_service_response',
    });
});
test('network cooldown, UTC reset and expired cooldown have distinct retry deadlines', () => {
  const now = Date.parse('2026-10-25T10:00:00Z');
  assert.equal(
    quotaRetryAt(generationQuota({ ...quota, cooldownUntil: '2026-10-25T10:01:00Z' }), now),
    now + 60000,
  );
  assert.equal(
    quotaRetryAt(generationQuota({ ...quota, remaining: 0 }), now),
    Date.parse(quota.resetAt),
  );
  assert.equal(
    quotaRetryAt(generationQuota({ ...quota, cooldownUntil: '2026-10-25T09:59:00Z' }), now),
    undefined,
  );
  assert.equal(quotaRetryAt(generationQuota({ ...quota, enabled: false }), now), undefined);
});
const store = (value) => ({ getItem: () => JSON.stringify(value), removeItem: () => {} });
test('a private fragment carries the exact Unicode idea even when storage is blocked', () => {
  const prompt = 'Üç mavi balon — 黄色 🐘';
  const hash = '#' + new URLSearchParams({ idea: prompt });
  const blocked = {
    getItem() {
      throw Error('blocked');
    },
    removeItem() {
      throw Error('blocked');
    },
  };
  assert.equal(incomingIdea(blocked, hash).prompt, prompt);
  assert.equal(incomingIdea(undefined, hash).prompt, prompt);
  assert.equal(incomingIdea(blocked, hash + '&style=watercolor').style, 'watercolor');
});
test('explicit fragment replaces stale session ideas and valid stored styles survive normal transfer', () => {
  const now = Date.parse('2026-10-25T10:00:00Z');
  const value = { prompt: 'A fox with a pencil', style: 'watercolor', createdAt: now - 1000 };
  assert.deepEqual(incomingIdea(store(value), '', now), {
    prompt: value.prompt,
    style: value.style,
  });
  assert.equal(
    incomingIdea(store(value), '#idea=A+different+idea', now).prompt,
    'A different idea',
  );
  for (const createdAt of [now + 1, now - 3600000, 'not a date', null])
    assert.equal(incomingIdea(store({ ...value, createdAt }), '', now), undefined);
});
test('bad session JSON does not suppress fragment transfer and fragments respect prompt bounds', () => {
  assert.equal(
    incomingIdea({ getItem: () => '{', removeItem() {} }, '#idea=A+small+fox').prompt,
    'A small fox',
  );
  assert.equal(incomingIdea(undefined, '#idea=' + 'x'.repeat(1500)).prompt.length, 1200);
  assert.equal(incomingIdea(undefined, '#idea=++'), undefined);
});
test('malformed moderation output is a service failure, not a false content rejection', async () => {
  for (const allowed of [undefined, null, 'true', 1])
    await assert.rejects(
      translateDescription(
        { run: async () => ({ response: { allowed, englishPrompt: 'A small fox' } }) },
        'A small fox',
      ),
      { code: 'translation_unavailable' },
    );
  await assert.rejects(
    translateDescription(
      { run: async () => ({ response: { allowed: false, englishPrompt: '' } }) },
      'A small fox',
    ),
    { code: 'content_blocked' },
  );
});
test('blocked history storage rejects promptly and closes a late connection', async () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  let closed = 0;
  const request = {
    result: {
      close() {
        closed++;
      },
    },
  };
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: {
      open() {
        queueMicrotask(() => request.onblocked());
        return request;
      },
    },
  });
  try {
    await assert.rejects(history('read'), /Local storage is unavailable/);
    request.onsuccess();
    assert.equal(closed, 1);
  } finally {
    if (saved) Object.defineProperty(globalThis, 'indexedDB', saved);
    else delete globalThis.indexedDB;
  }
});
test('aborted history transactions reject and close the database', async () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  let closed = 0;
  const transaction = {
    objectStore() {
      return {
        getAll() {
          queueMicrotask(() => transaction.onabort());
          return {};
        },
      };
    },
  };
  const request = {
    result: {
      transaction() {
        return transaction;
      },
      close() {
        closed++;
      },
    },
  };
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: {
      open() {
        queueMicrotask(() => request.onsuccess());
        return request;
      },
    },
  });
  try {
    await assert.rejects(history('read'), /could not save/);
    assert.equal(closed, 1);
  } finally {
    if (saved) Object.defineProperty(globalThis, 'indexedDB', saved);
    else delete globalThis.indexedDB;
  }
});
