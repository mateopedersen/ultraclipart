import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  symlinkSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import {
  copyPublicInterfaceAssets,
  productionPublicAssets,
} from '../scripts/production-public-assets.mjs';

test('production copies exact UI bytes without copying or traversing catalog originals and drafts', () => {
  const root = mkdtempSync(join(tmpdir(), 'uc-public-assets-'));
  try {
    const source = join(root, 'public'),
      output = join(root, 'dist'),
      originals = join(root, 'originals');
    mkdirSync(join(source, 'fonts'), { recursive: true });
    mkdirSync(originals);
    mkdirSync(output);
    writeFileSync(join(originals, 'pending.webp'), 'unpublished source');
    symlinkSync(originals, join(source, 'catalog'), 'dir');
    const font = Buffer.from([0, 17, 255, 61]);
    writeFileSync(join(source, 'fonts', 'reader.woff2'), font);
    writeFileSync(join(source, '_headers'), 'exact headers');
    writeFileSync(join(output, 'generated.html'), 'keep generated page');
    const result = copyPublicInterfaceAssets(source, output);
    assert.deepEqual(result, { files: 2, bytes: font.length + Buffer.byteLength('exact headers') });
    assert.deepEqual(readFileSync(join(output, 'fonts', 'reader.woff2')), font);
    assert.equal(readFileSync(join(output, '_headers'), 'utf8'), 'exact headers');
    assert.equal(existsSync(join(output, 'catalog')), false);
    assert.equal(readFileSync(join(originals, 'pending.webp'), 'utf8'), 'unpublished source');
    assert.equal(readFileSync(join(output, 'generated.html'), 'utf8'), 'keep generated page');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the production hook disables the actual Astro client copy while local builds retain their normal behavior', () => {
  const root = mkdtempSync(join(tmpdir(), 'uc-public-hook-'));
  try {
    const source = join(root, 'public'),
      output = join(root, 'dist');
    mkdirSync(source);
    writeFileSync(join(source, 'logo.svg'), '<svg/>');
    const local = productionPublicAssets(false);
    local.hooks['astro:build:setup']({ updateConfig: () => assert.fail('local config changed') });
    assert.equal(existsSync(output), false);
    const integration = productionPublicAssets(true);
    let update;
    integration.hooks['astro:config:done']({ config: { publicDir: pathToFileURL(source + '/') } });
    integration.hooks['astro:build:setup']({
      vite: { environments: { client: { build: { outDir: output } } } },
      updateConfig: (value) => {
        update = value;
      },
    });
    assert.deepEqual(update.environments.client.build, {
      copyPublicDir: false,
      emptyOutDir: false,
    });
    assert.equal(readFileSync(join(output, 'logo.svg'), 'utf8'), '<svg/>');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('public interface copying rejects symlinks instead of exposing external files', () => {
  const root = mkdtempSync(join(tmpdir(), 'uc-public-link-'));
  try {
    const source = join(root, 'public'),
      output = join(root, 'dist');
    mkdirSync(source);
    writeFileSync(join(root, 'private.txt'), 'do not publish');
    symlinkSync(join(root, 'private.txt'), join(source, 'leak.txt'));
    assert.throws(() => copyPublicInterfaceAssets(source, output), /must not be symlinks/);
    assert.equal(existsSync(join(output, 'leak.txt')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('unexpected client output and recursive public output fail before copying', () => {
  const root = mkdtempSync(join(tmpdir(), 'uc-public-boundary-'));
  try {
    const source = join(root, 'public');
    mkdirSync(source);
    assert.throws(() => copyPublicInterfaceAssets(source, source), /outside public/);
    assert.throws(
      () => copyPublicInterfaceAssets(source, join(source, 'nested')),
      /outside public/,
    );
    assert.throws(
      () => copyPublicInterfaceAssets(source, join(source, '..nested')),
      /outside public/,
    );
    const integration = productionPublicAssets(true);
    integration.hooks['astro:config:done']({ config: { publicDir: pathToFileURL(source + '/') } });
    assert.throws(
      () => integration.hooks['astro:build:setup']({ vite: {}, updateConfig() {} }),
      /client output directory/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
