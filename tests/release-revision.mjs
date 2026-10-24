import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseRevision } from '../scripts/release-revision.mjs';

test('manual and Git-connected production builds identify their exact source commit', () => {
  const head = 'a'.repeat(40),
    connected = 'b'.repeat(40);
  assert.equal(
    releaseRevision({ CF_PAGES: '1' }, () => head),
    head,
  );
  assert.equal(
    releaseRevision({ CF_PAGES: '1', CF_PAGES_COMMIT_SHA: connected }, () => {
      throw new Error('Git must not override the deployment revision');
    }),
    connected,
  );
  assert.equal(
    releaseRevision({}, () => {
      throw new Error('Local build');
    }),
    'local',
  );
  for (const invalid of ['local', '', 'main', 'abc123'])
    assert.throws(
      () => releaseRevision({ CF_PAGES: '1', CF_PAGES_COMMIT_SHA: invalid }),
      /full Git/,
    );
  assert.throws(() => releaseRevision({ CF_PAGES: '1' }, () => ''), /full Git/);
});
