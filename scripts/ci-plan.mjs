import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ALL_SUITES = [
  'interface-core',
  'interface-artwork',
  'interface-pages',
  'catalog',
  'catalog-extra-0',
  'catalog-extra-1',
  'catalog-extra-2',
  'catalog-extra-3',
  'catalog-extra-4',
  'studio',
  'catalog-seasonal-0',
  'catalog-seasonal-1',
  'catalog-seasonal-2',
];

// An allowlist, not an exclusion list: unknown runtime dependencies get the full suite.
const interfaceFiles = new Set([
  'src/components/ArtworkFacts.astro',
  'src/components/FileGuideIllustration.astro',
  'src/components/RelatedArtwork.astro',
  'src/components/RelatedCard.astro',
  'src/styles/artwork-facts.css',
  'src/styles/artwork-detail.css',
  'src/styles/related.css',
  'src/styles/categories.css',
  'src/styles/home-showcase.css',
  'src/scripts/related-artwork.ts',
  'src/pages/categories.astro',
  'src/pages/new.astro',
  'src/pages/favorites.astro',
]);
const interfaceTests = new Set(
  [
    'search',
    'categories',
    'header',
    'artwork-details',
    'related',
    'sharing',
    'site',
    'refinement',
    'content',
  ].map((name) => `tests/e2e/${name}.mjs`),
);
// These tests change no shipped editor code; retain the complete Studio group
// in every browser plus the mandatory shared unit and production checks.
const studioTests = new Set(['tests/e2e/studio-tools.mjs', 'tests/smart-selection.mjs']);
const policyFiles = new Set([
  '.github/workflows/ci.yml',
  'scripts/ci-plan.mjs',
  'tests/ci-plan.mjs',
]);
const documentation = (path) =>
  /^(README|CONTRIBUTING|CHANGELOG)(\.md|\.txt)$/.test(path) ||
  (/^docs\//.test(path) && /\.(md|txt)$/.test(path));

export function selectSuites(changes, { forceFull = false } = {}) {
  const full = (reason) => ({ suites: [...ALL_SUITES], reason });
  if (forceFull) return full('Manual run or unavailable comparison: full validation');
  if (!Array.isArray(changes) || changes.length === 0)
    return full('Empty or unavailable change list: full validation');
  let interfaceChanged = false,
    studioTestsChanged = false;
  for (const change of changes) {
    const { path, status } = change ?? {};
    if (typeof path !== 'string' || !/^[AMDT]$/.test(status ?? ''))
      return full('Unknown path or change status: full validation');
    if (policyFiles.has(path) || documentation(path)) continue;
    // Deletions/type changes may remove an import relied on by another page.
    if (!['A', 'M'].includes(status)) return full('Runtime deletion/type change: full validation');
    if (studioTests.has(path)) {
      studioTestsChanged = true;
      continue;
    }
    if (
      interfaceFiles.has(path) ||
      interfaceTests.has(path) ||
      /^src\/pages\/guides\/[a-z0-9-]+\.astro$/.test(path)
    ) {
      interfaceChanged = true;
      continue;
    }
    return full(`Shared, catalog, editor or unclassified change: ${path}`);
  }
  if (studioTestsChanged)
    return {
      suites: [
        ...(interfaceChanged ? ['interface-core', 'interface-artwork', 'interface-pages'] : []),
        'studio',
      ],
      reason: 'Isolated Studio test changes: complete Studio checks in every browser engine',
    };
  return interfaceChanged
    ? {
        suites: ['interface-core', 'interface-artwork', 'interface-pages'],
        reason: 'Isolated page presentation: all three interface groups in every browser engine',
      }
    : { suites: [], reason: 'Documentation or CI policy only: planner and workflow checks' };
}

export function parseDiff(output) {
  const tokens = output.split('\0');
  if (tokens.pop() !== '') throw new Error('Incomplete NUL-delimited diff');
  if (tokens.length % 2) throw new Error('Incomplete status/path pair');
  return Array.from({ length: tokens.length / 2 }, (_, index) => {
    const [status, path] = tokens.slice(index * 2, index * 2 + 2);
    if (!/^[AMDT]$/.test(status) || !path || path.includes('\n') || path.includes('\r'))
      throw new Error('Unsupported diff entry');
    return { status, path };
  });
}

export function eventRange(name, event) {
  let base, head;
  if (name === 'pull_request') {
    base = event.pull_request?.base?.sha;
    head = event.pull_request?.head?.sha;
  } else if (name === 'push') {
    base = event.before;
    head = event.after;
  }
  const sha = (value) =>
    typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) && !/^0+$/.test(value);
  return sha(base) && sha(head) ? { base, head } : null;
}

export function planForEvent(
  name,
  event,
  diff = (base, head) =>
    execFileSync('git', ['diff', '--no-renames', '--name-status', '-z', base, head, '--'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }),
) {
  const range = eventRange(name, event);
  if (!range) return selectSuites(null, { forceFull: true });
  try {
    return selectSuites(parseDiff(diff(range.base, range.head)));
  } catch {
    return selectSuites(null, { forceFull: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let plan;
  try {
    plan = planForEvent(
      process.env.GITHUB_EVENT_NAME,
      JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
    );
  } catch {
    plan = selectSuites(null, { forceFull: true });
  }
  console.log(JSON.stringify(plan, null, 2));
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `run_browser=${plan.suites.length > 0}\nbrowser_suites=${JSON.stringify(plan.suites.length ? plan.suites : ['interface-core'])}\n`,
    );
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Validation scope\n\n${plan.reason}\n\nBrowser groups: ${plan.suites.join(', ') || 'none (no product changes)'}\n`,
    );
}
