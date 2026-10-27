import { chromium,webkit,expect } from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import AxeBuilder from '@axe-core/playwright';
import {inspectLayout} from '../helpers/layout-audit.mjs';
const base=process.env.BASE_URL||'http://127.0.0.1:4323',engine=process.env.UC_BROWSER||'chromium',out=process.env.EVIDENCE_DIR||`reports/studio-workbench/${engine}`;
mkdirSync(out,{recursive:true});
const source=stripTypeScriptTypes(readFileSync(new URL('../../src/editor/workbench/catalog.ts',import.meta.url),'utf8'),{mode:'transform'});
const {workbenchCommands}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(workbenchCommands.length,100);assert.equal(new Set(workbenchCommands.map(c=>c[0])).size,100);
const image=await sharp({create:{width:32,height:32,channels:4,background:{r:30,g:90,b:190,alpha:1}}}).png().toBuffer();
const sha=createHash('sha256').update(image).digest('hex'),assetId='local-'+sha;
const layer=(id,x,y,extra={})=>({id,label:id,kind:'vector',markup:'<rect width="120" height="80" fill="#1464d4" stroke="#203040" stroke-width="3"/>',x,y,scaleX:1,scaleY:1,angle:0,visible:true,locked:false,opacity:.7,...extra});
const fixture={version:2,artId:'my-clipart',width:800,height:600,background:'transparent',crop:null,print:{paper:'a4',orientation:'portrait',margin:.5,scale:'fit'},localSources:[{id:assetId,sha256:sha,data:'data:image/png;base64,'+image.toString('base64')}],layers:[
 layer('blue-card',320,180,{scaleX:.8,angle:10}),layer('red-card',60,60,{markup:'<ellipse cx="75" cy="50" rx="75" ry="50" fill="#db536b" stroke="#552233" stroke-width="2"/>',angle:-10,opacity:.9}),
 {id:'heading',kind:'text',label:'Heading',text:'  HELLO   world\nnew LINE ',size:30,color:'#1464d4',bold:false,align:'start',x:70,y:350,scaleX:1,scaleY:1,angle:0,visible:true,locked:false,opacity:.8},
 {id:'caption',kind:'text',label:'Caption',text:'Second line\nfirst line',size:24,color:'#552233',bold:true,align:'start',x:420,y:420,scaleX:1,scaleY:1,angle:0,visible:true,locked:false,opacity:.9},
 layer('hidden-card',10,10,{visible:false}),layer('locked-card',630,490,{locked:true}),layer('outside-card',900,100),
 {id:'empty-text',kind:'text',label:'Empty',text:'',size:20,color:'#1464d4',bold:false,align:'start',x:50,y:100,scaleX:1,scaleY:1,angle:0,visible:true,locked:false,opacity:1},
 {id:'blue-image',kind:'raster',label:'Blue Image',assetId,sourceSha256:sha,width:32,height:32,x:680,y:40,scaleX:2,scaleY:2,angle:0,visible:true,locked:false,opacity:1}
]};
const browser=await {chromium,webkit}[engine].launch();const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,reducedMotion:'reduce'});
await context.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedText=text;},write:async items=>{window.__copiedImages=items.map(i=>i.types);}}});});
const page=await context.newPage(),report={engine,base,checks:[],errors:[],exports:[],layouts:[],status:'running'};
page.on('pageerror',e=>report.errors.push(e.message));
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ultraclipart:editor:v1:my-clipart')));
async function closeDialogs(){for(const d of await page.locator('.uc-editor dialog[open]').all()){const close=d.locator('[data-wb-close]').first();if(await close.count())await close.click();else await page.keyboard.press('Escape');}}
async function load(){await closeDialogs();await page.locator('[data-load]').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await expect(page.locator('[data-status]')).toHaveText('Saved project opened.');}
async function select(ids){await page.locator('.uc-tools [data-panel=layers]').click();for(const [i,id]of ids.entries())await page.locator(`[data-select="${id}"]`).click({modifiers:i?['Shift']:[]});}
async function run(id,name,value){await page.keyboard.press('Control+k');const dialog=page.locator('[data-wb-palette]');await expect(dialog).toBeVisible();await dialog.locator('[data-wb-list=all]').click();await dialog.locator('[data-wb-category]').selectOption('all');await dialog.locator('[data-wb-search]').fill(name);const button=dialog.locator(`[data-wb-run="${id}"]`);await expect(button).toBeEnabled();await button.click();
 const param=page.locator('[data-wb-parameter-dialog]');if(await param.isVisible()){if(await param.locator('[data-wb-value]').isVisible())await param.locator('[data-wb-value]').fill(value||'24');if(id==='text-replace')await param.locator('[data-wb-second]').fill('REPLACED');if(['restore-checkpoint','delete-checkpoint'].includes(id))await param.locator('[data-wb-checkpoint]').selectOption({index:0});await param.locator('button[type=submit]').click();await expect(param).not.toBeVisible();}
 await expect(page.locator('[data-status]')).not.toHaveAttribute('data-error','true');}
try{
 await page.goto(base+'/create/');await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy','true',{timeout:60000});
 const cookie=page.locator('[data-cookie-choice=necessary]:visible');if(await cookie.count())await cookie.first().click();
 await expect(page.locator('.uc-modes button')).toHaveCount(2);assert.equal(await page.getByText('Quick Edit',{exact:true}).count(),0);assert.equal(await page.getByText('Advanced Edit',{exact:true}).count(),0);
 for(const [id,name,group]of workbenchCommands){
  if(id!=='end-solo')await load();
  const texts=id.startsWith('text-')||id==='label-from-text';await select(texts?['heading','caption']:id==='paste-style'?['red-card']:['blue-card','red-card']);
  const before=await state();const downloads=[];const handler=d=>downloads.push(d);page.on('download',handler);
  await run(id,name,({'dock-width':'320','grid-size':'32','safe-size':'30','select-name':'card','prefix-names':'Project','text-replace':'HELLO','save-checkpoint':'Before changes','rename-project':'My New Project'}[id]||'24'));
  await page.waitForTimeout(30);
  if(id==='command-search'||id==='command-recents'||id==='command-favorites')await expect(page.locator('[data-wb-palette]')).toBeVisible();
  if(id==='shortcut-guide')await expect(page.locator('[data-wb-output]')).toContainText('Command K');
  if(id==='space-pan'){const stage=page.locator('.uc-stage');await stage.focus();await page.keyboard.down('Space');await page.keyboard.up('Space');}
  if(id==='fullscreen'&&await page.evaluate(()=>!!document.fullscreenElement))await page.evaluate(()=>document.exitFullscreen());
  if(id==='select-raster')await expect(page.locator('[data-select=blue-image]')).toHaveAttribute('aria-pressed','true');
  if(id==='select-locked')await expect(page.locator('[data-select=locked-card]')).toHaveAttribute('aria-pressed','true');
  if(id==='select-hidden')await expect(page.locator('[data-select=hidden-card]')).toHaveAttribute('aria-pressed','true');
  if(id==='rename-project')assert.equal((await state()).title,'My New Project');
  if(id==='export-svg'||id==='export-selected-svg'||id==='export-png'||id==='export-jpeg'||id==='export-selected-png'||id==='export-inventory'||id==='export-palette'||id==='export-text'){
    await expect.poll(()=>downloads.length,{timeout:30000}).toBe(1);const d=downloads[0],name=d.suggestedFilename();await d.saveAs(`${out}/${name}`);const bytes=readFileSync(`${out}/${name}`);assert.ok(bytes.length>10);if(name.endsWith('.svg'))assert.ok(bytes.toString().includes('<svg'));if(name.endsWith('.png'))assert.equal(bytes.subarray(1,4).toString(),'PNG');if(name.endsWith('.jpg'))assert.equal(bytes.readUInt16BE(0),0xffd8);report.exports.push({command:id,name,bytes:bytes.length});
  }
  if(id==='copy-png')await expect.poll(()=>page.evaluate(()=>window.__copiedImages?.[0]?.includes('image/png'))).toBe(true);
  if(id==='copy-svg')assert.ok((await page.evaluate(()=>window.__copiedText)).includes('<svg'));
  if(['match-width','match-height','match-size','match-rotation','match-opacity','swap-positions','stack-horizontal','stack-vertical','reading-order','reverse-order','pack-rows','pack-columns','fit-safe','mirror-layout-x','mirror-layout-y','lock-selection','unlock-all','hide-selection','show-all','solo-selection','prefix-names','number-names','label-from-text','delete-hidden','delete-empty-text','delete-outside','text-upper','text-lower','text-title','text-sentence','text-trim','text-join','text-bullets','text-numbers','text-sequence','text-replace','text-sort-lines','text-reverse-lines','paste-style','swap-paints','remove-fill','remove-stroke','round-joins','square-joins','dashed-strokes','full-opacity','cut-selection','paste-selection','paste-in-place','rename-project'].includes(id)){
    await expect.poll(async()=>JSON.stringify(await state())!==JSON.stringify(before)).toBe(true);
  }
  page.off('download',handler);report.checks.push({id,name,group,status:'passed'});console.log(`${report.checks.length}/100 ${id}`);await closeDialogs();
 }
 for(const [width,height]of [[1440,1000],[1024,768],[768,1024],[390,844],[320,568],[844,390]]){await page.setViewportSize({width,height});await page.waitForTimeout(70);const l=await page.evaluate(inspectLayout);assert.equal(l.horizontalOverflow,false,JSON.stringify(l.escaped));assert.deepEqual(l.clipped,[]);report.layouts.push({width,height,overflow:false});await page.screenshot({path:`${out}/workspace-${width}.png`});}
 const axe=await new AxeBuilder({page}).setLegacyMode(engine==='webkit').include('.uc-editor').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=String(e);await page.screenshot({path:`${out}/failure.png`});throw e;}finally{writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
