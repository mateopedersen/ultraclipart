import assert from 'node:assert/strict';

/** Compare the complete editable document separately from its recovery envelope. */
export function editorDocumentFromRecovery(value) {
  if (value === null) return null;
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  if (Object.hasOwn(value, '_ucRecovery')) {
    const stamp = value._ucRecovery;
    assert.ok(stamp && typeof stamp === 'object' && !Array.isArray(stamp));
    assert.deepEqual(Object.keys(stamp).sort(), ['format', 'revision', 'writer']);
    assert.equal(stamp.format, 'ultraclipart-editor-recovery-v1');
    assert.ok(Number.isSafeInteger(stamp.revision));
    assert.ok(stamp.revision > 0 && stamp.revision < Number.MAX_SAFE_INTEGER);
    assert.equal(typeof stamp.writer, 'string');
    assert.match(stamp.writer, /^[a-zA-Z0-9-]{1,80}$/);
  }
  // Keep every other top-level and nested field, including masks and source hashes.
  const { _ucRecovery: recovery, ...document } = value;
  return document;
}

export async function readStoredEditorDocument(page, id = 'my-clipart') {
  assert.equal(typeof id, 'string');
  const value = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  }, 'ultraclipart:editor:v1:' + id);
  return editorDocumentFromRecovery(value);
}
