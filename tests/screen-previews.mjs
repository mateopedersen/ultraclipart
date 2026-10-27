import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { screenPreview } from '../src/lib/screen-preview.ts';

test('screenshot previews preserve the requested crop and invalidate on a changed source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'uc-screen-preview-'));
  const original = process.cwd();
  try {
    process.chdir(root);
    await mkdir('public/guide-screens', { recursive: true });
    const file = 'public/guide-screens/example.png';
    await sharp({ create: { width: 120, height: 80, channels: 4, background: '#3366ff' } })
      .png()
      .toFile(file);
    const source = await readFile(file);
    const urls = await Promise.all([
      screenPreview('/guide-screens/example.png', [10, 5, 60, 40]),
      screenPreview('/guide-screens/example.png', [10, 5, 60, 40]),
    ]);
    assert.equal(urls[0], urls[1]);
    const result = await sharp(join(root, 'public', urls[0])).metadata();
    assert.equal(result.width, 60);
    assert.equal(result.height, 40);
    assert.equal(result.format, 'webp');
    assert.deepEqual(await readFile(file), source, 'original capture must not change');
    assert.notEqual(await screenPreview('/guide-screens/example.png', [10, 5, 30, 40]), urls[0]);
    await sharp({ create: { width: 120, height: 80, channels: 4, background: '#ff6633' } })
      .png()
      .toFile(file);
    assert.notEqual(await screenPreview('/guide-screens/example.png', [10, 5, 60, 40]), urls[0]);
    await assert.rejects(screenPreview('/guide-screens/../../outside.png', [0, 0, 10, 10]));
    await assert.rejects(screenPreview('/guide-screens/example.png', [0, 0, 0, 10]));
    await assert.rejects(screenPreview('/guide-screens/example.png', [115, 0, 20, 10]));
  } finally {
    process.chdir(original);
    await rm(root, { recursive: true, force: true });
  }
});
