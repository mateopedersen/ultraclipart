import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import {
  preparePreviewAssets,
  previewUrls,
  previewIdentity,
  readPreviewIndex,
} from '../scripts/preview-assets.mjs';
const sha = (b) => createHash('sha256').update(b).digest('hex');
test('responsive presentation copies preserve originals, alpha, aspect ratio and exact source binding', async () => {
  const root = mkdtempSync(join(tmpdir(), 'uc-previews-'));
  try {
    mkdirSync(join(root, 'public/catalog/test'), { recursive: true });
    const original = await sharp({
      create: {
        width: 1000,
        height: 1400,
        channels: 4,
        background: { r: 30, g: 90, b: 180, alpha: 0.5 },
      },
    })
      .webp({ lossless: true })
      .toBuffer();
    const thumb = await sharp(original).resize({ height: 440 }).webp({ lossless: true }).toBuffer();
    const item = {
      id: 'test-art',
      published: true,
      indexable: true,
      thumb: '/catalog/test/thumb.webp',
      webp: '/catalog/test/original.webp',
      files: { thumb: { sha256: sha(thumb) }, webp: { sha256: sha(original) } },
    };
    writeFileSync(join(root, 'public', item.thumb), thumb);
    writeFileSync(join(root, 'public', item.webp), original);
    assert.equal((await preparePreviewAssets([item], root)).generated, 4);
    const urls = previewUrls(item),
      record = readPreviewIndex(root)[previewIdentity(item)];
    for (const size of [96, 220, 440, 960]) {
      const bytes = readFileSync(join(root, 'public', urls[size]));
      const meta = await sharp(bytes).metadata();
      assert.equal(meta.format, 'webp');
      assert.equal(meta.hasAlpha, true);
      assert.equal(meta.width, record.files[size].width);
      assert.equal(meta.height, record.files[size].height);
      assert.ok(Math.abs(meta.width / meta.height - 1000 / 1400) < 0.015);
      assert.equal(sha(bytes), record.files[size].sha256);
    }
    assert.deepEqual(readFileSync(join(root, 'public', item.webp)), original);
    assert.deepEqual(readFileSync(join(root, 'public', item.thumb)), thumb);
    assert.equal((await preparePreviewAssets([item], root)).reused, 4);
    const changed = { ...item, files: { ...item.files, webp: { sha256: 'a'.repeat(64) } } };
    assert.notEqual(previewUrls(changed)[440], urls[440]);
    await assert.rejects(preparePreviewAssets([changed], root), /Changed original/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('unsafe paths and unverified sources cannot create previews', () => {
  assert.throws(() => previewIdentity({ id: 'bad', thumb: '/../private', webp: '/valid.webp' }));
  assert.throws(
    () => previewIdentity({ id: 'bad', thumb: '/thumb.webp', webp: '/valid.webp' }),
    /verified/,
  );
});

test('large detailed previews get a reusable 640px copy, and a damaged cache is repaired', async () => {
  const root = mkdtempSync(join(tmpdir(), 'uc-medium-preview-'));
  try {
    mkdirSync(join(root, 'public/catalog/test'), { recursive: true });
    const original = await sharp(randomBytes(1000 * 1400 * 3), {
      raw: { width: 1000, height: 1400, channels: 3 },
    })
      .webp({ lossless: true })
      .toBuffer();
    const thumb = await sharp(original).resize({ height: 440 }).webp({ quality: 80 }).toBuffer();
    const item = {
      id: 'noisy-preview',
      published: true,
      indexable: true,
      thumb: '/catalog/test/thumb.webp',
      webp: '/catalog/test/original.webp',
      files: { thumb: { sha256: sha(thumb) }, webp: { sha256: sha(original) } },
    };
    writeFileSync(join(root, 'public', item.thumb), thumb);
    writeFileSync(join(root, 'public', item.webp), original);
    assert.equal((await preparePreviewAssets([item], root)).generated, 5);
    const index = readPreviewIndex(root)[previewIdentity(item)],
      url = previewUrls(item)[640],
      file = join(root, 'public', url);
    assert.equal(index.files[640].height, 640);
    assert.equal(sha(readFileSync(file)), index.files[640].sha256);
    assert.equal((await preparePreviewAssets([item], root)).reused, 5);
    writeFileSync(file, Buffer.from('damaged local generated cache'));
    assert.equal((await preparePreviewAssets([item], root)).generated, 1);
    assert.equal(sha(readFileSync(file)), index.files[640].sha256);
    assert.deepEqual(readFileSync(join(root, 'public', item.webp)), original);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('topic-leading thumbnails get a source-bound 320px choice without multiplying the whole library', async () => {
  const root = mkdtempSync(join(tmpdir(), 'uc-topic-preview-'));
  try {
    mkdirSync(join(root, 'public/catalog/test'), { recursive: true });
    const items = [];
    for (let i = 0; i < 3; i++) {
      const original = await sharp({
        create: {
          width: 1000,
          height: 1000,
          channels: 4,
          background: { r: 40 + i * 40, g: 80, b: 140, alpha: 0.5 },
        },
      })
        .webp({ lossless: true })
        .toBuffer();
      const thumb = await sharp(original).resize(440).webp({ lossless: true }).toBuffer();
      const item = {
        id: `topic-art-${i}`,
        topic: 'sample-topic',
        style: 'Color',
        published: true,
        indexable: true,
        thumb: `/catalog/test/thumb-${i}.webp`,
        webp: `/catalog/test/original-${i}.webp`,
        files: { thumb: { sha256: sha(thumb) }, webp: { sha256: sha(original) } },
      };
      writeFileSync(join(root, 'public', item.thumb), thumb);
      writeFileSync(join(root, 'public', item.webp), original);
      items.push(item);
    }
    const stats = await preparePreviewAssets(items, root),
      index = readPreviewIndex(root);
    assert.equal(stats.generated, 14);
    for (const item of items.slice(0, 2)) {
      const record = index[previewIdentity(item)];
      assert.equal(record.files[320].width, 320);
      const bytes = readFileSync(join(root, 'public', previewUrls(item)[320]));
      assert.equal(sha(bytes), record.files[320].sha256);
      assert.equal((await sharp(bytes).metadata()).hasAlpha, true);
    }
    assert.equal(index[previewIdentity(items[2])].files[320], undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
