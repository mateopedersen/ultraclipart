import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({
  entryPoints: ['src/share/core.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { artworkUrl, caption, socialLinks, publicMediaUrl } = await import(
  'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')
);
test('sharing strips private session data and rejects non-artwork destinations', () => {
  assert.equal(
    artworkUrl('/art/little-fox/?workspace=secret#private'),
    'https://ultraclipart.com/art/little-fox/',
  );
  for (const value of [
    'https://evil.test/art/fox/',
    '/create/?workspace=private',
    'javascript:alert(1)',
    'https://ultraclipart.com.evil.test/art/fox/',
    '/api/share/session',
  ])
    assert.throws(() => artworkUrl(value));
  for (const value of [
    'blob:https://ultraclipart.com/secret',
    'data:image/png;base64,AAA',
    'https://evil.test/fox.webp',
    'http://127.0.0.1:4353/fox.webp',
    '/private.svg',
  ])
    assert.equal(publicMediaUrl(value), undefined);
  assert.equal(
    publicMediaUrl('https://assets.ultraclipart.com/fox.webp?private=secret#fragment'),
    'https://assets.ultraclipart.com/fox.webp',
  );
});
test('social captions remain editable Unicode text and retain the exact canonical backlink', () => {
  const url = 'https://ultraclipart.com/art/little-fox/';
  const text = 'Küçük tilki 🦊 & flowers <3 #create';
  const links = socialLinks(
    url + '?workspace=secret',
    text,
    'https://assets.ultraclipart.com/fox.webp',
  );
  assert.equal(links.length, 9);
  const telegram = new URL(links.find((link) => link.name === 'Telegram').href);
  assert.equal(telegram.searchParams.get('text'), text);
  assert.equal(telegram.searchParams.get('url'), url);
  const pinterest = new URL(links[0].href);
  assert.equal(pinterest.searchParams.get('media'), 'https://assets.ultraclipart.com/fox.webp');
  assert.equal(pinterest.searchParams.get('description'), text);
  for (const link of links) {
    assert.equal(new URL(link.href).protocol, 'https:');
    assert.ok(!link.href.includes('secret'));
    assert.ok(decodeURIComponent(link.href).includes(url));
  }
  assert.match(caption('catalog', 'Little fox'), /found.*UltraClipart/);
  assert.match(caption('creation', 'My fox'), /created.*UltraClipart/);
});
test('bounded social posts preserve Unicode and fit compose limits', () => {
  const links = socialLinks(
    'https://ultraclipart.com/art/' + 'a'.repeat(140) + '/',
    '🦊漢'.repeat(300),
  );
  for (const [name, limit] of [
    ['Bluesky', 300],
    ['Threads', 500],
  ]) {
    const text = new URL(links.find((link) => link.name === name).href).searchParams.get('text');
    assert.ok(Array.from(text).length <= limit);
    assert.ok(text.isWellFormed());
  }
  assert.ok(
    Array.from(new URL(links.find((link) => link.name === 'X').href).searchParams.get('text'))
      .length <= 120,
  );
});
