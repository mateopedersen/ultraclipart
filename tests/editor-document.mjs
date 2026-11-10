import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  editorDocumentFromRecovery,
  readStoredEditorDocument,
} from './helpers/editor-document.mjs';

const document = () => ({
  version: 2,
  title: 'Original title',
  layers: [{ id: 'art', sourceSha256: 'a'.repeat(64), mask: { data: 'intact-mask' } }],
});
const stamp = (revision = 1) => ({
  format: 'ultraclipart-editor-recovery-v1',
  revision,
  writer: 'writer-1',
});
test('missing recovery slot stays null', () => {
  assert.equal(editorDocumentFromRecovery(null), null);
});
test('legacy document retains every field', () => {
  const input = document();
  assert.deepEqual(editorDocumentFromRecovery(input), input);
});
test('valid envelope is separate from the unchanged document', () => {
  const input = { ...document(), _ucRecovery: stamp() };
  assert.deepEqual(editorDocumentFromRecovery(input), document());
  assert.deepEqual(input._ucRecovery, stamp());
});
test('different valid revisions compare as the exact same editable document', () => {
  assert.deepEqual(
    editorDocumentFromRecovery({ ...document(), _ucRecovery: stamp(1) }),
    editorDocumentFromRecovery({ ...document(), _ucRecovery: stamp(2) }),
  );
});
test('a changed title still fails document equality', () => {
  assert.notDeepEqual(
    editorDocumentFromRecovery({ ...document(), _ucRecovery: stamp(1) }),
    editorDocumentFromRecovery({ ...document(), title: 'Changed title', _ucRecovery: stamp(2) }),
  );
});
test('changed nested mask bytes still fail document equality', () => {
  const changed = document();
  changed.layers[0].mask.data = 'changed-mask';
  assert.notDeepEqual(
    editorDocumentFromRecovery({ ...document(), _ucRecovery: stamp(1) }),
    editorDocumentFromRecovery({ ...changed, _ucRecovery: stamp(2) }),
  );
});
test('changed source checksum still fails document equality', () => {
  const changed = document();
  changed.layers[0].sourceSha256 = 'b'.repeat(64);
  assert.notDeepEqual(editorDocumentFromRecovery(changed), document());
});
test('unknown top-level fields remain part of equality', () => {
  const input = { ...document(), additional: { meaningful: true }, _ucRecovery: stamp() };
  assert.deepEqual(editorDocumentFromRecovery(input).additional, input.additional);
  assert.notDeepEqual(editorDocumentFromRecovery(input), document());
});
test('a nested similarly named field is never stripped', () => {
  const input = document();
  input.layers[0]._ucRecovery = { retained: true };
  assert.deepEqual(editorDocumentFromRecovery(input).layers[0]._ucRecovery, { retained: true });
});
for (const [name, bad] of [
  ['zero revision', { ...stamp(), revision: 0 }],
  ['unsafe revision', { ...stamp(), revision: Number.MAX_SAFE_INTEGER }],
  ['invalid writer', { ...stamp(), writer: 'invalid writer' }],
  ['unknown format', { ...stamp(), format: 'unknown' }],
  ['null envelope', null],
  ['unexpected envelope property', { ...stamp(), extra: true }],
]) {
  test(`invalid recovery envelope fails loudly: ${name}`, () => {
    assert.throws(() => editorDocumentFromRecovery({ ...document(), _ucRecovery: bad }));
  });
}
test('browser reader uses the exact requested recovery key', async () => {
  let observed;
  const page = {
    evaluate: async (reader, key) => {
      observed = key;
      return { ...document(), _ucRecovery: stamp() };
    },
  };
  assert.deepEqual(await readStoredEditorDocument(page, 'specific-art'), document());
  assert.equal(observed, 'ultraclipart:editor:v1:specific-art');
});
