import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ALL_SUITES,
  selectSuites,
  parseDiff,
  eventRange,
  planForEvent,
} from '../scripts/ci-plan.mjs';

const modified = (...paths) => paths.map((path) => ({ status: 'M', path }));
const base = 'a'.repeat(40),
  head = 'b'.repeat(40);
const event = { pull_request: { base: { sha: base }, head: { sha: head } } };

test('documentation and CI policy changes avoid unrelated browser exports', () => {
  assert.deepEqual(
    selectSuites(
      modified(
        'README.md',
        'docs/release.md',
        '.github/workflows/ci.yml',
        'scripts/ci-plan.mjs',
        'tests/ci-plan.mjs',
      ),
    ).suites,
    [],
  );
});
test('isolated artwork presentation keeps all interface browser checks', () => {
  for (const path of [
    'src/components/ArtworkFacts.astro',
    'src/components/FileGuideIllustration.astro',
    'src/components/RelatedArtwork.astro',
    'src/styles/related.css',
    'src/pages/guides/index.astro',
    'tests/e2e/related.mjs',
  ])
    assert.deepEqual(
      selectSuites(modified(path)).suites,
      ['interface-core', 'interface-artwork', 'interface-pages'],
      path,
    );
});
test('split workflow retains every interface command and catalog-extra export exactly once', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  for (const name of [
    'search',
    'categories',
    'header',
    'artwork-details',
    'related',
    'sharing',
    'site',
    'refinement',
    'content',
  ])
    assert.equal(
      workflow.split(`node tests/e2e/${name}.mjs`).length - 1,
      1,
      `Browser command ${name} must run once per engine`,
    );
  for (const topic of [
    'earbuds',
    'printer',
    'keyboard',
    'scanner',
    'tablet',
    'speaker',
    'wifi-router',
    'robot',
    'camera',
  ])
    assert.equal(
      workflow.split(`RASTER_TOPICS=${topic} ALL_RASTER=1`).length - 1,
      1,
      `Export command ${topic} must run once per engine`,
    );
  assert.equal(workflow.split('SOURCE_COLLECTION=owner-book-pack-2026-10-24').length - 1, 1);
  for (const suite of ALL_SUITES) assert.ok(workflow.includes(suite), suite);
});
test('global, editor, catalog, security, dependencies and unknown files always get full validation', () => {
  for (const path of [
    'src/editor/editor.ts',
    'src/styles/creator.css',
    'src/styles/global.css',
    'src/layouts/Layout.astro',
    'src/lib/related/engine.ts',
    'data/art.json',
    'data/publication.json',
    'public/logo.svg',
    'package.json',
    'pnpm-lock.yaml',
    'astro.config.mjs',
    'server/auth.mjs',
    'scripts/security-headers.mjs',
    'tests/helpers/creator.mjs',
    'tests/e2e/raster-editor.mjs',
    'docs/runtime.js',
    '.github/workflows/release.yml',
    'unexpected.txt',
  ])
    assert.deepEqual(selectSuites(modified(path)).suites, ALL_SUITES, path);
});
test('mixed changes take the broadest scope regardless of ordering', () => {
  for (const paths of [
    ['src/styles/related.css', 'data/art.json'],
    ['data/art.json', 'README.md'],
  ])
    assert.deepEqual(selectSuites(modified(...paths)).suites, ALL_SUITES);
});
test('isolated Studio tests retain all three browser engines through the complete Studio group', () => {
  for (const path of ['tests/e2e/studio-tools.mjs', 'tests/smart-selection.mjs']) {
    assert.deepEqual(selectSuites(modified(path)).suites, ['studio']);
    assert.deepEqual(selectSuites(modified(path), { forceFull: true }).suites, ALL_SUITES);
    for (const status of ['D', 'T'])
      assert.deepEqual(selectSuites([{ status, path }]).suites, ALL_SUITES);
    for (const runtime of [
      'src/editor/smart/pixels.ts',
      'src/editor/smart/controller.ts',
      'src/editor/editor.ts',
      'data/art.json',
      'tests/helpers/creator.mjs',
    ])
      assert.deepEqual(selectSuites(modified(path, runtime)).suites, ALL_SUITES);
  }
  assert.deepEqual(
    selectSuites(modified('tests/e2e/studio-tools.mjs', 'src/styles/related.css')).suites,
    ['interface-core', 'interface-artwork', 'interface-pages', 'studio'],
  );
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert(workflow.includes('engine: [chromium, firefox, webkit]'));
  assert(workflow.includes('needs: [plan, unit, production, browser]'));
});
test('missing, empty, invalid and manually forced plans fail open to full validation', () => {
  for (const changes of [
    null,
    undefined,
    [],
    [{ path: 'README.md' }],
    [{ status: 'M' }],
    [{ status: 'R', path: 'src/styles/related.css' }],
  ])
    assert.deepEqual(selectSuites(changes).suites, ALL_SUITES);
  assert.deepEqual(selectSuites(modified('README.md'), { forceFull: true }).suites, ALL_SUITES);
});
test('runtime deletions and type changes get the full suite', () => {
  for (const status of ['D', 'T'])
    assert.deepEqual(selectSuites([{ status, path: 'src/styles/related.css' }]).suites, ALL_SUITES);
});
test('NUL parsing preserves spaces and does not silently truncate a large diff', () => {
  assert.deepEqual(parseDiff('M\0docs/a file.md\0D\0src/old.ts\0'), [
    { status: 'M', path: 'docs/a file.md' },
    { status: 'D', path: 'src/old.ts' },
  ]);
  const raw =
    Array.from({ length: 2000 }, (_, i) => `M\0docs/${i}.md\0`).join('') + 'M\0data/art.json\0';
  assert.equal(parseDiff(raw).length, 2001);
  assert.deepEqual(selectSuites(parseDiff(raw)).suites, ALL_SUITES);
  for (const raw of ['M\0docs/a.md', 'R100\0old\0new\0', 'M\0', 'M\0a\nb\0'])
    assert.throws(() => parseDiff(raw));
});
test('PR and push use exact validated commit SHAs; manual/zero/unsafe refs force full', () => {
  assert.deepEqual(eventRange('pull_request', event), { base, head });
  assert.deepEqual(eventRange('push', { before: base, after: head }), { base, head });
  for (const [name, payload] of [
    ['workflow_dispatch', event],
    ['push', { before: '0'.repeat(40), after: head }],
    ['push', { before: '--anything', after: head }],
    ['pull_request', {}],
  ])
    assert.equal(eventRange(name, payload), null);
});
test('diff failure or malformed data cannot produce a successful skipped browser plan', () => {
  assert.deepEqual(
    planForEvent('pull_request', event, () => {
      throw new Error('missing git object');
    }).suites,
    ALL_SUITES,
  );
  assert.deepEqual(planForEvent('pull_request', event, () => 'bad diff').suites, ALL_SUITES);
  assert.deepEqual(planForEvent('pull_request', event, () => '').suites, ALL_SUITES);
  assert.deepEqual(
    planForEvent('workflow_dispatch', {}, () => 'M\0README.md\0').suites,
    ALL_SUITES,
  );
});
test('renames are represented as deletion + addition and runtime moves remain fully covered', () => {
  assert.deepEqual(
    planForEvent('pull_request', event, (from, to) => {
      assert.equal(from, base);
      assert.equal(to, head);
      return 'D\0src/styles/related.css\0A\0src/styles/new-related.css\0';
    }).suites,
    ALL_SUITES,
  );
});

test('real Git diff retains both paths of a move and detects a runtime deletion', () => {
  const directory = mkdtempSync(join(tmpdir(), 'uc-ci-plan-'));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
  try {
    git('init', '--quiet');
    writeFileSync(join(directory, 'runtime.ts'), 'export const a = 1;\n');
    git('add', 'runtime.ts');
    git(
      '-c',
      'user.name=CI policy test',
      '-c',
      'user.email=ci@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'base',
    );
    const before = git('rev-parse', 'HEAD').trim();
    git('mv', 'runtime.ts', 'renamed.ts');
    git(
      '-c',
      'user.name=CI policy test',
      '-c',
      'user.email=ci@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'move',
    );
    const after = git('rev-parse', 'HEAD').trim();
    const changes = parseDiff(
      git('diff', '--no-renames', '--name-status', '-z', before, after, '--'),
    );
    assert.deepEqual(new Set(changes.map((entry) => entry.status)), new Set(['A', 'D']));
    assert.deepEqual(selectSuites(changes).suites, ALL_SUITES);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('required check accepts skips only after a successful explicit no-browser plan', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const gate = workflow.slice(workflow.indexOf('          test "$PLAN_RESULT" = success')).trim();
  assert.ok(gate.includes('case "$RUN_BROWSER"'));
  for (const planResult of ['success', 'failure', 'cancelled', 'skipped'])
    for (const runBrowser of ['true', 'false', ''])
      for (const browserResult of ['success', 'failure', 'cancelled', 'skipped']) {
        for (const unitResult of ['success', 'failure', 'cancelled', 'skipped'])
          for (const productionResult of ['success', 'failure', 'cancelled', 'skipped']) {
            const passed =
              spawnSync('bash', ['-e', '-c', gate], {
                env: {
                  ...process.env,
                  PLAN_RESULT: planResult,
                  RUN_BROWSER: runBrowser,
                  UNIT_RESULT: unitResult,
                  PRODUCTION_RESULT: productionResult,
                  BROWSER_RESULT: browserResult,
                },
              }).status === 0;
            const expected = runBrowser === 'true' ? 'success' : 'skipped';
            assert.equal(
              passed,
              planResult === 'success' &&
                ['true', 'false'].includes(runBrowser) &&
                [browserResult, unitResult, productionResult].every(
                  (result) => result === expected,
                ),
              `${planResult}/${runBrowser}/${browserResult}/${unitResult}/${productionResult}`,
            );
          }
      }
});

test('shared source and production checks stay mandatory without repeating inside browser jobs', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const unit = workflow.split('\n  unit:')[1].split('\n  production:')[0];
  const production = workflow.split('\n  production:')[1].split('\n  browser:')[0];
  const browser = workflow.split('\n  browser:')[1].split('\n  validate:')[0];
  for (const command of ['pnpm format:check', 'pnpm check', 'pnpm build', 'pnpm test'])
    assert.ok(
      unit.split('\n').some((line) => line.trim() === `- run: ${command}`),
      command,
    );
  assert.match(production, /CF_PAGES: '1'/);
  assert.ok(production.includes('- run: pnpm test:release'));
  assert.doesNotMatch(browser, /- run: pnpm (?:test|check|format:check)/);
  assert.doesNotMatch(browser, /CF_PAGES=1/);
  assert.match(workflow, /needs: \[plan, unit, production, browser\]/);
  assert.equal(workflow.split('- run: pnpm test\n').length - 1, 1);
});

test('superseded cancellations release queued finalizers while failures retain evidence and gates', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const evidence = workflow.slice(workflow.indexOf('- name: Keep browser evidence'));
  const gate = workflow.slice(workflow.indexOf('\n  validate:'));
  assert.match(evidence, /if: \$\{\{ !cancelled\(\) \}\}/);
  assert.match(gate, /if: \$\{\{ !cancelled\(\) \}\}/);
  assert.doesNotMatch(gate, /if: \$\{\{ success\(\) \}\}/);
  assert.match(workflow, /cancel-in-progress: \$\{\{ github.event_name == 'pull_request' \}\}/);
  assert.match(workflow, /fail-fast: false/);
});
