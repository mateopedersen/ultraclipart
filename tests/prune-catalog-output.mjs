import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  symlinkSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruneCatalogOutput } from '../scripts/prune-catalog-output.mjs';

test('production omits staged catalog media while retaining UI files and source masters', () => {
  const root = mkdtempSync(join(tmpdir(), 'uc-catalog-output-'));
  try {
    const dist = join(root, 'dist');
    mkdirSync(join(dist, 'catalog', 'unpublished-wave'), { recursive: true });
    mkdirSync(join(root, 'public', 'catalog'), { recursive: true });
    writeFileSync(join(dist, 'catalog', 'unpublished-wave', 'pending.webp'), 'not reviewed');
    writeFileSync(join(dist, 'logo.svg'), 'keep UI');
    writeFileSync(join(root, 'public', 'catalog', 'source.webp'), 'keep master');
    pruneCatalogOutput(dist);
    pruneCatalogOutput(dist);
    assert.equal(existsSync(join(dist, 'catalog')), false);
    assert.equal(readFileSync(join(dist, 'logo.svg'), 'utf8'), 'keep UI');
    assert.equal(
      readFileSync(join(root, 'public', 'catalog', 'source.webp'), 'utf8'),
      'keep master',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('catalog cleanup unlinks an output symlink without following it into source files', () => {
  const root = mkdtempSync(join(tmpdir(), 'uc-catalog-link-'));
  try {
    mkdirSync(join(root, 'dist'));
    mkdirSync(join(root, 'masters'));
    writeFileSync(join(root, 'masters', 'original.webp'), 'keep');
    symlinkSync(join(root, 'masters'), join(root, 'dist', 'catalog'), 'dir');
    pruneCatalogOutput(join(root, 'dist'));
    assert.equal(existsSync(join(root, 'dist', 'catalog')), false);
    assert.equal(readFileSync(join(root, 'masters', 'original.webp'), 'utf8'), 'keep');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
