import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldPersistExportName } from '../src/editor/export-name.ts';

test('export preserves the undo stack for an unchanged generated filename', () => {
  assert.equal(
    shouldPersistExportName(undefined, 'My Clipart Project', 'My Clipart Project'),
    false,
  );
  assert.equal(shouldPersistExportName('', 'My Clipart Project', 'My Clipart Project'), false);
  assert.equal(shouldPersistExportName('A project', 'My Clipart Project', 'A project'), false);
});

test('a user-changed project name is saved', () => {
  assert.equal(shouldPersistExportName(undefined, 'My Clipart Project', 'New project'), true);
  assert.equal(shouldPersistExportName('Old name', 'My Clipart Project', 'New name'), true);
});
