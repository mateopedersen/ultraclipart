import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contactFormLink, contactTopics, contactFormUrl } from '../src/lib/contact.ts';
import { contactContentSecurityPolicy } from '../scripts/contact-security.mjs';
test('all topic links use the real published form and a documented pre-fill field', () => {
  assert.equal(contactTopics.length, new Set(contactTopics.map((topic) => topic.id)).size);
  for (const topic of contactTopics) {
    const url = new URL(contactFormLink(topic.id, true));
    assert.equal(url.origin + url.pathname, contactFormUrl);
    assert.equal(url.searchParams.get('entry.1751201779'), topic.value);
    assert.equal(url.searchParams.get('embedded'), 'true');
    assert.ok(topic.href.startsWith('/') && !topic.href.startsWith('//'));
  }
  assert.equal(contactFormLink('unknown'), contactFormLink('general'));
});
test('the Contact policy permits only the Google Docs frame while preserving script and form protection', () => {
  const source = readFileSync('public/_headers', 'utf8').match(
    /^  Content-Security-Policy: (.+)$/m,
  )[1];
  const policy = contactContentSecurityPolicy(source);
  assert.ok(policy.endsWith('frame-src https://docs.google.com'));
  for (const field of [
    'script-src',
    'connect-src',
    'form-action',
    'frame-ancestors',
    'object-src',
  ]) {
    const directive = source
      .split(';')
      .find((item) => item.trim().startsWith(field + ' '))
      .trim();
    assert.ok(policy.includes(directive));
  }
  assert.ok(!source.includes('docs.google.com'));
  assert.ok(!policy.includes('*.google.com'));
  assert.ok(!policy.includes("script-src 'unsafe-inline'"));
  assert.equal((contactContentSecurityPolicy(policy).match(/frame-src/g) || []).length, 1);
  assert.throws(() => contactContentSecurityPolicy(''), /complete base CSP/);
});
