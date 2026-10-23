import{readFileSync,writeFileSync,readdirSync}from'node:fs';import{join}from'node:path';import{createHash}from'node:crypto';
const files=(p)=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(p,e.name)):[join(p,e.name)]);
const hashes=new Set();
for(const f of files('dist').filter(f=>f.endsWith('.html'))){const html=readFileSync(f,'utf8');for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/\bsrc\s*=/.test(m[1])||/type="application\/(?:ld\+)?json"/.test(m[1])||!m[2].trim())continue;hashes.add(`'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);}}
const base=readFileSync('public/_headers','utf8');const csp=base.replace("script-src 'self' 'wasm-unsafe-eval';",`script-src 'self' 'wasm-unsafe-eval' ${[...hashes].join(' ')};`);writeFileSync('dist/_headers',csp);console.log(`CSP: ${hashes.size} exact inline script hashes; no unsafe-inline scripts.`);
