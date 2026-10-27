import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { activatePreview } from '../scripts/performance/release.mjs';

test('only complete preview releases replace the active site', () => {
  const root = mkdtempSync(join(tmpdir(), 'uc-preview-'));
  const create = (name) => {
    const directory = join(root, name);
    for (const file of ['index.html', '404.html', 'art/sunflower-straw-hat/index.html']) {
      const path = join(directory, file);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, `<html>${name}</html>`);
    }
    return directory;
  };
  try {
    const current = create('current');
    const first = create('first');
    activatePreview(first, current);
    const incomplete = join(root, 'incomplete');
    mkdirSync(incomplete);
    assert.throws(() => activatePreview(incomplete, current), /Incomplete preview/);
    assert.equal(realpathSync(current), realpathSync(first));
    assert.match(readFileSync(join(current, 'index.html'), 'utf8'), /first/);
    const next = create('next');
    activatePreview(next, current);
    assert.equal(realpathSync(current), realpathSync(next));
    assert.match(readFileSync(join(first, 'index.html'), 'utf8'), /first/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
