import { build } from 'esbuild';
import { chromium, webkit, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const out = resolve(process.env.EVIDENCE_DIR ?? 'reports/editor-recovery-storage');
mkdirSync(out, { recursive: true });
const bundle = (
  await build({
    stdin: {
      contents: `import{createProjectRecovery}from'./src/editor/recovery';import{blankDocument}from'./src/editor/creation';import{loadLocal,saveLocal,saveLocalWhen}from'./src/editor/smart/storage';let release;window.qa={start(key,writer,now,held=false){const hold=held?new Promise(r=>release=r):Promise.resolve();this.key=key;this.r=createProjectRecovery({key,artId:'fixture',writer,now:()=>now,timeout:5000,unavailable:()=>{},write:async(k,doc,accept)=>{window.started=true;await hold;return saveLocalWhen(k,doc,accept)}});},doc:title=>({...blankDocument('fixture'),title}),run(title){this.pending=this.r.flush(this.doc(title));},finish(){return this.pending},release(){release?.()},remove(){this.deleting=this.r.clear()},finishDelete(){return this.deleting},read(){return loadLocal(this.key)},load(){return this.r.load()},checkpoint(key){return saveLocal(key,this.doc('plain-checkpoint')).then(()=>loadLocal(key))}};`,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    write: false,
  })
).outputFiles[0].contents;
const server = createServer((req, res) =>
  req.url === '/bundle.js'
    ? res.writeHead(200, { 'content-type': 'text/javascript' }).end(bundle)
    : res
        .writeHead(200, { 'content-type': 'text/html' })
        .end('<!doctype html><script type=module src=/bundle.js></script>'),
);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
const report = {
  passed: false,
  scope:
    'Actual shared source bundled without assertion/app changes; two pages in one isolated context use real IndexedDB readwrite transactions. Only a test dependency delays old write dispatch; no user storage or public API.',
  cases: [],
  errors: [],
};
try {
  for (const engine of process.env.UC_BROWSER ? [process.env.UC_BROWSER] : ['chromium', 'webkit']) {
    const browser = await { chromium, webkit }[engine].launch(
      engine === 'chromium' && process.env.UC_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.UC_CHROMIUM_EXECUTABLE_PATH }
        : {},
    );
    try {
      for (let round = 1; round <= 2; round++)
        for (const scenario of ['late-old-write', 'delete-before-new-other-tab']) {
          const context = await browser.newContext();
          const a = await context.newPage(),
            b = await context.newPage();
          const row = { engine, round, scenario, passed: false };
          try {
            await Promise.all([a.goto(base), b.goto(base)]);
            await Promise.all([
              a.waitForFunction(() => window.qa),
              b.waitForFunction(() => window.qa),
            ]);
            const key = `qa-recovery-${round}-${scenario}`;
            await a.evaluate((key) => {
              localStorage.setItem('qa-unrelated', 'preserve');
              qa.start(key, 'old-writer', 10, true);
              qa.run('old');
            }, key);
            await a.waitForFunction(() => window.started);
            if (scenario.startsWith('delete')) await a.evaluate(() => qa.remove());
            await b.evaluate(async (key) => {
              qa.start(key, 'new-writer', 20);
              qa.run('newer-other-tab');
              await qa.finish();
            }, key);
            row.before = await b.evaluate(() => qa.read());
            await a.evaluate(async () => {
              qa.release();
              await qa.finish();
              if (qa.deleting) await qa.finishDelete();
            });
            row.after = await b.evaluate(() => qa.read());
            assert.equal(row.after.title, 'newer-other-tab');
            assert.equal((await a.evaluate(() => qa.load())).title, 'newer-other-tab');
            assert.equal(await a.evaluate(() => localStorage.getItem('qa-unrelated')), 'preserve');
            assert.equal(
              (await b.evaluate((key) => qa.checkpoint(key + ':checkpoint'), key)).title,
              'plain-checkpoint',
            );
            row.passed = true;
          } catch (e) {
            row.error = String(e);
            report.errors.push(row.error);
          } finally {
            report.cases.push(row);
            await context.close();
            writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
          }
        }
    } finally {
      await browser.close();
    }
  }
  report.passed = !report.errors.length && report.cases.length === (process.env.UC_BROWSER ? 4 : 8);
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  assert(report.passed);
  console.log(JSON.stringify({ passed: true, cases: report.cases.length }));
} finally {
  await new Promise((r) => server.close(r));
}
