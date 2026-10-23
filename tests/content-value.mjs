import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const art = JSON.parse(read('data/art.json'));
const notes = JSON.parse(read('data/artwork-notes.json'));
const topics = JSON.parse(read('data/topics.json')).topics;
const dist = new URL('../dist/', import.meta.url);
test('usage notes cover actual illustrations and expose the exact named source layers', () => {
  assert.deepEqual(Object.keys(notes).sort(), art.map((item) => item.id).sort());
  assert.equal(new Set(Object.values(notes).map((note) => note.use)).size, art.length);
  assert.equal(new Set(Object.values(notes).map((note) => note.edit)).size, art.length);
  for (const item of art) {
    const layers = [...read('public' + item.svg).matchAll(/data-label="([^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(notes[item.id].layers, layers, item.id);
    assert.ok(
      existsSync(
        new URL('../src/pages/guides/' + notes[item.id].guide + '.astro', import.meta.url),
      ),
    );
  }
});
test(
  'public topic pages require actual artwork while preserving all 110 production keywords',
  { skip: !existsSync(dist) },
  () => {
    assert.equal(topics.length, 110);
    const available = new Set(art.map((item) => item.topic));
    for (const topic of topics)
      assert.equal(
        existsSync(new URL('clipart/' + topic.slug + '/index.html', dist)),
        available.has(topic.slug),
        topic.slug,
      );
    const manifest = JSON.parse(read('dist/search-data/manifest.json'));
    assert.deepEqual(manifest.topics.map((item) => item.slug).sort(), [...available].sort());
    const directory = read('dist/categories/index.html');
    for (const topic of topics) {
      if (!available.has(topic.slug))
        assert.ok(!directory.includes(`href="/clipart/${topic.slug}/"`));
    }
  },
);
test(
  'no advertising code is shipped before a separate monetization review',
  { skip: !existsSync(dist) },
  () => {
    const walk = (dir) =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
      );
    for (const file of walk(fileURLToPath(dist)).filter((path) => path.endsWith('.html')))
      assert.doesNotMatch(
        readFileSync(file, 'utf8'),
        /adsbygoogle|pagead2\.googlesyndication|ca-pub-\d+/,
        file,
      );
  },
);

test(
  'production and review notes stay out of rendered public pages',
  { skip: !existsSync(dist) },
  () => {
    const walk = (dir) =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
      );
    for (const file of walk(fileURLToPath(dist)).filter((path) => path.endsWith('.html')))
      assert.doesNotMatch(
        readFileSync(file, 'utf8'),
        /AI-assisted|AI assistance|code-drawn|visual quality review|Visual review is ongoing|Working with this drawing|Original pilot illustration/i,
        file,
      );
  },
);
