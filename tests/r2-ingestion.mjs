import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';

test('uploader dry-run, conditional upload, checksum verification and idempotent resume against a local S3 double', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ultraclipart-ingestion-test-'));
  try {
    mkdirSync(join(dir, 'bin'));
    const fake = `#!${process.execPath}
import{readFileSync,writeFileSync,existsSync,openSync,closeSync,unlinkSync}from'node:fs';
const args=process.argv.slice(2), command=args[1], val=(name)=>args[args.indexOf(name)+1];
const path=process.env.FAKE_STATE;
const key=val('--key');let result={};
const hostParts=new URL(val('--endpoint-url')).hostname.split('.');const jurisdiction=hostParts.length===5?hostParts[1]:'default';
if(process.env.FAKE_DENY_JURIS===jurisdiction)process.exit(4);
let lock;while(lock===undefined){try{lock=openSync(path+'.lock','wx')}catch(e){if(e.code!=='EEXIST')throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5)}}
const state=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{objects:{},puts:0};
if(command==='list-buckets')result={Buckets:jurisdiction==='default'?[{Name:'ultraclipart'}]:[]};
else if(command==='list-objects-v2')result={IsTruncated:false,Contents:Object.entries(state.objects).map(([Key,o])=>({Key,Size:Buffer.from(o.body,'base64').length}))};
else if(command==='head-object')result={Metadata:state.objects[key].metadata};
else if(command==='put-object'){if(state.objects[key]||val('--if-none-match')!=='*')process.exit(3);state.objects[key]={body:readFileSync(val('--body')).toString('base64'),metadata:JSON.parse(val('--metadata'))};state.puts++;writeFileSync(path,JSON.stringify(state));}
else if(command==='get-object'){writeFileSync(args[args.indexOf('--key')+2],Buffer.from(state.objects[key].body,'base64'));}
else process.exit(2);
closeSync(lock);unlinkSync(path+'.lock');console.log(JSON.stringify(result));`;
    writeFileSync(join(dir, 'bin', 'aws'), fake, { mode: 0o755 });
    writeFileSync(join(dir, 'bin', 'package.json'), '{"type":"module"}');
    const contents = {
      pdf: '%PDF-1.7\nfixture',
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>',
      webp: 'RIFF0000WEBP VP8L',
      thumbnail: 'RIFF1111WEBP VP8L',
    };
    const batch = [1, 2, 3, 4].flatMap((number) =>
      Object.entries(contents).map(([kind, body]) => {
        const bytes = Buffer.from(body);
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        const ext = kind === 'thumbnail' ? 'webp' : kind;
        const filename = `${number}-${kind}.${ext}`;
        writeFileSync(join(dir, filename), bytes);
        return {
          assetId: `pumpkin-00${number}`,
          kind,
          bucket: 'ultraclipart',
          key: `pumpkin/${number}-${kind}.${sha256.slice(0, 12)}.${ext}`,
          path: filename,
          bytes: bytes.length,
          sha256,
        };
      }),
    );
    writeFileSync(join(dir, 'batch.json'), JSON.stringify(batch));
    const env = {
      ...process.env,
      PATH: `${join(dir, 'bin')}:${dirname(process.execPath)}:${process.env.PATH ?? ''}`,
      R2_ENDPOINT: `https://${'a'.repeat(32)}.r2.cloudflarestorage.com`,
      FAKE_STATE: join(dir, 'state.json'),
    };
    const script = resolve('scripts/r2/ingest.mjs');
    const run = (...flags) =>
      execFileSync(process.execPath, [script, 'batch.json', ...flags], {
        cwd: dir,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    assert.match(run(), /"mode": "dry-run"/);
    env.FAKE_DENY_JURIS = 'eu';
    assert.throws(() => run('--apply'), /Cannot inventory eu/);
    assert.equal(
      existsSync(env.FAKE_STATE),
      false,
      'Unknown jurisdiction must block before every PUT',
    );
    delete env.FAKE_DENY_JURIS;
    assert.throws(() => run('--apply', '--max-account-bytes', '1'), /account storage budget/);
    assert.equal(
      existsSync(env.FAKE_STATE),
      false,
      'The free-tier budget must block before any PUT',
    );
    assert.match(run('--apply', '--workers', '4'), /All objects verified/);
    assert.equal(JSON.parse(readFileSync(env.FAKE_STATE)).puts, 16);
    const journal = JSON.parse(readFileSync(join(dir, 'r2-ingest-journal.json')));
    assert.equal(journal.status, 'uploaded-and-byte-verified');
    assert.equal(journal.publishApproved, false);
    assert.deepEqual(journal.verifiedArtworkIds.sort(), [
      'pumpkin-001',
      'pumpkin-002',
      'pumpkin-003',
      'pumpkin-004',
    ]);
    assert.equal(journal.verifiedObjects.length, 16);
    run('--apply', '--workers', '4');
    assert.equal(JSON.parse(readFileSync(env.FAKE_STATE)).puts, 16, 'resume must not upload again');
    const state = JSON.parse(readFileSync(env.FAKE_STATE));
    state.objects[batch[0].key].body = Buffer.from('corrupted bytes').toString('base64');
    writeFileSync(env.FAKE_STATE, JSON.stringify(state));
    assert.throws(() => run('--apply'), /conflicting content/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
