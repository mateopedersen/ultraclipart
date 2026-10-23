import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const walk = (p) =>
  readdirSync(p, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(p, e.name)) : [join(p, e.name)],
  );
test('deployed CSP authorizes every exact executable inline script without unsafe-inline', () => {
  const headers = readFileSync('dist/_headers', 'utf8');
  const script = headers.match(/script-src ([^;]+)/)[1];
  assert(!script.includes("'unsafe-inline'"));
  for (const f of walk('dist').filter((f) => f.endsWith('.html'))) {
    for (const m of readFileSync(f, 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=/.test(m[1]) || /type="application\/(?:ld\+)?json"/.test(m[1]) || !m[2].trim())
        continue;
      assert(script.includes(`'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`), f);
    }
  }
});
