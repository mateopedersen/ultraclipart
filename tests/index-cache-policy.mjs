import test from 'node:test';
import assert from 'node:assert/strict';
import {
  declaredIndexCacheControl,
  verifyIndexCachePolicy,
} from './helpers/index-cache-policy.mjs';

const rule =
  '/*\n  X-Content-Type-Options: nosniff\n/surprise-picks.json\n  Cache-Control: no-store\n/studio-catalog.json\n  Cache-Control: no-cache, must-revalidate\n';
const check = (base, cacheControl, builtHeaders = rule) =>
  verifyIndexCachePolicy({ base, pathname: '/surprise-picks.json', cacheControl, builtHeaders });

test('the exact built route requires one explicit no-store rule', () => {
  assert.equal(declaredIndexCacheControl(rule, '/surprise-picks.json'), 'no-store');
  assert.equal(
    declaredIndexCacheControl(rule.replaceAll('\n', '\r\n'), '/surprise-picks.json'),
    'no-store',
  );
});
for (const [name, text] of [
  ['missing', '/*\n  Cache-Control: no-store\n'],
  ['different route', '/surprise-picks.json-old\n  Cache-Control: no-store\n'],
  ['cache lifetime', '/surprise-picks.json\n  Cache-Control: public, max-age=3600\n'],
  ['duplicate', rule + '/surprise-picks.json\n  Cache-Control: no-store\n'],
  ['unset', rule + '/surprise-picks.json\n  ! Cache-Control\n'],
])
  test('rejects ' + name + ' deployment cache policy', () => {
    assert.throws(() => declaredIndexCacheControl(text, '/surprise-picks.json'));
  });
for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
  test(host + ' static preview verifies the built no-store rule separately', () => {
    assert.deepEqual(check('http://' + host + ':4321', 'no-cache'), {
      server: 'local-static-preview',
      http: 'no-cache',
      deployed: 'no-store',
    });
    assert.equal(check('http://' + host + ':4321', 'no-store').deployed, 'no-store');
  });
}
for (const value of [undefined, 'public, max-age=60', 'no-cache, max-age=60', 'no-store-extra']) {
  test('rejects invalid static-preview header ' + String(value), () => {
    assert.throws(() => check('http://127.0.0.1:4321', value));
  });
}
test('a local preview cannot hide a missing deployed rule', () => {
  assert.throws(() => check('http://127.0.0.1:4321', 'no-cache', ''));
});
for (const base of ['https://ultraclipart.com', 'https://127.0.0.1.example.com']) {
  test(base + ' requires actual HTTP no-store', () => {
    assert.throws(() => check(base, 'no-cache'));
    assert.throws(() => check(base, 'public, max-age=60'));
    assert.equal(check(base, 'no-store').server, 'live-origin');
    assert.equal(check(base, 'private, no-store, max-age=0').server, 'live-origin');
  });
}
