import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { runPackagePipeline } from '../scripts/package-pipeline.mjs';

test(
  'one uploader overlaps one ordered verifier, with each topic waiting for its own upload',
  { timeout: 2000 },
  async () => {
    let verifyingFirst, finishFirst;
    const verificationStarted = new Promise((accept) => {
      verifyingFirst = accept;
    });
    const secondUploadStarted = new Promise((accept) => {
      finishFirst = accept;
    });
    const uploaded = [],
      verified = [],
      events = [];
    let activeUploads = 0,
      activeVerifiers = 0,
      maxUploads = 0,
      maxVerifiers = 0;
    await runPackagePipeline(
      ['one', 'two', 'three'],
      async (topic) => {
        maxUploads = Math.max(maxUploads, ++activeUploads);
        if (topic === 'two') {
          await verificationStarted;
          events.push('upload-two-start');
          finishFirst();
        }
        await delay(2);
        uploaded.push(topic);
        activeUploads--;
      },
      async (topic) => {
        assert.ok(uploaded.includes(topic), topic);
        maxVerifiers = Math.max(maxVerifiers, ++activeVerifiers);
        if (topic === 'one') {
          verifyingFirst();
          await secondUploadStarted;
          events.push('verify-one-finish');
        }
        verified.push(topic);
        activeVerifiers--;
      },
    );
    assert.deepEqual(uploaded, ['one', 'two', 'three']);
    assert.deepEqual(verified, uploaded);
    assert.equal(maxUploads, 1);
    assert.equal(maxVerifiers, 1);
    assert.deepEqual(events, ['upload-two-start', 'verify-one-finish']);
  },
);

test('an upload failure wakes the verifier without verifying an incomplete or later topic', async () => {
  const verified = [],
    uploads = [];
  await assert.rejects(
    runPackagePipeline(
      ['one', 'two', 'three'],
      async (topic) => {
        uploads.push(topic);
        if (topic === 'two') throw Error('upload failed');
        await delay(1);
      },
      async (topic) => {
        verified.push(topic);
        await delay(2);
      },
    ),
    /upload failed/,
  );
  assert.deepEqual(uploads, ['one', 'two']);
  assert.ok(verified.every((topic) => topic === 'one'));
});

test('a verifier failure drains the active upload and prevents another wave', async () => {
  const uploads = [];
  let active = 0;
  await assert.rejects(
    runPackagePipeline(
      ['one', 'two', 'three'],
      async (topic) => {
        uploads.push(topic);
        active++;
        try {
          await delay(topic === 'two' ? 15 : 1);
        } finally {
          active--;
        }
      },
      async () => {
        throw Error('CDN mismatch');
      },
    ),
    /CDN mismatch/,
  );
  assert.equal(active, 0);
  assert.deepEqual(uploads, ['one', 'two']);
});
