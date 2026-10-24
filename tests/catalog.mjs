import test from 'node:test';
import { PAGES_FILE_LIMIT } from '../src/lib/pages-limits.ts';
import assert from 'node:assert/strict';
import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { representationKinds } from '../scripts/asset-representations.mjs';
import { readPublication } from '../scripts/publication-policy.mjs';

const root = resolve(import.meta.dirname, '..');
const topics = JSON.parse(readFileSync(join(root, 'data/topics.json'))).topics;
const arts = JSON.parse(readFileSync(join(root, 'data/art.json')));
const digest = (b) => createHash('sha256').update(b).digest('hex');
function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if (char === '\n' && !quoted) {
      row.push(value.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      value = '';
    } else value += char;
  }
  if (value || row.length) {
    row.push(value.replace(/\r$/, ''));
    rows.push(row);
  }
  assert.equal(quoted, false, 'unclosed CSV quote');
  const keys = rows.shift();
  return rows
    .filter((row) => row.some(Boolean))
    .map((row) => Object.fromEntries(keys.map((key, i) => [key, row[i]])));
}

test('all 110 keyword records exactly match CSV identities and have collision-free routes', () => {
  const csv = parseCsv(readFileSync(join(root, 'data/topics.csv'), 'utf8'));
  assert.equal(topics.length, 110);
  assert.equal(csv.length, 110);
  assert.equal(new Set(topics.map((x) => x.id)).size, 110);
  assert.equal(new Set(topics.map((x) => x.slug)).size, 110);
  assert.equal(new Set(topics.map((x) => x.keyword)).size, 110);
  for (const topic of topics) {
    const source = csv.find((row) => Number(row.id) === topic.id);
    assert.ok(source, `missing source keyword ${topic.id}`);
    for (const field of ['keyword', 'slug', 'cluster', 'wave', 'focus_note'])
      assert.equal(topic[field], source[field]);
    assert.equal(topic.target_original_artworks, 50);
    assert.match(topic.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
  assert.equal(
    topics.reduce((n, topic) => n + topic.target_original_artworks, 0),
    5500,
  );
});

test('art identities, topic assignment, provenance and review states remain honest', () => {
  assert.equal(new Set(arts.map((a) => a.id)).size, arts.length);
  const extras = JSON.parse(readFileSync(join(root, 'data/extra-topics.json')));
  const validTopics = new Set([...topics, ...extras].map((t) => t.slug));
  for (const art of arts) {
    assert.ok(validTopics.has(art.topic), `unauthorized topic: ${art.topic}`);
    assert.match(art.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(art.title.length > 5 && art.alt.length > 20 && art.description.length > 30);
    assert.ok(art.provenance && art.productionMethod, `missing provenance: ${art.id}`);
    assert.equal(typeof art.published, 'boolean');
    assert.equal(typeof art.indexable, 'boolean');
    if (art.indexable) assert.equal(art.published, true);
    if (art.published) {
      assert.doesNotMatch(art.reviewStatus, /REQUIRED|PENDING|DRAFT/i);
      assert.doesNotMatch(art.licenseStatus, /REQUIRED|PENDING|UNKNOWN/i);
    }
  }
  for (const topic of topics)
    assert.ok(
      arts.filter(
        (a) => a.topic === topic.slug && a.published && a.productionMethod !== 'owner-supplied',
      ).length <= 50,
    );
});

test('every artwork has its declared real, correctly typed, paired and hashed representations', () => {
  const paths = new Set();
  const svgHashes = new Set();
  for (const art of arts) {
    for (const kind of representationKinds(art)) {
      assert.ok(/^\/(?:pilot|catalog\/[a-z0-9_-]+)\//.test(art[kind]) && !art[kind].includes('..'));
      assert.ok(art[kind].includes(art.id), `cross-wired ${kind}: ${art.id}`);
      assert.ok(!paths.has(art[kind]), `shared file: ${art[kind]}`);
      paths.add(art[kind]);
      const path = join(root, 'public', art[kind]);
      const bytes = readFileSync(path);
      assert.ok(bytes.length > 0);
      assert.equal(art.files?.[kind]?.bytes, bytes.length, `wrong recorded byte size: ${path}`);
      assert.equal(art.files?.[kind]?.sha256, digest(bytes), `wrong SHA256: ${path}`);
      if (kind === 'pdf') {
        assert.equal(bytes.toString('ascii', 0, 5), '%PDF-');
        assert.ok(bytes.length <= 1_000_000, `PDF exceeds hard cap: ${art.id}`);
      } else if (kind === 'svg') {
        const text = bytes.toString('utf8');
        assert.match(text, /<svg[\s>]/);
        assert.doesNotMatch(
          text,
          /<script|foreignObject|\son[a-z]+\s*=|javascript:|<!DOCTYPE|<!ENTITY/i,
        );
        const groups = [...text.matchAll(/<g\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]);
        assert.ok(groups.length >= 2, `source is not layered: ${art.id}`);
        assert.equal(new Set(groups).size, groups.length, `duplicate layer IDs: ${art.id}`);
        assert.ok(!svgHashes.has(digest(bytes)), `exact duplicated artwork: ${art.id}`);
        svgHashes.add(digest(bytes));
      } else {
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
        assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      }
    }
  }
});

test(
  'built static payload fits Workers Free file and individual size limits',
  { skip: !existsSync(join(root, 'dist')) },
  () => {
    function files(dir) {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
      );
    }
    const dist = join(root, 'dist');
    // Development bundles local masters for offline editing. Production removes
    // catalog staging and the byte-verified R2 representations before upload.
    // CF_PAGES checks the actual output with no exclusions.
    const localMedia =
      process.env.CF_PAGES === '1' ? new Set() : new Set(readPublication(root).localPaths);
    const output = files(dist).filter((file) => {
      const path = '/' + relative(dist, file);
      return (
        process.env.CF_PAGES === '1' || (!path.startsWith('/catalog/') && !localMedia.has(path))
      );
    });
    assert.ok(output.length <= PAGES_FILE_LIMIT, `too many static assets: ${output.length}`);
    for (const file of output)
      assert.ok(statSync(file).size <= 25 * 1024 * 1024, `oversized static asset: ${file}`);
  },
);
